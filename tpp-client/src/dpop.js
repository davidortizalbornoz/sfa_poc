import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function toPublicJwk(jwk) {
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
  };
}

export function computeJwkThumbprint(jwk) {
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  return createHash("sha256").update(canonical).digest("base64url");
}

export function createDpopKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  const exported = publicKey.export({ format: "jwk" });
  const publicJwk = toPublicJwk(exported);

  return {
    privateKey,
    publicJwk,
    dpopJkt: computeJwkThumbprint(publicJwk),
  };
}

export function createDpopProof({
  privateKey,
  publicJwk,
  method,
  url,
  accessToken,
  nonce,
}) {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: publicJwk,
  };

  const target = new URL(url);
  target.search = "";
  target.hash = "";

  const payload = {
    jti: base64UrlEncode(randomBytes(16)),
    htm: method.toUpperCase(),
    htu: target.toString(),
    iat: Math.floor(Date.now() / 1000),
  };

  if (accessToken) {
    payload.ath = createHash("sha256")
      .update(accessToken)
      .digest("base64url");
  }

  if (nonce) {
    payload.nonce = nonce;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `${signingInput}.${signature}`;
}
