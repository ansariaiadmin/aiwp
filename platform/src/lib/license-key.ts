import { randomBytes } from "node:crypto";

/**
 * Generates a human-friendly, high-entropy license key in the shape
 * XXXX-XXXX-XXXX-XXXX (uppercase base32-ish alphabet, no ambiguous
 * characters like 0/O or 1/I/L).
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateLicenseKey(): string {
  const groups: string[] = [];

  for (let g = 0; g < 4; g++) {
    let group = "";
    const bytes = randomBytes(4);

    for (let i = 0; i < 4; i++) {
      group += ALPHABET[bytes[i]! % ALPHABET.length];
    }

    groups.push(group);
  }

  return groups.join("-");
}
