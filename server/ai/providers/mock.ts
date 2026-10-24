import type {
  AiProvider,
  CompletionRequest,
  CompletionResult,
  ModelInfo,
} from '../model';

/** Deterministic offline provider for tests; it never touches the network. */
export class MockProvider implements AiProvider {
  readonly calls: CompletionRequest[] = [];

  async complete(
    _info: ModelInfo,
    request: CompletionRequest,
  ): Promise<CompletionResult> {
    this.calls.push(request);
    return { text: '{"mock":true}', model: 'mock' };
  }
}
