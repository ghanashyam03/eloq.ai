export interface EmbeddingResult {
  embedding: readonly number[];
  dimensions: number;
  provider: string;
}

/**
 * Interface contract for decoupled Text Embedding services.
 */
export interface EmbeddingProvider {
  readonly providerName: string;

  generateEmbedding(text: string): Promise<EmbeddingResult>;
  generateBatchEmbeddings(texts: readonly string[]): Promise<readonly EmbeddingResult[]>;
}
