import {
  constants,
  createPrivateKey,
  randomBytes,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function base64UrlEncode(value: Buffer | string): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface ClientAssertionOptions {
  clientId: string;
  tokenEndpoint: string;
  privateKey: KeyObject;
  kid: string;
  signingAlg?: "PS256";
}

export function loadPrivateKeyFromPath(path: string): KeyObject {
  const pem = readFileSync(resolve(path), "utf8");
  return createPrivateKey(pem);
}

export function createClientAssertion({
  clientId,
  tokenEndpoint,
  privateKey,
  kid,
  signingAlg = "PS256",
}: ClientAssertionOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: signingAlg,
    typ: "JWT",
    kid,
  };
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    jti: base64UrlEncode(randomBytes(16)),
    iat: now,
    exp: now + 300,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  }).toString("base64url");

  return `${signingInput}.${signature}`;
}
