CONSTRUCTION DATA RECONCILIATION HUB — TEST FILES
All records are fictional. Currency defaults to PHP.

QUICK START
1. Clear the app session for a reproducible baseline.
2. Data Imports > Primavera schedule: upload harbor-point.xer.
3. Budgets & actual costs: upload harbor-costs.csv; review mappings and confirm.
4. Purchase orders & contracts: upload harbor-commitments.csv; review mappings and confirm.
5. Check Dashboard, Validation and Reconciliation.
Expected totals: 150 activities, 80 cost records, 30 commitments.
Expected exceptions: 11 (7 errors, 4 warnings).
expected-exceptions.csv lists the expected rules and findings.

EXCEL TEST
harbor-financials.xlsx and harbor-financials.xls contain two sheets:
- Budgets: select when importing budgets and actual costs (80 records).
- Commitments: select when importing commitments (30 records).
Use these instead of the equivalent CSV files. Each import replaces its dataset.

DELIBERATE FINDINGS
- A0014: finish precedes start.
- A0023: impossible date, February 30.
- Activity 18: predecessor 999 is missing.
- B-9: invalid budget amount.
- PO-4: C-999 differs from its activity's C-004; unmatched budget code.
- PO-5: unknown activity A9999.
- PO-9: duplicate commitment identifier.
- PO-7: USD commitment has no matching USD budget (PHP is not converted).
- B-2: commitments exceed budget.
- B-6: actual expenditure exceeds budget.

MAPPINGS TEST
Reconciliation > cost code mappings: C-999=C-004
Activity mappings: A9999=A0005
Apply & rerun. Expected exceptions drop from 11 to 8.
Set absolute tolerance to 60000 to remove the B-2 over-commitment warning.
It does not remove B-6's actual-over-budget warning (variance 74000).

SUCCESSIVE IMPORT TEST
After the baseline, upload harbor-costs-revised.csv as budgets and actual costs.
Expected: B-1 budget changes from 101000 to 125000; B-80 removed; B-81 added.
Import History should show 3 differences. expected-import-changes.csv lists them.
Use Restore dataset on the earlier cost import to return to the baseline.

MALFORMED FILE TESTS
malformed.xer: record appears before a field declaration. Import should fail.
malformed.csv: unclosed quoted field. Import should fail.
Failed parsing should preserve the previously imported dataset.

EXPORT TEST
Export exceptions from Validation or Reconciliation. Open the downloaded CSV:
it should include severity, rule, project, source file, row, finding, action,
and the source record. Import differences are included if present.

SESSION NOTE
Data remains in this browser tab through refresh. Closing the tab clears its
session. Different browser profiles/tabs have separate working sessions.
