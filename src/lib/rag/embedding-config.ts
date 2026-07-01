export const EMBEDDING_DIMENSIONS = 1536;

export const embeddingConfig = {
  provider: "azure-openai",
  model: "text-embedding-3-small",
  dimensions: EMBEDDING_DIMENSIONS,
  deploymentEnvVar: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
} as const;

type EmbeddingEnv = {
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT?: string;
};

export function isEmbeddingReady(env: EmbeddingEnv) {
  if (!env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim()) {
    return {
      ok: false,
      message:
        "Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT before generating embeddings.",
    };
  }

  return {
    ok: true,
    message: "Embedding deployment is configured.",
  };
}
