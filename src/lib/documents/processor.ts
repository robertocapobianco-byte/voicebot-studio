/**
 * Text chunking utility for RAG pipeline.
 * Document parsing is handled client-side (mammoth.js CDN + pdf.js CDN).
 * This module only provides the chunking logic used by the upload API route.
 */

export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): string[] {
  const { chunkSize = 1000, overlap = 200 } = options;
  const chunks: string[] = [];
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= chunkSize) return cleaned.length > 50 ? [cleaned] : [];

  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

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
