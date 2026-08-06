#!/usr/bin/env bash
# Verifica que private.pem corresponde al JWKS embebido registrado en Keycloak.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYS_DIR="${FINTECH_A_KEYS_DIR:-$ROOT_DIR/keys/fintech-a}"

node --input-type=module <<PY
import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const keysDir = resolve("$KEYS_DIR");
const priv = createPrivateKey(readFileSync(resolve(keysDir, "private.pem")));
const pub = createPublicKey(priv);
const jwk = pub.export({ format: "jwk" });
const registered = JSON.parse(readFileSync(resolve(keysDir, "jwks.json"), "utf8")).keys[0];

if (jwk.n !== registered.n || jwk.e !== registered.e) {
  console.error("ERROR: private.pem no coincide con jwks.json");
  process.exit(1);
}

console.log("OK: private.pem coincide con jwks.json");
console.log(\`kid: \${registered.kid}\`);
PY
