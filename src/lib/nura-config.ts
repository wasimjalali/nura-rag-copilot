export type NuraClientConfig = {
  productName: string;
  productSubtitle: string;
  supportRoleLabel: string;
  knowledgeLabel: string;
  evaluationsLabel: string;
};

export const DEFAULT_NURA_CONFIG: NuraClientConfig = {
  productName: "Nura",
  productSubtitle: "RAG Copilot",
  supportRoleLabel: "Support agent",
  knowledgeLabel: "Knowledge base",
  evaluationsLabel: "Evaluations",
};
