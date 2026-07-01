import type { DocumentChunk, KnowledgeDocument } from "./types";

const PREVIEW_CREATED_AT = "2026-07-01T00:00:00.000Z";
const TARGET_WORDS = 160;
const MAX_WORDS = 220;

export function estimateTokenCount(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.35);
}

export function chunkDocuments(
  documents: KnowledgeDocument[],
): DocumentChunk[] {
  const seenSlugs = new Map<string, string>();

  for (const document of documents) {
    const slug = sourceSlug(document.source);
    const existingSource = seenSlugs.get(slug);

    if (existingSource) {
      throw new Error(
        `Duplicate source slug "${slug}" from "${existingSource}" and "${document.source}".`,
      );
    }

    seenSlugs.set(slug, document.source);
  }

  return documents.flatMap((document) => chunkDocument(document));
}

function chunkDocument(document: KnowledgeDocument): DocumentChunk[] {
  const sections = splitBySecondLevelHeading(document.text);
  let chunkNumber = 1;

  return sections.flatMap((section) => {
    const pieces = splitSectionText(section.body);

    return pieces.map((piece) => ({
      id: `${sourceSlug(document.source)}__chunk_${String(chunkNumber++).padStart(3, "0")}`,
      source: document.source,
      section: section.heading,
      text: piece,
      tokenEstimate: estimateTokenCount(piece),
      createdAt: PREVIEW_CREATED_AT,
    }));
  });
}

// H2 (`## `) is the only structural unit; H3+ and setext headings are
// intentionally folded into their parent H2 section.
function splitBySecondLevelHeading(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "(Introduction)";
  let currentLines: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const isFenceDelimiter =
      line.trim().startsWith("```") || line.trim().startsWith("~~~");

    if (isFenceDelimiter) {
      inFence = !inFence;
      currentLines.push(line);
    } else if (inFence) {
      currentLines.push(line);
    } else if (line.startsWith("## ")) {
      pushSection();
      currentHeading = line.replace(/^##\s+/, "").trim();
      currentLines = [];
    } else if (!line.startsWith("# ")) {
      currentLines.push(line);
    }
  }

  pushSection();
  return sections.filter((section) => section.body.length > 0);

  function pushSection() {
    const body = currentLines.join("\n").trim();
    if (body.length > 0) {
      sections.push({ heading: currentHeading, body });
    }
  }
}

function splitSectionText(text: string) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current: string[] = [];

  for (const paragraph of paragraphs) {
    if (wordCount(paragraph) > MAX_WORDS) {
      flush();
      chunks.push(...splitLongParagraph(paragraph));
      continue;
    }

    const proposed = [...current, paragraph].join("\n\n");
    if (current.length > 0 && wordCount(proposed) > TARGET_WORDS) {
      flush();
    }
    current.push(paragraph);
  }

  flush();
  return chunks;

  function flush() {
    if (current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
    }
  }
}

function splitLongParagraph(paragraph: string) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const proposed = [...current, sentence].join(" ");
    if (current.length > 0 && wordCount(proposed) > TARGET_WORDS) {
      chunks.push(current.join(" "));
      current = [];
    }
    current.push(sentence);
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

function sourceSlug(source: string) {
  return source
    .replace(/\.(md|markdown|txt)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
