/**
 * Merges base transcript and incoming speech delta without any sentence/word repetitions.
 * Detects word-level overlaps at the boundary (seam) between recognition sessions.
 */
export function mergeTranscripts(base: string, incoming: string): string {
  const b = (base || '').replace(/\s+/g, ' ').trim();
  const inc = (incoming || '').replace(/\s+/g, ' ').trim();
  
  if (!b) return inc;
  if (!inc) return b;

  // If base already equals incoming, return base
  if (b.toLowerCase() === inc.toLowerCase()) return b;

  // If base already ends with the exact incoming string
  if (b.toLowerCase().endsWith(inc.toLowerCase())) return b;

  // If incoming already starts with the entire base string
  if (inc.toLowerCase().startsWith(b.toLowerCase())) return inc;

  const baseWords = b.split(' ');
  const incWords = inc.split(' ');

  // Look for overlapping words at the seam (up to 8 words)
  const maxOverlap = Math.min(baseWords.length, incWords.length, 8);
  for (let len = maxOverlap; len > 0; len--) {
    const baseTail = baseWords.slice(-len).join(' ').toLowerCase();
    const incHead = incWords.slice(0, len).join(' ').toLowerCase();
    if (baseTail === incHead) {
      const remainingWords = incWords.slice(len);
      return remainingWords.length > 0 ? `${b} ${remainingWords.join(' ')}` : b;
    }
  }

  return `${b} ${inc}`;
}
