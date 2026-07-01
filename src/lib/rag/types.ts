export type KnowledgeDocument = {
  source: string;
  title: string;
  text: string;
};

export type DocumentChunk = {
  id: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
  createdAt: string;
};
