const DEFAULT_DIALOGUE_PAGE_CHARS = 56;

export function paginateDialogueText(text: string, maxChars = DEFAULT_DIALOGUE_PAGE_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [''];

  const pages: string[] = [];
  for (const paragraph of normalized.split(/\n{2,}/)) {
    pages.push(...splitParagraph(paragraph.trim(), maxChars));
  }

  return pages.length > 0 ? pages : [''];
}

function splitParagraph(paragraph: string, maxChars: number): string[] {
  if (!paragraph) return [];

  const sentences = paragraph.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? [paragraph];
  const pages: string[] = [];
  let pending = '';

  for (const sentence of sentences) {
    if (charCount(sentence) > maxChars) {
      if (pending) {
        pages.push(pending);
        pending = '';
      }
      pages.push(...splitByChars(sentence, maxChars));
      continue;
    }

    const merged = pending ? pending + sentence : sentence;
    if (pending && charCount(merged) > maxChars) {
      pages.push(pending);
      pending = sentence;
    } else {
      pending = merged;
    }
  }

  if (pending) pages.push(pending);
  return pages;
}

function splitByChars(text: string, maxChars: number): string[] {
  const chars = Array.from(text);
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += maxChars) {
    chunks.push(chars.slice(i, i + maxChars).join(''));
  }
  return chunks;
}

function charCount(text: string): number {
  return Array.from(text).length;
}
