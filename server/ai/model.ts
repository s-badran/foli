/**
 * Single import surface for every AI call in Folio.
 *
 * Consumers never import a provider directly: they ask for an `AiModel` by id and call
 * `complete()`. Adding a provider means registering it here, not editing call sites.
 */
import { MockProvider } from './providers/mock';
import { OpenAiCompatibleProvider } from './providers/openai-compatible';

export type ProviderKind = 'openai-compatible' | 'mock';

export interface ModelInfo {
  id: string;
  label: string;
  provider: ProviderKind;
  /** Environment variable holding the API key; null for keyless local servers. */
  apiKeyEnv: string | null;
  /** Base URL without the trailing `/chat/completions`. */
  baseUrl: string;
  /** Model name sent to the provider. */
  model: string;
  /** True when the provider accepts `response_format: { type: 'json_object' }`. */
  jsonMode: boolean;
  maxTokens: number;
  /** Hidden models are resolvable but never offered to the learner. */
  hidden?: boolean;
}

export interface CompletionRequest {
  /** Rendered prompt: system prompt, task prompt and the required JSON schema. */
  prompt: string;
  /** Ask compatible providers for a JSON object response. Defaults to true. */
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AiProvider {
  complete(
    info: ModelInfo,
    request: CompletionRequest,
    apiKey?: string,
  ): Promise<CompletionResult>;
}

/** Used whenever no model is injected explicitly. */
export const DEFAULT_MODEL_ID = 'deepseek-chat';

export const SUPPORTED_MODELS: readonly ModelInfo[] = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'openai-compatible',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    jsonMode: true,
    maxTokens: 8000,
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    provider: 'openai-compatible',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    jsonMode: false,
    maxTokens: 8000,
  },
  {
    id: 'gpt-4o-mini',
    label: 'OpenAI GPT-4o mini',
    provider: 'openai-compatible',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    jsonMode: true,
    maxTokens: 8000,
  },
  {
    id: 'ollama-local',
    label: 'Ollama (local)',
    provider: 'openai-compatible',
    apiKeyEnv: null,
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.1',
    jsonMode: true,
    maxTokens: 4096,
  },
  {
    id: 'mock',
    label: 'Mock (offline tests)',
    provider: 'mock',
    apiKeyEnv: null,
    baseUrl: 'mock://local',
    model: 'mock',
    jsonMode: true,
    maxTokens: 0,
    hidden: true,
  },
];

function providerFor(info: ModelInfo): AiProvider {
  if (info.provider === 'mock') return new MockProvider();
  return new OpenAiCompatibleProvider();
}

export interface CreateModelOptions {
  /** Environment to read the API key from. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Override the provider, e.g. a mock in tests. */
  provider?: AiProvider;
}

export class AiModel {
  private constructor(
    readonly info: ModelInfo,
    private readonly provider: AiProvider,
    private readonly apiKey?: string,
  ) {}

  /**
   * Resolve a supported model by id. The id defaults to `FOLIO_AI_MODEL`, then
   * `DEFAULT_MODEL_ID`, so callers can omit it and still get a working model.
   */
  static create(
    id: string = process.env.FOLIO_AI_MODEL ?? DEFAULT_MODEL_ID,
    options: CreateModelOptions = {},
  ): AiModel {
    const info = SUPPORTED_MODELS.find((item) => item.id === id);
    if (!info)
      throw new Error(
        `Unknown AI model "${id}". Supported: ${SUPPORTED_MODELS.filter((item) => !item.hidden)
          .map((item) => item.id)
          .join(', ')}.`,
      );
    const env = options.env ?? process.env;
    const apiKey = info.apiKeyEnv ? env[info.apiKeyEnv] : undefined;
    if (info.apiKeyEnv && !apiKey)
      throw new Error(
        `Missing ${info.apiKeyEnv}. Add it to .env (gitignored) and restart the server.`,
      );
    return new AiModel(info, options.provider ?? providerFor(info), apiKey);
  }

  get id() {
    return this.info.id;
  }

  get label() {
    return this.info.label;
  }

  async complete(request: CompletionRequest): Promise<string> {
    const result = await this.provider.complete(this.info, request, this.apiKey);
    if (!result.text.trim()) throw new Error(`${this.label} returned an empty completion.`);
    return result.text;
  }
}

export interface ModelSummary {
  id: string;
  label: string;
  provider: ProviderKind;
  configured: boolean;
  default: boolean;
  jsonMode: boolean;
}

/** Models offered in the picker, with whether their credentials are present. */
export function listModels(env: NodeJS.ProcessEnv = process.env): ModelSummary[] {
  return SUPPORTED_MODELS.filter((info) => !info.hidden).map((info) => ({
    id: info.id,
    label: info.label,
    provider: info.provider,
    configured: info.apiKeyEnv === null || Boolean(env[info.apiKeyEnv]),
    default: info.id === DEFAULT_MODEL_ID,
    jsonMode: info.jsonMode,
  }));
}
