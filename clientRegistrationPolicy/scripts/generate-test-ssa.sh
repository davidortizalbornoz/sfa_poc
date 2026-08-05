#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 <<'PY'
import base64, json, time, subprocess
from pathlib import Path

try:
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
except ImportError:
    raise SystemExit("Instala cryptography: pip install cryptography")

keys = Path("test-keys")
priv = load_pem_private_key(keys.joinpath("directory-private.pem").read_bytes(), password=None)

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

claims = {
    "iss": "https://directorio-qa.finanzasabiertas.cl",
    "iat": int(time.time()),
    "software_id": "SW-TPP-DEMO-001",
    "organisation_id": "ORG-TPP-001",
    "software_jwks_uri": "https://tpp-demo.localtest.me/.well-known/jwks.json",
    "software_client_name": "TPP Demo SFA POC",
    "redirect_uris": ["http://localhost:3000/callback"],
    "software_version": "1.0.0",
}
header = {"alg": "PS256", "kid": "sfa-poc-directory-1", "typ": "JWT"}
h = b64url(json.dumps(header, separators=(",", ":")).encode())
p = b64url(json.dumps(claims, separators=(",", ":")).encode())
signing_input = f"{h}.{p}".encode()
sig = priv.sign(
    signing_input,
    padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32),
    hashes.SHA256(),
)
ssa = f"{h}.{p}.{b64url(sig)}"
out = keys / "sample-software-statement.jwt"
out.write_text(ssa)
print(out)
PY
