# Test plan

## Automated
Run `npm run check` and `npm test`. The suite covers 150 activities, five WBS entries, 149 predecessor records, 80 cost records, 30 commitments, known rule categories, alias/tolerance effects, malformed XER/CSV, invalid calendar dates, parenthesized money, quoted CSV, changed imports, XLSX/XLS read/write and exception CSV round-trip/formula-prefix escaping. Tests generate baseline fixture files in place. `regression.cjs` additionally checks strict monetary syntax and non-finite values, mixed date formats, a 20,000-activity chain, cycles and shared predecessors, rollback after injected reconciliation failures, and recovery after selecting an empty worksheet. UI-handler tests execute app.js in a Node VM with a minimal DOM adapter and the real Excel parser; they do not replace browser acceptance tests.

## Manual acceptance

| Test | Steps | Expected |
| --- | --- | --- |
| Empty state | Open a fresh session | Empty tables and invitation to import/load sample |
| Sample | Load Sample Project | 150 / 80 / 30 records; 11 exceptions |
| File ingestion | Clear session; upload baseline XER and two CSV files; confirm financial mapping | Same baseline totals and findings |
| Excel | Import Budgets and Commitments sheets through their corresponding upload cards | Same counts as CSV |
| Investigation | Open DATE_ORDER finding | A0014, source filename, row and normalized record |
| Aliases | Set C-999=C-004 and A9999=A0005 | Findings reduce from 11 to 8 |
| Tolerance | After aliases, set absolute 60000 | B-2 commitment warning clears; B-6 actual warning remains |
| Revisions | Import harbor-costs-revised.csv after baseline | B-1 changed, B-80 removed, B-81 added; 3 differences |
| Restore | Restore earlier cost dataset from history | Baseline budgets return; checks rerun |
| Malformed | Upload malformed.xer and malformed.csv | Error notice; previous dataset remains |
| Search/filter | Search activity ID, change dataset, filter severity | Correct rows; pagination resets |
| Persistence | Refresh tab | Session restored |
| Export | Export exceptions | CSV with source details and any retained revision differences |
| Responsive | Narrow browser window | Scrollable navigation/tables; readable controls |

The original version was browser-checked for sample loading, investigation, mapping navigation and refresh persistence. This export reruns logic and syntax checks; it does not claim every manual test was browser-automated.

## Baseline findings
DATE_ORDER (1), INVALID_DATE (1), BROKEN_RELATIONSHIP (1), INVALID_AMOUNT (1), COST_CODE_INCONSISTENCY (1), UNMATCHED_ACTIVITY (1), DUPLICATE_RECORD (1), UNMATCHED_COST_CODE (2), OVER_COMMITTED (1), ACTUAL_OVER_BUDGET (1). See test-files/expected-exceptions.csv.
