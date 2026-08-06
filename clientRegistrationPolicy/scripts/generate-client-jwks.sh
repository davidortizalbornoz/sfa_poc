#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${SSA_ENV:-$ROOT_DIR/ssa.env}"

load_env() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    return 0
  fi
  return 1
}

if load_env "$ENV_FILE"; then
  :
elif [[ "$ENV_FILE" != "$ROOT_DIR/ssa.env.example" ]] && load_env "$ROOT_DIR/ssa.env.example"; then
  echo "Usando defaults de ssa.env.example (copia a ssa.env para personalizar)" >&2
else
  echo "ERROR: no se encontró archivo de variables: $ENV_FILE" >&2
  echo "Copia ssa.env.example a ssa.env en clientRegistrationPolicy/" >&2
  exit 1
fi

python3 <<'PY'
import base64
import json
import os
import sys
import uuid
from pathlib import Path

try:
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
    )
except ImportError:
    raise SystemExit("Instala cryptography: pip install cryptography")


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Variable requerida no definida: {name}")
    return value


def b64url_int(value: int) -> str:
    byte_length = (value.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(value.to_bytes(byte_length, "big")).rstrip(b"=").decode()


software_id = require("SSA_SOFTWARE_ID")
out_dir = Path("client-jwks") / software_id
out_dir.mkdir(parents=True, exist_ok=True)

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_numbers = private_key.public_key().public_numbers()
kid = f"{software_id.lower()}-{uuid.uuid4().hex[:12]}"

jwks = {
    "keys": [
        {
            "kid": kid,
            "kty": "RSA",
            "alg": "PS256",
            "use": "sig",
            "e": b64url_int(public_numbers.e),
            "n": b64url_int(public_numbers.n),
        }
    ]
}

private_pem = private_key.private_bytes(
    Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
)

(out_dir / "private.pem").write_bytes(private_pem)
(out_dir / "jwks.json").write_text(json.dumps(jwks, indent=2) + "\n")

print(out_dir / "jwks.json")
print(f"kid={kid}", file=sys.stderr)
print(f"private_key={out_dir / 'private.pem'}", file=sys.stderr)
PY
