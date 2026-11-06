const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const H = require('./dist/core.js');
const XLSX = require('./dist/xlsx.full.min.js');

// Financial formats: validate grouping and signs before stripping formatting.
for (const [input, expected] of [
  ['1,250.50', 1250.5],
  ['$1250', 1250],
  ['₱ 1,250', 1250],
  ['(1,250.50)', -1250.5],
  ['-$ 12.50', -12.5],
  ['$-12.50', -12.5],
  ['.50', 0.5],
  ['0', 0],
  [0, 0],
  ['+12', 12],
])
  assert.equal(H.amount(input), expected, String(input));
for (const input of [
  '1,23',
  '12,34.56',
  '1 2 3',
  '(123',
  '123)',
  '((123))',
  '(-123)',
  '--123',
  '+$-123',
  '12$3',
  '1,234,56',
  '',
  '9'.repeat(400),
  Infinity,
  NaN,
])
  assert.equal(H.amount(input), null, String(input));

function session() {
  return {
    projects: [{ project_id: 'P' }],
    wbs: [],
    activities: [
      { project_id: 'P', id: 'A', internal_id: '1', start: '2026-01-01', finish: '2026-01-02' },
    ],
    relationships: [],
    costs: [],
    commitments: [],
  };
}

// Accepted separators and omitted time components must compare consistently.
for (const [start, finish, reversed] of [
  ['2026-01-01T00:00', '2026-01-01 01:00', false],
  ['2026-01-01 01:00', '2026-01-01T00:00', true],
  ['2026-01-01T00:00:00', '2026-01-01', false],
  ['2026-01-02', '2026-01-01', true],
]) {
  const data = session();
  Object.assign(data.activities[0], { start, finish });
  assert.equal(
    H.run(data).issues.some((issue) => issue.rule === 'DATE_ORDER'),
    reversed,
  );
}

// A long acyclic chain must finish, while cycles and shared predecessors remain correct.
const chain = session();
chain.activities = Array.from({ length: 20000 }, (_, index) => ({
  ...chain.activities[0],
  id: `A${index}`,
  internal_id: String(index),
}));
chain.relationships = chain.activities.slice(1).map((_, index) => ({
  project_id: 'P',
  activity_id: String(index),
  predecessor_project: 'P',
  predecessor_id: String(index + 1),
  type: 'PR_FS',
}));
assert(!H.run(chain).issues.some((issue) => issue.rule === 'RELATIONSHIP_CYCLE'));
chain.relationships.push({
  project_id: 'P',
  activity_id: '19999',
  predecessor_project: 'P',
  predecessor_id: '0',
  type: 'PR_FS',
});
assert(H.run(chain).issues.some((issue) => issue.rule === 'RELATIONSHIP_CYCLE'));

const diamond = session();
diamond.activities = ['A', 'B', 'C', 'D', 'E'].map((id) => ({
  ...diamond.activities[0],
  id,
  internal_id: id,
}));
diamond.relationships = [
  ['A', 'B'],
  ['A', 'C'],
  ['B', 'D'],
  ['C', 'D'],
].map(([activity_id, predecessor_id]) => ({
  project_id: 'P',
  predecessor_project: 'P',
  activity_id,
  predecessor_id,
  type: 'PR_FS',
}));
assert(!H.run(diamond).issues.some((issue) => issue.rule === 'RELATIONSHIP_CYCLE'));
diamond.relationships.push({
  project_id: 'P',
  predecessor_project: 'P',
  activity_id: 'E',
  predecessor_id: 'E',
  type: 'PR_FS',
});
assert(H.run(diamond).issues.some((issue) => issue.rule === 'RELATIONSHIP_CYCLE'));

// Exercise the real application handlers without adding production test exports.
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, { value: '', innerHTML: '' });
  return elements.get(selector);
}
const storage = new Map();
const hub = { ...H };
const context = vm.createContext({
  Hub: hub,
  XLSX,
  console,
  document: { querySelector: element, querySelectorAll: () => [] },
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
});
vm.runInContext(fs.readFileSync(require.resolve('./dist/app.js'), 'utf8'), context);
const execute = (code) => vm.runInContext(code, context);
execute("applyImport('xer', Hub.xer(Hub.sample().xer), 'baseline.xer')");
const before = execute('JSON.stringify({s, results})');
const persisted = storage.get('construction-hub-v1');
const originalRun = hub.run;
hub.run = () => {
  throw Error('Injected reconciliation failure');
};
for (const code of [
  "applyImport('xer', {projects: [], wbs: [], activities: [], relationships: []}, 'replacement.xer')",
  "applyImport('costs', [{record_id: 'NEW'}], 'replacement.csv')",
]) {
  assert.throws(() => execute(code), /Injected reconciliation failure/);
  assert.equal(execute('JSON.stringify({s, results})'), before);
  assert.equal(storage.get('construction-hub-v1'), persisted);
}
hub.run = originalRun;

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.json_to_sheet([{ cost_code: 'C', budget: 100, actual: 0, activity_id: 'A0001' }]),
  'Data',
);
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty');
context.workbook = workbook;
execute(`pending = {kind: 'costs', name: 'book.xlsx', wb: workbook, sheet: 'Data',
  rows: sheetRows(workbook, 'Data')};
  pending.map = H.guess(pending.rows, pending.kind); renderMapping();`);
const previousRows = execute('pending.rows');
element('#sheet').value = 'Empty';
element('#sheet').onchange({ target: { value: 'Empty' } });
assert.equal(element('#sheet').value, 'Data');
assert.equal(execute('pending.sheet'), 'Data');
assert.equal(execute('pending.rows'), previousRows);
assert.match(element('#notice').innerHTML, /Worksheet is empty/);
element('#defaultProject').value = 'HARBOR';
element('#defaultCurrency').value = 'PHP';
element('#confirmMap').onclick();
assert.equal(execute('s.costs[0].budget'), 100);
assert.equal(execute('pending'), null);

console.log(
  'PASS: strict amounts, date ordering, deep graphs, atomic imports and worksheet recovery.',
);
