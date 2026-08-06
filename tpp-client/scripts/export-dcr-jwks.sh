#!/usr/bin/env bash
# Imprime el objeto 'jwks' listo para incluir en el payload de registro DCR.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JWKS_FILE="${FINTECH_A_JWKS_PATH:-$ROOT_DIR/keys/fintech-a/jwks.json}"

echo "=== Campo 'jwks' para DCR (FINTECH-A) ==="
cat "$JWKS_FILE"
