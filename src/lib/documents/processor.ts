import type { DocumentProcessor } from '@/types';

/**
 * Universal document processor supporting PDF and DOCX.
 * Uses pdf-parse and mammoth for extraction — both run server-side only.
 */
export class DefaultDocumentProcessor implements DocumentProcessor {
  supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  async extractText(buffer: Buffer, fileType: string): Promise<string> {
    switch (fileType) {
      case 'pdf':
        return this.extractPDF(buffer);
      case 'docx':
      case 'doc':
        return this.extractDOCX(buffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async extractPDF(buffer: Buffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  private async extractDOCX(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}

/**
 * Split extracted text into overlapping chunks for embedding.
 * Uses a simple sentence-aware splitter with configurable size/overlap.
 */
export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): string[] {
  const { chunkSize = 1000, overlap = 200 } = options;
  const chunks: string[] = [];

  // Clean whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to break at sentence boundary
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      const lastNewline = cleaned.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleaned.length) break;
  }

  return chunks;
}
