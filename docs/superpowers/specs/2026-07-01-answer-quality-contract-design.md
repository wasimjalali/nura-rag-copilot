# Answer Quality Contract Design

## Goal

Make grounded answers reliable enough for the future support-agent chat UI by changing the answer output from loose text into a validated paragraph-level contract.

## Product Positioning

Nura RAG Copilot is an internal support-agent copilot for a fictional wellness e-commerce brand. The user is a support agent who needs fast, source-grounded policy answers they can trust before replying to a customer.

The copilot should not act like a direct customer-facing wellness chatbot in this phase. It should avoid medical claims, cite policy evidence, and refuse when the retrieved documents do not support an answer.

## Current State

The app already retrieves relevant chunks from Convex, labels them as `[1]`, `[2]`, and so on, sends them to `gpt-5.4-mini`, and renders a plain answer string with cited evidence below it.

This works for learning the RAG loop, but plain text makes citation quality hard to validate. The model can place citations at the end, omit them, or cite chunks that were not retrieved.

## Decision

Use a structured answer contract:

```ts
type GroundedAnswer = {
  answerType: "grounded" | "insufficient_evidence";
  paragraphs: Array<{
    text: string;
    citations: string[];
  }>;
};
```

The answer provider will still call the Foundry chat deployment, but the prompt will ask for strict JSON. The app will parse and validate the returned JSON before rendering.

## Contract Rules

- A grounded answer must include one or more non-empty paragraphs.
- Each grounded paragraph must include one or more citations.
- Every citation must match a retrieved chunk citation label.
- Duplicate citations inside one paragraph should be removed.
- An insufficient-evidence answer must use `answerType: "insufficient_evidence"`.
- An insufficient-evidence answer may have zero citations.
- If the model returns invalid JSON, empty paragraphs, unsupported citations, or a grounded paragraph without citations, the action returns the insufficient-evidence answer instead of showing an unsafe answer.

## Prompt Rules

The system prompt should tell the model:

- It is Nura's internal support copilot.
- It answers only from the supplied evidence.
- It must not invent policies, product facts, numbers, timelines, exceptions, or medical claims.
- It must return only JSON that matches the contract.
- It must put citations on each paragraph that uses evidence.
- It must use `insufficient_evidence` when evidence does not answer the question.

## UI Behavior

The current learning dashboard should render paragraphs from the structured answer. Citation chips should appear directly after the paragraph they support, not as one combined list at the end of the answer.

The cited evidence list remains visible below the answer so the support agent can inspect source file, section, chunk id, score, and text.

## Error And Safety Behavior

Provider/network errors should continue to show a safe error message.

Model contract errors should not crash the UI. They should degrade to the insufficient-evidence answer so unsupported or malformed responses are not presented as grounded support guidance.

## Tests

Add tests for:

- Building a structured prompt that asks for JSON.
- Parsing valid JSON into paragraphs and citations.
- Rejecting invalid JSON.
- Rejecting citations that were not retrieved.
- Rejecting grounded paragraphs with no citations.
- Returning insufficient evidence when no chunks are retrieved.
- Rendering paragraph-level citations in the dashboard.

## Non-Goals

- No full chat UI yet.
- No sidebar navigation yet.
- No evidence drawer yet.
- No streaming yet.
- No conversation history yet.
- No deep premium UI research yet.
- No manual eval dataset yet.

Those happen after this contract is stable.

## Learning Outcome

This phase teaches that production-grade RAG is not only retrieval plus prompting. It also needs an output contract, validation, and safe fallback behavior. The UI can only become truly premium after the answer shape is predictable.
