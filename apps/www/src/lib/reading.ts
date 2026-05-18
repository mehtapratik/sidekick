const WORDS_PER_MINUTE = 220;

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / WORDS_PER_MINUTE));
}

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}
