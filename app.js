// Session state and DOM helpers.
const H = Hub,
  $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const blank = () => ({
  projects: [],
  wbs: [],
  activities: [],
  relationships: [],
  costs: [],
  commitments: [],
  history: [],
  changes: [],
  settings: { absolute: 0, percent: 0, codeMap: {}, activityMap: {} },
});
let s = blank(),
  view = 'Dashboard',
  dataset = 'activities',
  costset = 'costs',
  query = '',
  severity = 'all',
  page = 0,
  pending = null,
  results = { issues: [], groups: [] };
const STORE = 'construction-hub-v1';
try {
  let saved = sessionStorage.getItem(STORE);
  if (saved) s = JSON.parse(saved);
} catch {}
let pages = [
    'Dashboard',
    'Data Imports',
    'Schedule Explorer',
    'Cost & Commitments',
    'Validation',
    'Reconciliation',
    'Import History',
  ],
  icons = ['▦', '↥', '▤', '▣', '◇', '⇄', '◷'];
function persist() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    notice('Session storage is full. Data remains available until this page closes.', true);
  }
}
function notice(msg, bad = false) {
  $('#notice').innerHTML = /* HTML */ `<div class="notice ${bad ? 'bad' : ''}">${esc(msg)}</div>`;
}
function evaluate() {
  results = H.run(s, s.settings);
  persist();
}
function go(v) {
  view = v;
  query = '';
  page = 0;
  render();
}
function badge(v) {
  return /* HTML */ `<span class="badge ${v}">${esc(v.toUpperCase())}</span>`;
}
function download(name, text, type = 'text/csv') {
  let u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function exportIssues() {
  let rows = [
    [
      'phase',
      'severity',
      'rule',
      'project',
      'record',
      'source',
      'row',
      'detail',
      'action',
      'source_record',
    ],
    ...results.issues.map((r) => [
      r.phase,
      r.severity,
      r.rule,
      r.project,
      r.record,
      r.source,
      r.row,
      r.detail,
      r.action,
      r.snapshot,
    ]),
    ...s.changes.map((r) => [
      'import comparison',
      'info',
      r.change,
      '',
      r.record,
      r.source,
      '',
      r.detail,
      'Review successive import',
      '',
    ]),
  ];
  download('construction-exceptions.csv', H.exportCSV(rows));
  notice('Exception report exported with source details and import changes.');
}
// Shared table rendering, followed by the seven workspace views.
function table(rows, cols, opts = {}) {
  if (!rows.length)
    return '<div class="empty"><b>No records to display</b>Load a sample project or import files to begin.</div>';
  let filtered = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),
    limit = 50,
    total = filtered.length;
  page = Math.min(page, Math.max(0, Math.ceil(total / limit) - 1));
  let part = opts.all ? filtered : filtered.slice(page * limit, (page + 1) * limit);
  return /* HTML */ `<div class="tablewrap">
      <table>
        <thead>
          <tr>
            ${cols.map((c) => /* HTML */ `<th>${esc(c[1] || c[0])}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${part
            .map(
              (r) =>
                /* HTML */ `<tr>
                  ${cols
                    .map((c) => /* HTML */ `<td>${c[2] ? c[2](r[c[0]], r) : esc(r[c[0]])}</td>`)
                    .join('')}
                </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    ${opts.all
      ? ''
      : /* HTML */ `<div class="pagination">
          <span
            >${total ? page * limit + 1 : 0}–${Math.min((page + 1) * limit, total)} of ${total}
            records</span
          >
          <div class="actions">
            <button id="prev" ${page === 0 ? 'disabled' : ''}>← Previous</button
            ><button id="next" ${(page + 1) * limit >= total ? 'disabled' : ''}>Next →</button>
          </div>
        </div>`}`;
}
const issueCols = [
  ['severity', 'Severity', badge],
  [
    'rule',
    'Exception',
    (v) => /* HTML */ `<span class="mono">${esc(v.replaceAll('_', ' '))}</span>`,
  ],
  ['record', 'Record'],
  ['source', 'Source'],
  [
    'detail',
    'Finding',
    (v) =>
      /* HTML */ `<span title="${esc(v)}">${esc(v.length > 70 ? v.slice(0, 70) + '…' : v)}</span>`,
  ],
  [
    'rule',
    '',
    (_, r) =>
      /* HTML */ `<button class="link investigate" data-index="${results.issues.indexOf(r)}">
        Investigate ↗
      </button>`,
  ],
];
function toolbar(extra = '') {
  return /* HTML */ `<div class="toolbar">
    <input
      id="search"
      type="search"
      aria-label="Search records"
      placeholder="Search records…"
      value="${esc(query)}"
    />${extra}<span class="muted">Search all imported records</span>
  </div>`;
}
function dashboard() {
  let n = results.issues.filter((r) => r.severity === 'error').length,
    w = results.issues.filter((r) => r.severity === 'warning').length,
    rec = results.issues.filter((r) => r.phase === 'reconciliation'),
    pct = s.activities.length
      ? Math.max(
          0,
          Math.round(
            100 *
              (1 -
                new Set(
                  results.issues
                    .filter((r) => r.phase === 'validation')
                    .map((r) => r.source + '|' + r.row),
                ).size /
                  (s.activities.length + s.costs.length + s.commitments.length)),
          ),
        )
      : 0;
  return /* HTML */ `${!s.history.length
      ? /* HTML */ `<div class="intro">
          <b>Your project data, connected.</b>
          <p>
            Bring schedules, budgets and commitments together. Start with Harbor Point Tower, a
            fictional project with deliberate exceptions, or upload your own exports.
          </p>
          <button class="primary" id="emptySample">Load Sample Project</button>
        </div>`
      : ''}
    <div class="cards">
      ${[
        ['Schedule activities', s.activities.length, 'From Primavera P6 XER', '▤'],
        ['Cost records', s.costs.length, 'Budgets & actual expenditure', '▣'],
        ['Commitments', s.commitments.length, 'Purchase orders & contracts', '⇄'],
        ['Open exceptions', n + w, `${n} errors · ${w} warnings`, '◇'],
      ]
        .map(
          ([l, v, f, i]) =>
            /* HTML */ `<div class="card">
              <div class="label">${l}<span class="miniicon">${i}</span></div>
              <div class="number">${v}</div>
              <div class="footnote">${f}</div>
            </div>`,
        )
        .join('')}
    </div>
    <div class="two">
      <div class="panel">
        <div class="split">
          <h2>Data quality overview</h2>
          ${badge(s.history.length ? 'ok' : 'info')}
        </div>
        <div class="health">
          <div class="ring" style="--pct:${pct}%">
            <div>${pct}%<small>RECORD QUALITY</small></div>
          </div>
          <div class="legend">
            <div><span>Validation errors</span><b>${n}</b></div>
            <div><span>Warnings to review</span><b>${w}</b></div>
            <div>
              <span>Sources imported</span
              ><b>${[s.activities, s.costs, s.commitments].filter((a) => a.length).length} / 3</b>
            </div>
          </div>
        </div>
        <div class="callout">
          ${s.history.length
            ? 'Validation and reconciliation use the current mappings. Investigate exceptions to review source rows and recommended actions.'
            : 'No data imported yet. Upload an XER schedule and financial exports to establish your project baseline.'}
        </div>
      </div>
      <div class="panel">
        <div class="split">
          <h2>Reconciliation status</h2>
          <span class="muted">CURRENT SESSION</span>
        </div>
        ${[
          [
            'Matched commitments',
            s.commitments.filter((r) => !rec.some((i) => i.source === r.source && i.row === r._row))
              .length,
            s.commitments.length,
          ],
          [
            'Within budget',
            results.groups.filter((g) => g.status === 'Within tolerance').length,
            results.groups.length,
          ],
          ['Imports completed', s.history.length, s.history.length],
        ]
          .map(
            ([l, v, t]) =>
              /* HTML */ `<div class="barrow">
                <span>${l}</span>
                <div class="bar"><i style="width:${t ? (v / t) * 100 : 0}%"></i></div>
                <b>${v}</b>
              </div>`,
          )
          .join('')}
        <p style="margin-top:28px">
          Last check: ${s.history.length ? 'current data evaluated' : 'awaiting data'}
        </p>
        <button id="dashRun" style="width:100%;margin-top:8px">↻ Run reconciliation</button>
      </div>
    </div>
    <div class="panel">
      <div class="split">
        <div>
          <h2>Exceptions requiring attention</h2>
          <p>Prioritized findings across your imported sources</p>
        </div>
        <button id="allExceptions">View all exceptions →</button>
      </div>
      ${table(results.issues.filter((r) => r.severity !== 'info').slice(0, 5), issueCols, {
        all: true,
      })}
    </div>`;
}
function imports() {
  return /* HTML */ `<div class="panel" style="margin-top:0">
      <div class="split">
        <div>
          <h2>Import your project data</h2>
          <p>
            Each upload replaces its dataset. Previous imports remain available for comparison and
            restoration.
          </p>
        </div>
        <button id="fixtures">Download test files</button>
      </div>
      <div class="uploadgrid">
        ${[
          [
            'xer',
            'Primavera schedule',
            'XER · projects, WBS, activities and relationships',
            '.xer',
          ],
          [
            'costs',
            'Budgets & actual costs',
            'CSV / Excel · configurable field mapping',
            '.csv,.xlsx,.xls',
          ],
          [
            'commitments',
            'Purchase orders & contracts',
            'CSV / Excel · commitments and contract values',
            '.csv,.xlsx,.xls',
          ],
        ]
          .map(
            ([k, t, d, a]) =>
              /* HTML */ `<div class="upload">
                <div class="symbol">${k === 'xer' ? '▤' : '↥'}</div>
                <h2>${t}</h2>
                <p>${d}</p>
                <label>Choose a file<input type="file" id="file-${k}" accept="${a}" /></label>
              </div>`,
          )
          .join('')}
      </div>
      <div class="callout" style="margin-top:20px">
        Data stays in this browser tab and is restored on refresh using session storage. Tabs and
        browser profiles have separate sessions. Close the tab or clear the session to remove
        imported data. No shared server database.
      </div>
    </div>
    <div id="mapping"></div>
    <div class="panel">
      <div class="split">
        <h2>Session management</h2>
        <button id="clear">Clear session</button>
      </div>
      <p>
        Maximum file size: 15 MB. XER must contain PROJECT, TASK and a valid %E marker. Excel
        workbooks can contain multiple worksheets; select the sheet before mapping.
      </p>
    </div>`;
}
function explorer() {
  let names = {
      activities: 'Activities',
      projects: 'Projects',
      wbs: 'Work breakdown structure',
      relationships: 'Predecessor relationships',
    },
    cols = {
      activities: [
        ['project_id', 'Project'],
        ['id', 'Activity ID'],
        ['name', 'Activity name'],
        ['wbs', 'WBS'],
        ['start', 'Start'],
        ['finish', 'Finish'],
        ['cost_code', 'Cost code'],
      ],
      projects: [
        ['project_id', 'Project'],
        ['proj_short_name', 'Name'],
        ['source', 'Source'],
      ],
      wbs: [
        ['project_id', 'Project'],
        ['wbs_id', 'WBS ID'],
        ['wbs_short_name', 'WBS'],
        ['wbs_name', 'Name'],
      ],
      relationships: [
        ['project_id', 'Project'],
        ['activity_id', 'Successor internal ID'],
        ['predecessor_id', 'Predecessor internal ID'],
        ['type', 'Relationship'],
      ],
    };
  return /* HTML */ `<div class="panel" style="margin-top:0">
    <div class="split">
      <h2>Schedule records</h2>
      <select id="dataset">
        ${Object.entries(names)
          .map(
            ([v, l]) =>
              /* HTML */ `<option value="${v}" ${dataset === v ? 'selected' : ''}>${l}</option>`,
          )
          .join('')}
      </select>
    </div>
    ${toolbar()}${table(s[dataset], cols[dataset])}
  </div>`;
}
function costs() {
  return /* HTML */ `<div class="panel" style="margin-top:0">
    <div class="split">
      <h2>Financial records</h2>
      <select id="costset">
        <option value="costs" ${costset === 'costs' ? 'selected' : ''}>
          Budgets & actual costs
        </option>
        <option value="commitments" ${costset === 'commitments' ? 'selected' : ''}>
          Commitments
        </option>
      </select>
    </div>
    ${toolbar()}${table(s[costset], [
      ['record_id', 'Record'],
      ['project_id', 'Project'],
      ['cost_code', 'Cost code'],
      ['description', 'Description'],
      ...(costset === 'costs'
        ? [
            ['budget', 'Budget'],
            ['actual', 'Actual'],
          ]
        : [
            ['amount', 'Amount'],
            ['type', 'Type'],
          ]),
      ['currency', 'Currency'],
      ['activity_id', 'Activity'],
      ['source', 'File'],
      ['_row', 'Row'],
    ])}
  </div>`;
}
function mappingText(o) {
  return Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}
function exceptions(phase) {
  return /* HTML */ `${phase === 'reconciliation'
      ? /* HTML */ `<div class="panel" style="margin-top:0">
            <div class="split">
              <div>
                <h2>Matching rules & tolerances</h2>
                <p>
                  Matches are scoped by project, mapped cost code and currency. No currency
                  conversion is assumed.
                </p>
              </div>
              <button class="primary" id="apply">Apply & rerun</button>
            </div>
            <div class="settinggrid">
              <div>
                <label
                  >Cost code mappings · source=target, one per line<textarea
                    id="codeMap"
                    placeholder="C-999=C-004"
                  >
${esc(mappingText(s.settings.codeMap))}</textarea
                  >
                </label>
              </div>
              <div>
                <label
                  >Activity mappings · source=target, one per line<textarea
                    id="activityMap"
                    placeholder="A9999=A0005"
                  >
${esc(mappingText(s.settings.activityMap))}</textarea
                  >
                </label>
              </div>
            </div>
            <div class="formgrid">
              <label
                >Absolute tolerance<input
                  type="number"
                  id="absolute"
                  min="0"
                  step="0.01"
                  value="${s.settings.absolute}" /></label
              ><label
                >Percentage tolerance<input
                  type="number"
                  id="percent"
                  min="0"
                  step="0.1"
                  value="${s.settings.percent}"
              /></label>
            </div>
            <p>
              The larger absolute or percentage tolerance applies. Invalid values are reported and
              excluded from totals. Duplicate rows remain included until corrected.
            </p>
          </div>
          <div class="panel">
            <div class="split">
              <h2>Budget vs commitments</h2>
              <span class="muted">By project · code · currency</span>
            </div>
            ${table(
              results.groups,
              [
                ['project', 'Project'],
                ['cost_code', 'Mapped code'],
                ['currency', 'Currency'],
                ['budget', 'Budget'],
                ['actual', 'Actual'],
                ['committed', 'Committed'],
                ['variance', 'Variance'],
                [
                  'status',
                  'Status',
                  (v) =>
                    /* HTML */ `<span class="badge ${v === 'Within tolerance' ? 'ok' : 'warning'}"
                      >${esc(v)}</span
                    >`,
                ],
              ],
              { all: true },
            )}
          </div>`
      : ''}
    <div class="panel" ${phase === 'validation' ? 'style="margin-top:0"' : ''}>
      <div class="split">
        <div>
          <h2>${phase === 'validation' ? 'Validation findings' : 'Reconciliation exceptions'}</h2>
          <p>Open a finding to inspect its source row and suggested action.</p>
        </div>
        <div class="actions">
          <button id="run">↻ Run checks</button><button id="export">↓ Export exceptions</button>
        </div>
      </div>
      ${toolbar(
        /* HTML */ `<select id="severity">
          <option value="all">All severities</option>
          ${['error', 'warning', 'info']
            .map((v) => /* HTML */ `<option ${severity === v ? 'selected' : ''}>${v}</option>`)
            .join('')}
        </select>`,
      )}${table(
        results.issues.filter(
          (r) => r.phase === phase && (severity === 'all' || r.severity === severity),
        ),
        issueCols,
      )}
    </div>`;
}
function history() {
  return /* HTML */ `<div class="panel" style="margin-top:0">
      <div class="split">
        <h2>Import history</h2>
        <span class="muted">Last 12 imports · this browser tab</span>
      </div>
      ${table(
        s.history.map((r, i) => ({ ...r, index: i })),
        [
          ['time', 'Imported at'],
          ['name', 'Source file'],
          ['kind', 'Dataset'],
          ['count', 'Records'],
          ['delta', 'Changes'],
          [
            'index',
            '',
            (v) =>
              /* HTML */ `<button class="link restore" data-index="${v}">
                Restore dataset ↶
              </button>`,
          ],
        ],
      )}
    </div>
    <div class="panel">
      <div class="split">
        <h2>Successive import differences</h2>
        <button id="export">↓ Export exceptions</button>
      </div>
      <p>Compares each replacement import to the previous version of that dataset.</p>
      ${table(
        s.changes,
        [
          ['source', 'Source'],
          ['change', 'Change'],
          ['record', 'Record'],
          ['detail', 'Difference'],
        ],
        { all: true },
      )}
    </div>`;
}
// Render the active view and attach handlers to its new DOM.
function render() {
  $('#projectName').textContent =
    s.projects.length === 1
      ? s.projects[0].proj_short_name || s.projects[0].project_id
      : s.projects.length
        ? s.projects.length + ' projects'
        : 'No project';
  $('#title').textContent = view;
  $('#subtitle').textContent = {
    Dashboard: 'One clear view of your schedule and commercial data.',
    'Data Imports': 'Bring your project sources into a single workspace.',
    'Schedule Explorer': 'Explore projects, work breakdown structures and activity logic.',
    'Cost & Commitments': 'Trace budgets, actuals and commitments to their source.',
    Validation: 'Find data quality issues before they affect decisions.',
    Reconciliation: 'Connect your records. Resolve the differences.',
    'Import History': 'Review revisions and understand what changed.',
  }[view];
  $('#nav').innerHTML = pages
    .map(
      (v, i) =>
        /* HTML */ `<button data-view="${v}" class="${view === v ? 'active' : ''}">
          <span>${icons[i]}</span>${v}
        </button>`,
    )
    .join('');
  $('#content').innerHTML =
    view === 'Dashboard'
      ? dashboard()
      : view === 'Data Imports'
        ? imports()
        : view === 'Schedule Explorer'
          ? explorer()
          : view === 'Cost & Commitments'
            ? costs()
            : view === 'Validation'
              ? exceptions('validation')
              : view === 'Reconciliation'
                ? exceptions('reconciliation')
                : history();
  bind();
  if (pending && view === 'Data Imports') renderMapping();
}
function bind() {
  document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => go(b.dataset.view)));
  let on = (id, f) => {
    let e = $('#' + id);
    if (e) e.onclick = f;
  };
  on('emptySample', loadSample);
  on('allExceptions', () => go('Validation'));
  on('dashRun', () => {
    evaluate();
    go('Reconciliation');
    notice('Reconciliation complete.');
  });
  on('run', () => {
    evaluate();
    render();
    notice('Checks complete using current data and mappings.');
  });
  on('export', exportIssues);
  on('fixtures', () => {
    let f = H.sample();
    download('harbor-point.xer', f.xer, 'text/plain');
    setTimeout(() => download('harbor-costs.csv', f.costs), 200);
    setTimeout(() => download('harbor-commitments.csv', f.commitments), 400);
  });
  on('clear', () => {
    if (confirm('Clear all data, mappings and history from this browser tab?')) {
      s = blank();
      pending = null;
      evaluate();
      render();
      notice('Session cleared.');
    }
  });
  on('prev', () => {
    page--;
    render();
  });
  on('next', () => {
    page++;
    render();
  });
  for (let id of ['dataset', 'costset', 'severity'])
    if ($('#' + id))
      $('#' + id).onchange = (e) => {
        if (id === 'dataset') dataset = e.target.value;
        if (id === 'costset') costset = e.target.value;
        if (id === 'severity') severity = e.target.value;
        page = 0;
        render();
      };
  if ($('#search'))
    $('#search').oninput = (e) => {
      let pos = e.target.selectionStart;
      query = e.target.value;
      page = 0;
      render();
      $('#search').focus();
      $('#search').setSelectionRange(pos, pos);
    };
  document.querySelectorAll('.investigate').forEach(
    (b) =>
      (b.onclick = () => {
        let r = results.issues[+b.dataset.index];
        $('#detailBody').innerHTML = /* HTML */ `${badge(r.severity)}
          <h3>${esc(r.rule)}</h3>
          <p>${esc(r.detail)}</p>
          <h3>Recommended action</h3>
          <p>${esc(r.action)}</p>
          <h3>Source: ${esc(r.source)} · row ${esc(r.row)}</h3>
          <pre>${esc(JSON.stringify(JSON.parse(r.snapshot), null, 2))}</pre>
          <button class="primary" id="fixMapping">Edit reconciliation mappings</button>`;
        $('#fixMapping').onclick = () => {
          $('#detail').close();
          go('Reconciliation');
        };
        $('#detail').showModal();
      }),
  );
  document.querySelectorAll('.restore').forEach(
    (b) =>
      (b.onclick = () => {
        let r = s.history[+b.dataset.index];
        applyImport(r.kind, JSON.parse(JSON.stringify(r.data)), r.name + ' (restored)');
        render();
        notice('Dataset restored and checks rerun.');
      }),
  );
  for (let kind of ['xer', 'costs', 'commitments'])
    if ($('#file-' + kind))
      $('#file-' + kind).onchange = (e) => {
        if (e.target.files[0]) readFile(kind, e.target.files[0]);
      };
  on('apply', () => {
    try {
      let maps = (id) =>
        Object.fromEntries(
          $('#' + id)
            .value.split('\n')
            .filter((x) => x.trim())
            .map((l, i) => {
              let a = l.split('=');
              if (a.length !== 2 || !a.every((x) => x.trim()))
                throw Error(`Invalid mapping on line ${i + 1}; use source=target.`);
              return a.map(H.canon);
            }),
        );
      let absolute = Number($('#absolute').value),
        percent = Number($('#percent').value);
      if (!Number.isFinite(absolute) || absolute < 0 || !Number.isFinite(percent) || percent < 0)
        throw Error('Tolerances must be nonnegative numbers.');
      s.settings = {
        absolute,
        percent,
        codeMap: maps('codeMap'),
        activityMap: maps('activityMap'),
      };
      evaluate();
      render();
      notice('Mappings saved. Reconciliation rerun.');
    } catch (e) {
      notice(e.message, true);
    }
  });
}
// File ingestion: prepare, evaluate, then commit a complete dataset.
function applyImport(kind, data, name) {
  const key = kind === 'xer' ? 'activities' : kind;
  const rows = kind === 'xer' ? data.activities : data;
  const old = s[key];
  const changes = old.length
    ? H.compare(old, rows, key).map((change) => ({ ...change, source: name }))
    : [];
  const candidate = {
    ...s,
    ...(kind === 'xer' ? data : { [kind]: data }),
    changes: [...changes, ...s.changes].slice(0, 1000),
    history: [
      {
        time: new Date().toLocaleString(),
        name,
        kind,
        count: rows.length,
        delta: changes.length,
        data,
      },
      ...s.history,
    ].slice(0, 12),
  };

  // Keep the committed session and its findings together if evaluation fails.
  const candidateResults = H.run(candidate, candidate.settings);
  s = candidate;
  results = candidateResults;
  persist();
}
async function readFile(kind, file) {
  notice(`Reading ${file.name}…`);
  try {
    if (file.size > 15 * 1024 * 1024) throw Error('File exceeds 15 MB limit.');
    if (kind === 'xer') {
      let data = H.xer(await file.text(), file.name);
      applyImport(kind, data, file.name);
      pending = null;
      render();
      notice(
        `Imported ${data.activities.length} activities. Validation and reconciliation complete.`,
      );
    } else {
      if (/\.csv$/i.test(file.name)) {
        let rows = H.csv(await file.text());
        pending = { kind, name: file.name, rows };
      } else if (/\.xlsx?$/i.test(file.name)) {
        if (typeof XLSX === 'undefined') throw Error('Excel reader unavailable. Please use CSV.');
        let wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = wb.SheetNames[0];
        const rows = sheetRows(wb, sheet);
        pending = { kind, name: file.name, wb, sheet, rows };
      } else throw Error('Choose a CSV, XLSX or XLS file.');
      pending.map = H.guess(pending.rows, kind);
      renderMapping();
      notice('File parsed. Review the field mapping, then confirm import.');
    }
  } catch (e) {
    notice(`Import failed: ${e.message}`, true);
  }
}
function sheetRows(wb, name) {
  let rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true });
  if (!rows.length) throw Error('Worksheet is empty.');
  return rows;
}
function renderMapping() {
  if (!pending) return;
  let p = pending,
    h = Object.keys(p.rows[0]).filter((k) => k !== '_row');
  $('#mapping').innerHTML = /* HTML */ `<div class="panel">
    <div class="split">
      <div>
        <h2>Map fields · ${esc(p.name)}</h2>
        <p>
          ${p.rows.length} rows ready to import. Missing monetary columns produce validation
          findings.
        </p>
      </div>
      <button id="cancelMap">Cancel</button>
    </div>
    ${p.wb
      ? /* HTML */ `<label
          >Worksheet<select id="sheet">
            ${p.wb.SheetNames.map(
              (n) => /* HTML */ `<option ${n === p.sheet ? 'selected' : ''}>${esc(n)}</option>`,
            ).join('')}
          </select></label
        >`
      : ''}
    <div class="formgrid">
      ${H.fields[p.kind]
        .map(
          (k) =>
            /* HTML */ `<label
              >${esc(k)}<select data-field="${k}">
                <option value="">Not mapped</option>
                ${h
                  .map(
                    (n) =>
                      /* HTML */ `<option value="${esc(n)}" ${p.map[k] === n ? 'selected' : ''}>
                        ${esc(n)}
                      </option>`,
                  )
                  .join('')}
              </select></label
            >`,
        )
        .join('')}<label
        >Default project ID<input
          id="defaultProject"
          value="${esc(s.projects.length === 1 ? s.projects[0].project_id : '')}"
          placeholder="e.g. HARBOR" /></label
      ><label>Default currency<input id="defaultCurrency" value="PHP" maxlength="3" /></label>
    </div>
    <button class="primary" id="confirmMap">Confirm import & run checks</button>
    <div style="margin-top:20px">
      ${table(
        p.rows.slice(0, 3),
        h.map((k) => [k, k]),
        { all: true },
      )}
    </div>
  </div>`;
  document
    .querySelectorAll('[data-field]')
    .forEach((e) => (e.onchange = () => (p.map[e.dataset.field] = e.value)));
  $('#cancelMap').onclick = () => {
    pending = null;
    $('#mapping').innerHTML = '';
    notice('Pending import cancelled.');
  };
  if ($('#sheet'))
    $('#sheet').onchange = (e) => {
      try {
        const sheet = e.target.value;
        const rows = sheetRows(p.wb, sheet);
        const map = H.guess(rows, p.kind);
        Object.assign(p, { sheet, rows, map });
        renderMapping();
      } catch (e) {
        $('#sheet').value = p.sheet;
        notice(e.message, true);
      }
    };
  $('#confirmMap').onclick = () => {
    try {
      if (!p.map.cost_code) throw Error('Map a cost code column.');
      if (!p.map.project_id && !$('#defaultProject').value.trim())
        throw Error('Map a project column or enter a default project ID.');
      let rows = H.finance(
        p.rows,
        p.kind,
        p.map,
        p.name,
        $('#defaultProject').value,
        $('#defaultCurrency').value,
      );
      applyImport(p.kind, rows, p.name);
      pending = null;
      render();
      notice(`Imported ${rows.length} records. Validation and reconciliation complete.`);
    } catch (e) {
      notice(e.message, true);
    }
  };
}
function loadSample() {
  let b = $('#sample');
  b.disabled = true;
  notice('Parsing sample project and running checks…');
  setTimeout(() => {
    try {
      let f = H.sample();
      applyImport('xer', H.xer(f.xer, 'harbor-point.xer'), 'harbor-point.xer');
      for (let k of ['costs', 'commitments']) {
        let rows = H.csv(f[k]);
        applyImport(
          k,
          H.finance(rows, k, H.guess(rows, k), 'harbor-' + k + '.csv', 'HARBOR', 'PHP'),
          'harbor-' + k + '.csv',
        );
      }
      pending = null;
      go('Dashboard');
      notice(
        'Harbor Point loaded: 150 activities, 80 cost records and 30 commitments. Known exceptions are ready to investigate.',
      );
    } catch (e) {
      notice(e.message, true);
    } finally {
      b.disabled = false;
    }
  }, 30);
}
$('#sample').onclick = loadSample;
$('#importGo').onclick = () => go('Data Imports');
evaluate();
render();
