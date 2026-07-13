# Tests

Sicherheitsnetz für den ADT Trainer. **Vor jeder Auslieferung ausführen:**

```bash
bash tests/run.sh
```

Der Runner führt der Reihe nach aus:
1. **Syntaxprüfung** aller JS-Dateien (`node --check`).
2. **Fragen-Validierung** (`validate-questions.mjs`) – IDs, Themen, correct-Indizes, Erklärungen, difficulty.
3. **Unit-Tests** (`unit-sync.mjs`) – reine Logik in `js/sync.js`: Merge, Code-Erzeugung/-Normalisierung, Header-Logik (sb_-Key vs. JWT), Retry, Offline/Pending.
4. **E2E-Smoke** (`e2e-smoke.mjs`, Playwright) – App lädt fehlerfrei, Sanitisierung eines defekten Stands, **Reset leert wirklich** (Regression), Backup-Import mergt, Settings/Info/Themen/Erfolge rendern – ohne Laufzeitfehler.

Exit-Code 0 = alles grün.

## Voraussetzungen
- Node 22, `python3` (statischer Server).
- Playwright/Chromium sind in dieser Umgebung unter `/opt/node22/lib/node_modules/playwright` vorinstalliert.

## Grundsätze
- **Jeder Bugfix bekommt einen Regressionstest.** Jedes neue Feature einen Test.
- Neue Unit-Tests in `unit-*.mjs`, neue Browser-Checks in `e2e-*.mjs`.
