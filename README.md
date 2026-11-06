# Construction Data Reconciliation Hub

Interactive, browser-side demonstration for importing Primavera P6 XER schedules, budgets, actual costs, purchase orders and contracts; validating data; and investigating reconciliation exceptions.

## Quick start

Requires Node.js 22 or newer. No dependency installation, API key, database or build step is required.

```sh
npm start
```

Open http://localhost:8080. Set `PORT` to use another port. The development server binds to localhost. Alternatively, serve `dist/` with any static web server.

```sh
npm run check
npm test
```

Tests generate baseline fixtures in `test-files/` and verify parsers, known findings, mappings, tolerances, comparison logic and CSV serialization. They are logic tests, not browser automation.

## Try the demo

Click **Load Sample Project**, or import these files through **Data Imports**:

1. `test-files/harbor-point.xer` — Primavera schedule.
2. `test-files/harbor-costs.csv` — budgets and actual costs; review mapping, then confirm.
3. `test-files/harbor-commitments.csv` — commitments; review mapping, then confirm.

Expected baseline: **150 activities, 80 cost records, 30 commitments, 11 exceptions**. The Excel workbooks provide equivalent `Budgets` and `Commitments` sheets. Upload each sheet through its corresponding import card. `test-files/README.txt` explains mapping, revision and malformed-file tests.

Use **Investigate** to inspect the source row. Edit code/activity mappings and budget tolerances under **Reconciliation**, then apply and rerun. Export the exception report as CSV. Importing a new file replaces that dataset; the last 12 imports can be restored from **Import History**.

## Application views

Dashboard; Data Imports; Schedule Explorer; Cost & Commitments; Validation; Reconciliation; Import History.

## Repository layout

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Application shell and accessible controls |
| `dist/app.js` | UI, file ingestion, field mapping, session state, history and downloads |
| `dist/core.js` | Parsers, normalization, validation, reconciliation and comparison logic |
| `dist/style.css` | Responsive enterprise interface |
| `dist/xlsx.full.min.js` | Vendored SheetJS CE 0.18.5 browser bundle |
| `test.cjs` | Automated logic tests and baseline fixture generation |
| `regression.cjs` | Amount/date, deep-graph and import-handler regressions |
| `test-files/` | Fictional upload files and expected results |
| `scripts/serve.cjs` | Dependency-free local development server |
| `docs/` | Requirements, architecture, data formats, testing and deployment |
| `.github/` | CI, optional GitHub Pages deployment, issue and PR templates |

`dist/` is the editable application source as well as the static hosting directory; there is no separate compiled frontend. The third-party Excel bundle remains minified. The application source was originally exported from deployed Sites version 1, commit `d490325f8cfb3f54f845a763132f7e30f6def1c6`, and now includes local correctness fixes and readable formatting. Repository tooling and documentation were added for this export. Site credentials, Git metadata and project-specific hosting identity are excluded.

## Documentation

- [Requirements and scope](docs/REQUIREMENTS.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Import formats and mapping](docs/DATA_FORMATS.md)
- [Test plan](docs/TEST_PLAN.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security and privacy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Upload to GitHub

Extract this archive and create an empty GitHub repository, then run from the extracted project folder:

```sh
git init -b main
git add .
git commit -m "Initial construction reconciliation hub"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

CI runs automatically on pushes and pull requests. GitHub Pages deployment is optional and manual; see the deployment guide. No GitHub repository has been created by this export.

## Current limits

Data processing is synchronous in the browser. The upload limit is 15 MB, but large or complex workbooks/schedules can still exhaust memory or block the UI. Storage is `sessionStorage`, restored on refresh within the tab; it is not a durable, authenticated multi-user database. New windows may initially copy opener session storage, so tabs are not a security boundary. Do not use shared browser profiles for sensitive imports.

The app checks data consistency, not CPM scheduling or accounting correctness. It does not recalculate dates, perform exchange-rate conversion, resolve external-project relationships, or provide approval/audit workflows. Duplicate financial rows remain in totals until corrected. Monetary values use JavaScript numbers. See the technical design for further assumptions and production work.

## Licensing

No open-source license has been selected for the application; `LICENSE` reserves rights pending that decision. Choose a license before inviting public reuse. The vendored Excel library retains its Apache-2.0 license separately.
