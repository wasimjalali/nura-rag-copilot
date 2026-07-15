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

export type GroundedAnswerParagraph = {
  text: string;
  citations: string[];
};

export type StructuredGroundedAnswer = {
  answerType: "grounded" | "insufficient_evidence";
  paragraphs: GroundedAnswerParagraph[];
};

export type GroundedAnswerResponse = {
  question: string;
  answer: string;
  answerModel: string;
  structuredAnswer: StructuredGroundedAnswer;
  retrieval: {
    embeddingModel: string;
    embeddingDimensions: number;
    results: CitedRetrievalResult[];
  };
  conversationId?: string;
  assistantMessageId?: string;
};
