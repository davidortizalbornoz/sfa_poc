#!/usr/bin/env bash
set -euo pipefail

SFA_BASE="${SFA_BASE:-http://sfa.localtest.me:8080}"
BCI_USER="${BCI_USER:-ana-rodriguez}"
BCI_PASS="${BCI_PASS:-ana-rodriguez-local-dev}"
SFA_COOKIES=/tmp/sfa_broker_cookies.txt
BCI_COOKIES=/tmp/bci_broker_cookies.txt
rm -f "$SFA_COOKIES" "$BCI_COOKIES"

echo "=== Step 1: Open account console ($SFA_BASE) ==="
curl -sS -c "$SFA_COOKIES" -b "$SFA_COOKIES" -L -o /tmp/broker_s1.html \
  "${SFA_BASE}/realms/sfa-poc/account" >/dev/null

BROKER=$(grep -o 'href="/realms/sfa-poc/broker/bci-idp/login[^"]*"' /tmp/broker_s1.html | head -1 | sed 's/href="//;s/"$//;s/&amp;/\&/g')
if [[ -z "${BROKER:-}" ]]; then
  echo "ERROR: BCI IDP link not found"
  grep -iE 'error|title' /tmp/broker_s1.html | head -5
  exit 1
fi
echo "Broker link: $BROKER"

echo "=== Step 2: Start broker login ==="
curl -sS -c "$SFA_COOKIES" -b "$SFA_COOKIES" -c "$BCI_COOKIES" -b "$BCI_COOKIES" -L -o /tmp/broker_s2.html \
  "${SFA_BASE}${BROKER}" >/dev/null

echo "BCI page URL would be on remote host"
grep -o 'action="[^"]*"' /tmp/broker_s2.html | head -1 | sed 's/&amp;/\&/g' | head -c 120; echo "..."

ACTION=$(grep -o 'action="[^"]*"' /tmp/broker_s2.html | head -1 | sed 's/action="//;s/"$//;s/&amp;/\&/g')

echo "=== Step 3: Submit credentials ($BCI_USER) ==="
CALLBACK=$(curl -sS -c "$SFA_COOKIES" -b "$SFA_COOKIES" -c "$BCI_COOKIES" -b "$BCI_COOKIES" \
  -o /dev/null -w '%{redirect_url}' -X POST "$ACTION" \
  -d "username=${BCI_USER}" \
  -d "password=${BCI_PASS}" \
  -d 'credentialId=')
echo "Callback: ${CALLBACK:0:150}..."

echo "=== Step 4: Callback WITH sfa cookies ==="
curl -sS -b "$SFA_COOKIES" -L -o /tmp/broker_ok.html -w 'Final: %{url_effective} HTTP:%{http_code}\n' "$CALLBACK"
grep -iE 'error|Restart|cookie|title|instruction|kc-error' /tmp/broker_ok.html | head -10 || true
