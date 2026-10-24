import { describe, expect, it, vi } from 'vitest';
import { AiModel, DEFAULT_MODEL_ID, listModels, SUPPORTED_MODELS } from '../server/ai/model';
import { MockProvider } from '../server/ai/providers/mock';
import { OpenAiCompatibleProvider } from '../server/ai/providers/openai-compatible';

describe('AiModel registry', () => {
  it('defaults to deepseek-chat and hides internal models', () => {
    expect(DEFAULT_MODEL_ID).toBe('deepseek-chat');
    const models = listModels({});
    expect(models.map((item) => item.id)).toContain('deepseek-chat');
    expect(models.map((item) => item.id)).not.toContain('mock');
    expect(models.find((item) => item.default)?.id).toBe(DEFAULT_MODEL_ID);
  });

  it('reports whether each provider has credentials', () => {
    const without = listModels({});
    expect(without.find((item) => item.id === 'deepseek-chat')?.configured).toBe(false);
    expect(without.find((item) => item.id === 'ollama-local')?.configured).toBe(true);
    const withKey = listModels({ DEEPSEEK_API_KEY: 'test' });
    expect(withKey.find((item) => item.id === 'deepseek-chat')?.configured).toBe(true);
  });

  it('rejects unknown model ids and missing keys', () => {
    expect(() => AiModel.create('nope', { env: {} })).toThrow(/Unknown AI model/);
    expect(() => AiModel.create('deepseek-chat', { env: {} })).toThrow(/DEEPSEEK_API_KEY/);
  });

  it('injects the selected model and provider', async () => {
    const provider = new MockProvider();
    const model = AiModel.create('deepseek-chat', {
      env: { DEEPSEEK_API_KEY: 'test' },
      provider,
    });
    expect(model.id).toBe('deepseek-chat');
    expect(model.info.baseUrl).toBe('https://api.deepseek.com');
    expect(await model.complete({ prompt: 'prompt text' })).toBe('{"mock":true}');
    expect(provider.calls[0]?.prompt).toBe('prompt text');
  });

  it('resolves the offline model without credentials', async () => {
    const model = AiModel.create('mock', { env: {} });
    expect(await model.complete({ prompt: 'x' })).toContain('mock');
  });
});

describe('OpenAI-compatible provider', () => {
  it('sends the key, model and JSON mode, and reads the completion', async () => {
    const sent: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      sent.push({ url, init });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 11, completion_tokens: 7 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    try {
      const info = SUPPORTED_MODELS.find((item) => item.id === 'deepseek-chat')!;
      const result = await new OpenAiCompatibleProvider().complete(
        info,
        { prompt: 'hello' },
        'secret',
      );
      expect(result.text).toBe('{"ok":true}');
      expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
      const request = sent[0]!;
      expect(request.url).toBe('https://api.deepseek.com/chat/completions');
      const headers = request.init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer secret');
      const body = JSON.parse(String(request.init?.body)) as {
        model: string;
        response_format?: { type: string };
      };
      expect(body.model).toBe('deepseek-chat');
      expect(body.response_format?.type).toBe('json_object');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails fast on a non-retryable status', async () => {
    vi.stubGlobal('fetch', async () => new Response('bad key', { status: 401 }));
    try {
      const info = SUPPORTED_MODELS.find((item) => item.id === 'deepseek-chat')!;
      await expect(
        new OpenAiCompatibleProvider().complete(info, { prompt: 'x' }, 'secret'),
      ).rejects.toThrow(/401 bad key/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
