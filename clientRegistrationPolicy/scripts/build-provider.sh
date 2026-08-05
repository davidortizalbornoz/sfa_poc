#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v mvn >/dev/null 2>&1; then
  mvn -q test package
else
  docker run --rm \
    -v "$ROOT_DIR/clientRegistrationPolicy:/work" \
    -w /work \
    maven:3.9-eclipse-temurin-17 \
    mvn -q test package
fi

echo "Provider JAR:"
ls -1 target/sfa-software-statement-policy-*.jar
