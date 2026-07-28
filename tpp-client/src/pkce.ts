import { createHash, randomBytes } from "node:crypto";
import type { PkcePair } from "./types.js";

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPkcePair(): PkcePair {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest(),
  );

  return { codeVerifier, codeChallenge };
}

export function createState(): string {
  return base64UrlEncode(randomBytes(24));
}
