/**
 * Splits ingested text into retrieval units.
 *
 * The rules here are boring on purpose. Chunking is the part of a RAG
 * pipeline that silently decides answer quality, and the failure mode of a
 * clever splitter is a corpus that searches badly in ways nobody can see.
 * So: split on structure first, then on size, never mid-word, and keep a
 * small overlap so a fact stated across a boundary survives in at least one
 * chunk.
 */

export interface ChunkOptions {
  /** Target chunk length in characters. */
  targetChars?: number;
  /** Hard ceiling; a chunk is never longer than this. */
  maxChars?: number;
  /** Characters repeated from the end of one chunk into the next. */
  overlapChars?: number;
}

const DEFAULT_TARGET = 1200;
const DEFAULT_MAX = 2000;
const DEFAULT_OVERLAP = 150;

/**
 * Rough token count. English averages ~4 characters per token; Persian runs
 * denser because words are shorter but carry more meaning each, so the same
 * divisor is a conservative over-estimate there. This is only ever used to
 * budget a prompt, never to bill anyone, so an approximation is the right
 * trade for not shipping a tokenizer dependency.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Splits on Markdown-ish structure: headings, blank lines, list items.
 * Returns blocks in document order, each already trimmed of blank edges.
 */
function structuralBlocks(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\t/g, "  ");

  // A heading always starts a new block and stays attached to the text
  // beneath it — a heading on its own is worthless as a retrieval unit.
  const withSplits = normalised.replace(/\n(?=#{1,6}\s)/g, "\n\u0000");
  const blocks: string[] = [];

  for (const section of withSplits.split("\u0000")) {
    // Within a section, blank lines are the next split point.
    for (const para of section.split(/\n{2,}/)) {
      const trimmed = para.trim();
      if (trimmed.length > 0) blocks.push(trimmed);
    }
  }

  // A heading on its own carries no retrievable information — searching for
  // it returns a chunk that says nothing. Glue each bare heading onto the
  // first block that follows it so a chunk always contains both the label
  // and the content it labels.
  const glued: string[] = [];

  for (const block of blocks) {
    const isBareHeading = /^#{1,6}\s+\S/.test(block) && !block.includes("\n");

    if (isBareHeading && glued.length > 0 && /^#{1,6}\s+\S/.test(glued[glued.length - 1]) === false) {
      // Previous block is body text under an earlier heading; start fresh.
      glued.push(block);
      continue;
    }

    if (isBareHeading) {
      glued.push(block);
      continue;
    }

    if (glued.length > 0 && /^#{1,6}\s+\S/.test(glued[glued.length - 1]) && !glued[glued.length - 1].includes("\n")) {
      glued[glued.length - 1] = `${glued[glued.length - 1]}\n${block}`;
      continue;
    }

    glued.push(block);
  }

  return glued;
}

/**
 * Splits an over-long block on sentence boundaries, then on whitespace.
 *
 * `softLimit` is what the pieces aim for and `hardLimit` the absolute
 * ceiling. Splitting at the ceiling instead left every piece already at
 * maxChars, so the packing step below could never combine two of them and
 * there was never room to add the overlap — both symptoms of the same
 * mistake.
 */
function splitLong(block: string, softLimit: number, hardLimit: number): string[] {
  if (block.length <= hardLimit) return [block];

  const sentences = block.match(/[^.!?؟。]*[.!?؟。]+(?:\s+|$)|[^.!?؟。]+$/g) ?? [block];
  const maxChars = hardLimit;
  const out: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (s.length === 0) continue;

    // A single sentence longer than the ceiling (a table, a code block, a
    // very long Persian run-on) is cut on whitespace rather than dropped.
    if (s.length > maxChars) {
      if (current.length > 0) {
        out.push(current);
        current = "";
      }
      const words = s.split(/\s+/);
      let piece = "";
      for (const word of words) {
        if (piece.length + word.length + 1 > maxChars) {
          if (piece.length > 0) out.push(piece);
          piece = word;
        } else {
          piece = piece.length === 0 ? word : `${piece} ${word}`;
        }
      }
      if (piece.length > 0) out.push(piece);
      continue;
    }

    if (current.length + s.length + 1 > softLimit) {
      if (current.length > 0) out.push(current);
      current = s;
    } else {
      current = current.length === 0 ? s : `${current} ${s}`;
    }
  }

  if (current.length > 0) out.push(current);

  return out;
}

/**
 * Chunks a document.
 *
 * Returns the chunk texts in document order. Empty or whitespace-only input
 * yields an empty array rather than a single empty chunk, so the caller can
 * treat "nothing to embed" as a normal outcome.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const target = options.targetChars ?? DEFAULT_TARGET;
  const maxChars = Math.max(options.maxChars ?? DEFAULT_MAX, target);
  const overlap = Math.min(options.overlapChars ?? DEFAULT_OVERLAP, Math.floor(target / 2));

  const blocks = structuralBlocks(text);
  if (blocks.length === 0) return [];

  const pieces: string[] = [];
  for (const block of blocks) {
    pieces.push(...splitLong(block, target, maxChars));
  }

  // Pack pieces, but never past the ceiling. maxChars is the invariant the
  // caller can rely on; target is only the aim.
  const packed: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (current.length === 0) {
      current = piece;
      continue;
    }

    if (current.length + piece.length + 2 <= maxChars) {
      current = `${current}\n\n${piece}`;
      continue;
    }

    packed.push(current);
    current = piece;
  }

  if (current.length > 0) packed.push(current);

  if (overlap <= 0 || packed.length < 2) return packed;

  // Apply the overlap as a second pass over the finished chunks. Doing it
  // during packing meant the tail competed with the piece for the same
  // budget and was skipped whenever a piece was already near the target.
  const withOverlap: string[] = [packed[0]];

  for (let i = 1; i < packed.length; i += 1) {
    const prev = packed[i - 1];
    const tail = prev.length > overlap ? prev.slice(-overlap) : prev;

    // Only worth carrying if the result stays inside the ceiling; a chunk
    // that is mostly repeated text is worse than one with no overlap.
    withOverlap.push(
      tail.length > 0 && tail.length + packed[i].length + 2 <= maxChars
        ? `${tail}\n\n${packed[i]}`
        : packed[i],
    );
  }

  return withOverlap;
}
