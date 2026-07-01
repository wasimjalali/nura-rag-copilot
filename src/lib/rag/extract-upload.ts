const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export async function extractUploadedText(
  file: File,
): Promise<{ title: string; markdown: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is too large. Keep uploads under 5 MB.");
  }

  const extension = getExtension(file.name);
  const title = deriveTitle(file.name);

  let markdown: string;

  if (TEXT_EXTENSIONS.has(extension)) {
    markdown = await file.text();
  } else if (extension === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    markdown = text;
  } else {
    throw new Error(
      "Unsupported file type. Upload a .md, .markdown, .txt, or .pdf file.",
    );
  }

  if (!markdown.trim()) {
    throw new Error("That file did not contain any readable text.");
  }

  return { title, markdown };
}

function getExtension(fileName: string) {
  const match = /\.[^.]+$/.exec(fileName);
  return match ? match[0].toLowerCase() : "";
}

function deriveTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}
