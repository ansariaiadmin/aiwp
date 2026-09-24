/**
 * Persian / Arabic search-text normalisation.
 *
 * Applied ONLY to the retrieval version of the text. The original is kept
 * verbatim for display and citation, exactly as the design rule says: a
 * reader must see "می‌کند" and "کتاب", not a flattened machine form, while
 * the index treats "ي/ی" and "ك/ک" as the same letter so a query in either
 * spelling finds the document.
 *
 * Every step is a pure, deterministic string rewrite — no data is lost, only
 * canonical forms are produced — so it is safe to run on both index and
 * query and be guaranteed they agree.
 */

/**
 * Maps Latin and Eastern-Arabic digits to their Persian forms, so "1403" and
 * "۱۴۰۳" and "١٤٠٣" all match the same token.
 */
function normaliseDigits(input: string): string {
  return input
    .replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])
    .replace(/[٠-٩]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
}

/**
 * Canonicalises letter forms that differ only by regional convention.
 */
function normaliseLetters(input: string): string {
  return input
    // Arabic yeh/kaf -> Persian yeh/kaf
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    // Alef variants -> bare alef
    .replace(/[أإآٱ]/g, "ا")
    // Teh marbuta -> heh (common Persian reading)
    .replace(/ة/g, "ه")
    // Waw with hamza -> waw
    .replace(/ؤ/g, "و")
    // Yeh with hamza -> yeh
    .replace(/ئ/g, "ی");
}

/**
 * Collapses the various space / joiner characters Persian text accumulates
 * (zero-width joiner/non-joiner, half-space, tatweel) so "می شود" and
 * "می‌شود" index identically.
 */
function normaliseJoiners(input: string): string {
  return input
    // Remove tatweel (kashida) entirely — it carries no meaning.
    .replace(/ـ/g, "")
    // Remove direction-control marks.
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    // Normalise ZWNJ / half-space / multiple spaces to a single space, so a
    // half-space and a full space are not different tokens.
    .replace(/[\u200c\u200f\u00a0\u2007\u202f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The full canonical form used for indexing and querying.
 *
 * Order matters: joiners and spaces first (so letter mapping sees stable
 * tokens), then letters, then digits.
 */
export function normalizeForSearch(input: string): string {
  return normaliseDigits(normaliseLetters(normaliseJoiners(input)));
}

/**
 * A stable hash of the normalised content, used for incremental indexing: if
 * it has not changed, re-ingesting a document skips the (expensive) embedding
 * step entirely.
 */
export async function contentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeForSearch(text));
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
