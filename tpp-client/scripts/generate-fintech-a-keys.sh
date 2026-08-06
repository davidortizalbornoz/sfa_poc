#!/usr/bin/env bash
# Genera par RSA PS256 para FINTECH-A y sincroniza el JWKS embebido usado en DCR.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYS_DIR="$ROOT_DIR/keys/fintech-a"
CLIENT_JWKS_DIR="$ROOT_DIR/../clientRegistrationPolicy/client-jwks/FINTECH-A"
KID="${FINTECH_A_KID:-fintech-a-1}"

mkdir -p "$KEYS_DIR" "$CLIENT_JWKS_DIR"

openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

node --input-type=module <<PY
import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const priv = createPrivateKey(readFileSync("$KEYS_DIR/private.pem"));
const pub = createPublicKey(priv);
const jwk = pub.export({ format: "jwk" });
const jwks = {
  keys: [{
    kid: "$KID",
    kty: jwk.kty,
    alg: "PS256",
    use: "sig",
    e: jwk.e,
    n: jwk.n,
  }],
};
const payload = JSON.stringify(jwks, null, 2);
writeFileSync("$KEYS_DIR/jwks.json", payload);
writeFileSync("$CLIENT_JWKS_DIR/jwks.json", payload);
console.log("Claves generadas en $KEYS_DIR");
console.log("JWKS embebido sincronizado en $CLIENT_JWKS_DIR/jwks.json");
PY

echo ""
echo "Siguiente paso: registrar FINTECH-A via DCR incluyendo el campo 'jwks' del archivo jwks.json."
