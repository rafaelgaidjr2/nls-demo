const assert = require('node:assert/strict'),
  fs = require('fs'),
  H = require('./dist/core.js'),
  XLSX = require('./dist/xlsx.full.min.js');
const f = H.sample();
fs.mkdirSync('test-files', { recursive: true });
fs.writeFileSync('test-files/harbor-point.xer', f.xer);
fs.writeFileSync('test-files/harbor-costs.csv', f.costs);
fs.writeFileSync('test-files/harbor-commitments.csv', f.commitments);
const schedule = H.xer(f.xer);
assert.equal(schedule.activities.length, 150);
assert.equal(schedule.wbs.length, 5);
assert.equal(schedule.relationships.length, 149);
let s = { ...schedule };
for (const kind of ['costs', 'commitments']) {
  let rows = H.csv(f[kind]);
  s[kind] = H.finance(rows, kind, H.guess(rows, kind), kind + '.csv', 'HARBOR', 'PHP');
}
assert.equal(s.costs.length, 80);
assert.equal(s.commitments.length, 30);
let r = H.run(s);
let rules = new Set(r.issues.map((i) => i.rule));
for (let rule of [
  'INVALID_DATE',
  'DATE_ORDER',
  'BROKEN_RELATIONSHIP',
  'INVALID_AMOUNT',
  'DUPLICATE_RECORD',
  'UNMATCHED_ACTIVITY',
  'UNMATCHED_COST_CODE',
  'OVER_COMMITTED',
  'ACTUAL_OVER_BUDGET',
])
  assert(rules.has(rule), rule);
let mapped = H.run(s, {
  codeMap: { 'C-999': 'C-004' },
  activityMap: { A9999: 'A0005' },
  absolute: 1000000,
});
assert(
  mapped.issues.filter((i) => i.rule === 'UNMATCHED_COST_CODE').length <
    r.issues.filter((i) => i.rule === 'UNMATCHED_COST_CODE').length,
);
assert(!mapped.issues.some((i) => i.rule === 'OVER_COMMITTED'));
assert.throws(() => H.xer('%T\tTASK\n%R\tx\n%E'));
assert.throws(() => H.csv('a,b\n"unclosed,b'));
assert.equal(H.validDate('2026-02-30'), false);
assert.equal(H.amount('(1,250.50)'), -1250.5);
assert.equal(H.amount('abc'), null);
assert.equal(H.csv('a,b\n"one,two","x""y"')[0].b, 'x"y');
let revised = s.costs.map((r) => ({ ...r }));
revised[0].budget += 100;
assert(H.compare(s.costs, revised, 'costs').some((r) => r.change === 'Changed'));
let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(H.csv(f.costs)), 'Budgets');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(H.csv(f.commitments)), 'Commitments');
fs.writeFileSync(
  'test-files/harbor-financials.xlsx',
  XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
);
fs.writeFileSync(
  'test-files/harbor-financials.xls',
  XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }),
);
for (let ext of ['xlsx', 'xls']) {
  let book = XLSX.read(fs.readFileSync('test-files/harbor-financials.' + ext), { type: 'buffer' });
  let rows = XLSX.utils.sheet_to_json(book.Sheets.Budgets, { defval: '' });
  assert.equal(
    H.finance(rows, 'costs', H.guess(rows, 'costs'), 'test', 'HARBOR', 'PHP').length,
    80,
  );
}
let csv = H.exportCSV([['rule', 'detail'], ...r.issues.map((i) => [i.rule, i.detail])]);
assert.equal(H.csv(csv).length, r.issues.length);
assert(H.exportCSV([['=HYPERLINK("x")']]).includes("'=HYPERLINK"));
fs.writeFileSync('test-files/expected-exceptions.csv', csv);
fs.writeFileSync('test-files/malformed.xer', '%T\tTASK\n%R\tmissing-fields\n%E');
console.log(
  'PASS: XER, CSV, XLSX, XLS, validations, mappings, tolerances, comparisons and export. Findings:',
  r.issues.length,
);
require('./regression.cjs');
