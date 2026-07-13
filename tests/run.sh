#!/usr/bin/env bash
# Test-Runner für den ADT Trainer. Grün = auslieferbar.
# Nutzung: bash tests/run.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-8399}"
fail=0

echo "== 1) Syntaxprüfung (node --check) =="
for f in config.js js/sync.js js/app.js sw.js data/questions.js; do
  if node --check "$f"; then echo "  ok: $f"; else echo "  FAIL: $f"; fail=1; fi
done

echo "== 2) Fragen-Datenbank validieren =="
node tests/validate-questions.mjs || fail=1

echo "== 2b) Geprüfte Inhalts-Dateien (content/) validieren =="
for f in content/*.json; do
  [ -e "$f" ] || continue
  if node tools/validate-content.mjs "$f"; then echo "  ok: $f"; else echo "  FAIL: $f"; fail=1; fi
done

echo "== 3) Unit-Tests (sync-Logik) =="
node tests/unit-sync.mjs || fail=1

echo "== 4) E2E-Smoke (Browser) =="
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
sleep 1
BASE="http://localhost:${PORT}/index.html" node tests/e2e-smoke.mjs || fail=1

echo "== 5) Service Worker / Offline =="
BASE="http://localhost:${PORT}/index.html" node tests/sw-cache.mjs || fail=1
kill "$SRV" 2>/dev/null || true

echo "========================================"
if [ "$fail" -eq 0 ]; then
  echo "✅ ALLE TESTS BESTANDEN – auslieferbar."
else
  echo "❌ TESTS FEHLGESCHLAGEN – NICHT ausliefern."
fi
exit "$fail"
