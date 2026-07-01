export type CitedRetrievalResult = {
  rank: number;
  score: number;
  chunkId: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
  citationLabel: string;
};

export type GroundedAnswerResponse = {
  question: string;
  answer: string;
  answerModel: string;
  retrieval: {
    embeddingModel: string;
    embeddingDimensions: number;
    results: CitedRetrievalResult[];
  };
};
