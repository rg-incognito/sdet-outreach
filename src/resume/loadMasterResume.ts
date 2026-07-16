import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function loadMasterResume(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();

  switch (ext) {
    case ".md":
    case ".txt":
      return readFile(path, "utf-8");

    case ".docx": {
      const { value } = await mammoth.extractRawText({ path });
      return value;
    }

    case ".pdf": {
      const buffer = await readFile(path);
      const { text } = await pdfParse(buffer);
      return text;
    }

    default:
      throw new Error(
        `Unsupported master resume format "${ext}". Use .md, .txt, .docx, or .pdf.`
      );
  }
}
