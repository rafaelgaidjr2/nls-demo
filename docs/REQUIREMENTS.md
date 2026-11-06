# Requirements and implemented scope

## Goal
Demonstrate construction schedule and financial reconciliation without a backend, PostgreSQL or external APIs.

## Functional requirements

| Area | Implemented behavior |
| --- | --- |
| Schedule import | `.xer` text parsed using `%T`, `%F`, `%R`, `%E`; PROJECT, PROJWBS, TASK and TASKPRED normalized |
| Financial import | CSV, XLSX and XLS; worksheet selection and configurable header mapping |
| Normalization | Uppercase trimmed project/cost keys; numeric parsing; default project and currency |
| Validation | Duplicate activity/financial IDs, required financial fields, amounts, dates, project/WBS references, predecessor endpoints/types, duplicate/self/cyclic relationships |
| Matching | Project + mapped activity ID; project + mapped cost code + currency |
| Reconciliation | Missing activity links, cost-code disagreements, unmatched commitment budget keys, budget/actual and commitment variance |
| Tolerances | Greater of absolute tolerance and percentage of absolute budget |
| Revisions | Added, changed and removed records on replacement import |
| Investigation | Source filename, row, full normalized record and action |
| Export | CSV containing findings, source details and retained import differences |
| History | Latest 12 imports, with per-dataset restoration |
| Persistence | Browser tab session storage; no server data sharing |

## Acceptance baseline
The fictional Harbor Point Tower dataset contains 150 activities, five WBS entries, 149 relationships, 80 cost records and 30 commitments. It yields 11 findings: seven errors and four warnings. Known invalid input files must fail before replacing existing records. Mapping and tolerance changes must rerun checks. See TEST_PLAN.md for reproducible steps.

## Explicit exclusions
External API ingestion, user account administration, durable backend storage, CPM calculation, financial posting, currency conversion, collaborative exception management and production audit logging are outside this version.
