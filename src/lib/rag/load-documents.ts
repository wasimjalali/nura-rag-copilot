import { promises as fs } from "node:fs";
import path from "node:path";

import type { KnowledgeDocument } from "./types";

const SYNTHETIC_DOCS_DIR = path.join(
  process.cwd(),
  "content",
  "synthetic-docs",
);

export async function loadSyntheticDocuments(): Promise<KnowledgeDocument[]> {
  let fileNames: string[];

  try {
    fileNames = await fs.readdir(SYNTHETIC_DOCS_DIR);
  } catch {
    return [];
  }

  const markdownFiles = fileNames
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();

  return Promise.all(
    markdownFiles.map(async (source) => {
      const filePath = path.join(SYNTHETIC_DOCS_DIR, source);
      const text = await fs.readFile(filePath, "utf8");

      return {
        source,
        title: extractTitle(text, source),
        text,
      };
    }),
  );
}

function extractTitle(markdown: string, fallback: string) {
  const title = markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();

  return title || fallback.replace(/\.md$/, "").replace(/_/g, " ");
}
