import type {
  AiProvider,
  CompletionRequest,
  CompletionResult,
  ModelInfo,
} from '../model';

const SYSTEM_MESSAGE =
  "You are Folio's study-material generator. Follow the user message exactly and return only a JSON object.";

const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 1500;

interface ChatCompletion {
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Provider for the OpenAI chat-completions shape, which DeepSeek, OpenAI, Ollama,
 * Groq and Together all speak. One adapter, many base URLs.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  async complete(
    info: ModelInfo,
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResult> {
    const body = {
      model: info.model,
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: request.prompt },
      ],
      max_tokens: info.maxTokens,
      stream: false,
      ...(request.json !== false && info.jsonMode
        ? { response_format: { type: 'json_object' } }
        : {}),
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const url = `${info.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    let failure = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = (await response.json()) as ChatCompletion;
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string')
          throw new Error(`${info.label} returned no message content.`);
        return {
          text,
          model: info.model,
          usage: {
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          },
        };
      }
      failure = `${response.status} ${(await response.text()).slice(0, 400)}`;
      if (!RETRY_STATUS.has(response.status) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    throw new Error(`${info.label} request failed: ${failure}`);
  }
}
