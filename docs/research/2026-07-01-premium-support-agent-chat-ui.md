# Premium Support Agent Chat UI Research

Date: 2026-07-01

## Goal

Research a premium chat interface direction for Nura RAG Copilot before writing
the UI spec. The target is a GitHub portfolio project that teaches the full RAG
loop while feeling like a real internal support-agent workspace.

## Product Direction

Nura should feel like an internal support copilot, not a public website chat
widget. The strongest portfolio story is:

- A support agent asks policy, product, or process questions.
- Nura retrieves the most relevant source chunks.
- Nura writes a grounded answer with paragraph-level citations.
- The agent can inspect the evidence, copy or adapt the answer, and judge answer
  quality.

This means the primary UI should become a chat workspace with evidence controls,
while the current learning UI can remain useful as a Retrieval Lab.

## Research Summary

### What "premium" should mean here

Premium for this product should mean calm, fast, credible, and inspectable. It
should not mean a heavy landing page, a dark generic AI console, or animated
effects that slow down the workflow.

The interface should prioritize:

- High contrast cream, white, navy, and near-black surfaces.
- Clear hierarchy between conversation, evidence, and system status.
- Source visibility after each answer paragraph.
- A fast scanning rhythm for support agents who need answers repeatedly.
- Compact controls, strong spacing, and no decorative noise.
- Responsive behavior that keeps chat usable on laptop and mobile widths.

### Best layout pattern

Use a three-zone workspace:

- Left: app navigation, conversation history, and product areas.
- Center: chat thread and composer.
- Right: evidence drawer with selected citation details, retrieved chunks, and
  source metadata.

On small screens, collapse the left navigation and right evidence drawer into
icon buttons/drawers.

### Recommended app areas

The sidebar should have five areas:

- Chat: the production-style support-agent conversation.
- Knowledge Base: synthetic documents, ingestion state, chunk counts, and source
  coverage.
- Retrieval Lab: the current transparent learning interface for embeddings,
  retrieval, scores, and ranked chunks.
- Evaluations: manual test questions, answer quality observations, failures, and
  regression notes.
- Settings: model/deployment labels, retrieval depth, chunking parameters, and
  environment status without exposing secrets.

This keeps the portfolio strong because it shows both the user-facing product
and the engineering learning surfaces behind it.

## Support-Agent UX Patterns

### Chat thread

The chat area should behave like a professional workspace:

- User messages are compact and aligned for scanning.
- Assistant answers are grouped into answer cards.
- Each answer card has an answer type badge: grounded, insufficient evidence, or
  needs clarification.
- Each paragraph can render its own citation chips immediately after the
  paragraph.
- Answer actions sit close to the answer: copy, copy with citations, mark useful,
  mark not useful, and open evidence.
- Retrieval and generation status should be visible but restrained:
  `retrieving`, `ranking sources`, `validating citations`, `drafting answer`.

### Citations and evidence

The existing paragraph-level citations are exactly the right direction. The next
UI should make them feel more deliberate:

- Citation chips should show source label and chunk id.
- Hover or click should show a short source preview.
- Clicking a citation opens the full chunk in the evidence drawer.
- The evidence drawer should show document, section, chunk id, retrieval score,
  and chunk text.
- If an answer has no valid evidence, the UI should visibly treat that as a
  refusal or insufficient-evidence state.

### Composer

The composer should support support-agent workflows:

- Textarea with send button.
- Optional suggested prompts.
- Retrieval depth selector for learning/debug mode.
- Mode selector: `Answer`, `Find sources`, `Explain retrieval`.
- Attachment/document upload should wait until a later phase.

### Evaluation loop

Because this is a RAG portfolio project, the UI should make quality observable:

- Save manual evaluation questions.
- Replay an eval question against the current data.
- Show whether answer citations are valid.
- Record agent feedback on helpfulness and missing evidence.
- Keep a visible trail of failed/insufficient answers as learning material.

## External Product References

### Microsoft Copilot UX guidance

Microsoft's copilot UX guidance describes three useful patterns for custom
copilot experiences: immersive, assistive, and embedded. Nura should combine an
immersive chat destination with assistive evidence panels because the user is
not merely chatting; they are validating a grounded answer.

Source: https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance

### Zendesk Agent Copilot

Zendesk frames agent copilot around support-agent productivity: suggested first
replies, macros, writing tools, communication guidelines, ticket summaries, and
auto-assist workflows. Nura should borrow the support-agent action pattern, not
the full Zendesk product scope.

Source: https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot

### Intercom / Fin Copilot

Intercom's reporting documentation highlights a useful evidence pattern: a side
panel can show the question, answer, inline sources, and relevant sources. This
strongly supports using a right-side evidence drawer in Nura.

Source: https://intercom.help/fin4all/en/articles/11333635-copilot-reporting

### Salesforce Agentforce citations

Salesforce Agentforce documentation treats citations as structured objects tied
to supported source types. Nura should keep citations as structured data, not as
plain text appended to the answer.

Source: https://developer.salesforce.com/docs/ai/agentforce/guide/citations.html

## UI Libraries And Template Options

### Recommended: shadcn/ui as the base system

shadcn/ui is the best base for this project because components are copied into
the app and can be owned directly. That fits a portfolio project better than a
black-box component kit. It also pairs well with the current Next.js + Tailwind
stack.

The official shadcn MCP server can browse, search, and install components from
registries. I added a project-scoped Codex MCP configuration for it in
`.codex/config.toml`.

Source: https://ui.shadcn.com/docs/mcp

### Recommended: Vercel AI Elements for selected AI components

Vercel AI Elements is built on shadcn/ui and provides AI-specific components.
The most relevant parts for Nura are:

- Conversation and message primitives.
- Prompt input.
- Inline citation.
- Sources.
- Response actions.

We should not blindly replace the app with a template. The better approach is to
borrow selected AI Elements patterns and adapt them to Nura's structured
citations and Convex data.

Sources:

- https://elements.ai-sdk.dev/
- https://elements.ai-sdk.dev/components/inline-citation
- https://elements.ai-sdk.dev/components/sources
- https://vercel.com/changelog/introducing-ai-elements

### Useful reference: assistant-ui

assistant-ui is a strong React library for production-grade AI chat experiences.
It is useful as a reference for thread behavior, scrolling, message anatomy, and
composer ergonomics.

For Nura, it is probably better as inspiration than the main dependency because
we need unusually visible retrieval and citation behavior for learning.

Sources:

- https://www.assistant-ui.com/docs
- https://github.com/assistant-ui/assistant-ui

### Useful reference: CopilotKit

CopilotKit is more agent-oriented and includes human-in-the-loop and generative
UI ideas. It is worth knowing about, but it is too broad for the current phase.
Nura is still a focused RAG copilot, not a general agent platform.

Source: https://docs.copilotkit.ai/

### Optional MCP: Figma MCP

Figma MCP can give Codex structured access to Figma files, components,
variables, and layout data. This becomes valuable if we create or obtain a real
Figma design system for Nura.

Do not configure this yet unless the user provides the Figma setup, because it
requires account access and should be an intentional design step.

Sources:

- https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server
- https://developers.openai.com/codex/use-cases/figma-designs-to-code

### Optional MCP: 21st.dev Magic MCP

21st.dev Magic MCP can generate polished UI component variations from natural
language prompts and draws from curated component patterns. It could help produce
visual variations once the brand palette is known.

Do not configure this yet unless the user provides a 21st.dev API key or chooses
to use it. It is useful for inspiration and component variation, not for core
RAG architecture.

Sources:

- https://21st.dev/magic
- https://github.com/21st-dev/magic-mcp

### Template inspiration

Templates are useful for layout inspiration, but we should avoid copying paid or
unclear-license templates into a GitHub portfolio. Good inspiration sources:

- Subframe chat conversation with detail sidebar: a chat workspace with a right
  detail/source panel.
- shadcn sidebar blocks: strong base for navigation.
- shadcn chatbot kit examples: useful for message, composer, and responsive chat
  patterns.

Sources:

- https://www.subframe.com/templates/t/chat-conversation-with-detail-sidebar
- https://ui.shadcn.com/blocks/sidebar
- https://www.shadcn.io/template/blazity-shadcn-chatbot-kit

## MCP Connection Status

Added project-scoped shadcn MCP config:

```toml
[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
startup_timeout_sec = 20
tool_timeout_sec = 60
```

This should become available after Codex reloads the project config. It does not
include secrets.

I did not configure Figma MCP or 21st.dev Magic MCP because those need account
access or API keys.

## Recommendation

Use this stack for the premium chat UI phase:

- Base design system: shadcn/ui.
- AI-specific component inspiration: Vercel AI Elements.
- Layout direction: custom Nura support-agent workspace.
- Evidence model: keep our own structured paragraph citations.
- Optional later: Figma MCP if we create a Figma design system.
- Optional later: 21st.dev Magic MCP for visual variations after the brand
  palette is locked.

## Proposed Premium Chat UI Spec Direction

When the user provides the final brand palette, write the next design spec around
these deliverables:

- New application shell with left sidebar and responsive mobile nav.
- Chat page as the first product screen.
- Right evidence drawer connected to paragraph citation chips.
- Chat answer cards with answer-type badges and response actions.
- Retrieval Lab preserved as a learning/debug page.
- Evaluations page prepared for the next quality phase.
- Theme tokens for cream, white, navy, near-black, borders, muted surfaces, and
  accent states.

## Learning Takeaway

Good RAG UI design is not only about making chat look nice. The UI must teach
trust: what was retrieved, what was used, what was ignored, what is missing, and
why the answer is safe enough to use.
