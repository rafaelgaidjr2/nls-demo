# Import formats

## XER
Tab-separated Primavera tables use `%T` for table name, `%F` for column names, `%R` for rows and `%E` for the end marker. Field counts must match. UTF-8 text with an optional BOM is supported; legacy encodings are not explicitly decoded.

| Table | Fields consumed |
| --- | --- |
| PROJECT | proj_id, proj_short_name |
| PROJWBS | proj_id, wbs_id, wbs_short_name; raw fields retained |
| TASK | proj_id, task_id, task_code, task_name, wbs_id, cost_code; act_start_date/target_start_date/early_start_date; act_end_date/target_end_date/early_end_date |
| TASKPRED | proj_id, task_id, pred_proj_id, pred_task_id, pred_type |

Missing project IDs fall back to the first imported project. For multi-project exports, supply explicit project columns. Relationship types checked: PR_FS, PR_SS, PR_FF, PR_SF. Unavailable external predecessors are flagged.

## Financial canonical columns

Budget/cost files: `record_id,project_id,cost_code,description,budget,actual,activity_id,currency`.

Commitments: `record_id,project_id,cost_code,description,amount,activity_id,currency,type`.

CSV is comma-separated with standard doubled-quote escaping; headers must be nonempty and unique. Rows must have matching widths. XLS/XLSX uses the first worksheet initially; users can select another worksheet before confirming. The first row provides headers. Formula cells rely on available cached workbook values; formulas are not recalculated by the importer.

## Mapping aliases

| Canonical | Suggested aliases |
| --- | --- |
| record_id | record_id, commitment_id, po_number, contract_no, id |
| project_id | project_id, proj_id |
| cost_code | cost_code, code, costcode |
| budget | budget, budget_amount |
| actual | actual, actual_cost, actual_amount |
| amount | amount, committed_amount, value |
| activity_id | activity_id, task_code |
| currency | currency, currency_code |
| description | description, name |
| type | type |

Header guesses lowercase and replace spaces with underscores. Review suggestions before import. A cost-code mapping is required. Supply a project field or default project. Default currency is PHP and applies only to blank/unmapped currency. Missing monetary columns produce validation findings.

## Values
Amounts accept numeric cells and text such as `1,250.50`, `$1250`, `₱1250`, or `(1,250.50)` for negatives. Text amounts require ungrouped digits or comma groups of exactly three digits, with an optional decimal fraction. One leading currency symbol ($, ₱, €, £) and an optional sign are supported in either order; parentheses denote an unsigned negative amount. Spaces may separate the prefix from the number, but not digits within the number. Decimal comma conventions, malformed grouping, unmatched parentheses, multiple signs and non-finite numbers are rejected as null. Empty amounts also become null. Cost codes retain punctuation and leading zeros; only case and surrounding whitespace normalize. Excel numeric cells may already have lost leading zeros, so identifier columns should be text.

## Reconciliation mappings
Enter one `source=target` pair per line, for example `C-999=C-004` and `A9999=A0005`. Aliases apply across projects in the session and resolve in one step. Project IDs are controlled by imported columns/defaults, not a separate project-alias editor.

## Report
The exported report includes phase, severity, rule, project, record, source, row, detail, action and normalized source JSON. Retained revision differences are appended. Reports export all findings, regardless of visible severity/search filters. Values beginning with =, +, @ or - receive a leading apostrophe to reduce spreadsheet formula execution risk.
