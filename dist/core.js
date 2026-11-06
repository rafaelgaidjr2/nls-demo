(function (root) {
  const canon = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase();
  function amount(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let text = String(value ?? '').trim();
    if (!text) return null;

    // Parentheses must enclose the entire unsigned amount.
    const negative = text.startsWith('(') && text.endsWith(')');
    if (negative) text = text.slice(1, -1).trim();
    if (/[()]/.test(text)) return null;

    // Accept one leading currency symbol and an optional sign, in either order.
    const match = text.match(
      /^([+-]?)\s*([$₱€£]?)\s*([+-]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/,
    );
    if (!match || (match[1] && match[3])) return null;
    const sign = match[1] || match[3];
    if (negative && sign) return null;
    const number = Number(match[4].replaceAll(',', ''));
    return Number.isFinite(number) ? (negative || sign === '-' ? -number : number) : null;
  }
  function csv(text) {
    let rows = [],
      r = [],
      s = '',
      q = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') {
          s += '"';
          i++;
        } else if (c === '"') q = false;
        else s += c;
      } else if (c === '"') q = true;
      else if (c === ',') {
        r.push(s);
        s = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        r.push(s);
        if (r.some((x) => x.trim())) rows.push(r);
        r = [];
        s = '';
      } else s += c;
    }
    if (q) throw Error('Unclosed CSV quote');
    r.push(s);
    if (r.some((x) => x.trim())) rows.push(r);
    if (!rows.length) throw Error('Empty file');
    let h = rows.shift().map((x) => x.replace(/^\uFEFF/, '').trim());
    if (new Set(h).size !== h.length || h.some((x) => !x))
      throw Error('Headers must be nonempty and unique');
    return rows.map((r, i) => {
      if (r.length !== h.length)
        throw Error(`Row ${i + 2}: expected ${h.length} columns, received ${r.length}`);
      return Object.fromEntries([...h.map((k, j) => [k, r[j]]), ['_row', i + 2]]);
    });
  }
  function xer(text, source = 'schedule.xer') {
    let tables = {},
      t,
      f,
      errors = [],
      ended = false;
    text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .forEach((l, i) => {
        if (!l.trim()) return;
        let a = l.split('\t'),
          m = a.shift().trim();
        if (m === '%T') {
          t = canon(a[0]);
          f = null;
          if (!t) errors.push(`Line ${i + 1}: missing table name`);
          tables[t] ??= [];
        } else if (m === '%F') {
          if (!t) errors.push(`Line ${i + 1}: fields before table`);
          f = a.map((x) => x.trim());
          if (new Set(f).size !== f.length) errors.push(`Line ${i + 1}: duplicate fields`);
        } else if (m === '%R') {
          if (!t || !f) errors.push(`Line ${i + 1}: record before fields`);
          else if (a.length !== f.length)
            errors.push(`Line ${i + 1}: ${t} expected ${f.length} values, received ${a.length}`);
          else
            tables[t].push({
              ...Object.fromEntries(f.map((k, j) => [k, a[j]])),
              _row: i + 1,
              source,
            });
        } else if (m === '%E') {
          ended = true;
          t = null;
          f = null;
        } else if (m.startsWith('%')) errors.push(`Line ${i + 1}: unknown marker ${m}`);
      });
    if (!ended) errors.push('Missing %E end marker');
    if (!tables.TASK) errors.push('Missing TASK table');
    if (errors.length) throw Error(errors.slice(0, 12).join('; '));
    let projects = (tables.PROJECT || []).map((r) => ({ ...r, project_id: r.proj_id })),
      wbs = (tables.PROJWBS || []).map((r) => ({ ...r, project_id: r.proj_id }));
    let activities = tables.TASK.map((r) => ({
      ...r,
      project_id: r.proj_id || projects[0]?.proj_id || '',
      id: r.task_code || r.task_id,
      internal_id: r.task_id,
      name: r.task_name,
      wbs: r.wbs_id,
      start: r.act_start_date || r.target_start_date || r.early_start_date || '',
      finish: r.act_end_date || r.target_end_date || r.early_end_date || '',
      cost_code: r.cost_code || '',
    }));
    let relationships = (tables.TASKPRED || []).map((r) => ({
      ...r,
      project_id: r.proj_id || projects[0]?.proj_id || '',
      activity_id: r.task_id,
      predecessor_id: r.pred_task_id,
      predecessor_project: r.pred_proj_id || r.proj_id || projects[0]?.proj_id || '',
      type: r.pred_type,
    }));
    return { projects, wbs, activities, relationships };
  }
  const fields = {
    costs: [
      'record_id',
      'project_id',
      'cost_code',
      'description',
      'budget',
      'actual',
      'activity_id',
      'currency',
    ],
    commitments: [
      'record_id',
      'project_id',
      'cost_code',
      'description',
      'amount',
      'activity_id',
      'currency',
      'type',
    ],
  };
  const aliases = {
    record_id: ['record_id', 'commitment_id', 'po_number', 'contract_no', 'id'],
    project_id: ['project_id', 'proj_id'],
    cost_code: ['cost_code', 'code', 'costcode'],
    budget: ['budget', 'budget_amount'],
    actual: ['actual', 'actual_cost', 'actual_amount'],
    amount: ['amount', 'committed_amount', 'value'],
    activity_id: ['activity_id', 'task_code'],
    currency: ['currency', 'currency_code'],
    description: ['description', 'name'],
    type: ['type'],
  };
  function guess(rows, kind) {
    let h = Object.keys(rows[0] || {});
    return Object.fromEntries(
      fields[kind].map((k) => [
        k,
        h.find((x) => aliases[k].includes(x.toLowerCase().replace(/\s+/g, '_'))) || '',
      ]),
    );
  }
  function finance(rows, kind, map, source, project, currency) {
    return rows.map((r, i) => {
      let o = { source, _row: r._row || i + 2 };
      fields[kind].forEach((k) => (o[k] = map[k] ? r[map[k]] : ''));
      o.project_id = canon(o.project_id || project);
      o.currency = canon(o.currency || currency);
      o.cost_code = canon(o.cost_code);
      o.record_id = String(o.record_id || (kind === 'costs' ? `ROW-${i + 2}` : ''));
      for (let k of kind === 'costs' ? ['budget', 'actual'] : ['amount']) o[k] = amount(o[k]);
      return o;
    });
  }
  function validDate(v) {
    if (!v) return false;
    let m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return false;
    let d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    return (
      d.getUTCFullYear() === +m[1] &&
      d.getUTCMonth() === +m[2] - 1 &&
      d.getUTCDate() === +m[3] &&
      +(m[4] || 0) < 24 &&
      +(m[5] || 0) < 60 &&
      +(m[6] || 0) < 60
    );
  }
  // Compare accepted date-only and date-time forms without host timezone parsing.
  function dateValue(value) {
    if (!validDate(value)) return null;
    const [year, month, day, hour = 0, minute = 0, second = 0] = String(value)
      .split(/[- T:]/)
      .map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    return date.getTime();
  }

  function hasRelationshipCycle(edges) {
    const done = new Set();
    const active = new Set();
    for (const start of edges.keys()) {
      if (done.has(start)) continue;
      active.add(start);
      const stack = [{ key: start, predecessors: (edges.get(start) || [])[Symbol.iterator]() }];
      while (stack.length) {
        const frame = stack[stack.length - 1];
        const next = frame.predecessors.next();
        if (next.done) {
          active.delete(frame.key);
          done.add(frame.key);
          stack.pop();
        } else if (active.has(next.value)) {
          return true;
        } else if (!done.has(next.value)) {
          active.add(next.value);
          stack.push({
            key: next.value,
            predecessors: (edges.get(next.value) || [])[Symbol.iterator](),
          });
        }
      }
    }
    return false;
  }

  function run(s, settings = {}) {
    let issues = [],
      groups = [],
      add = (
        phase,
        severity,
        rule,
        r,
        detail,
        action = 'Correct the source or update the identifier mappings, then rerun.',
      ) =>
        issues.push({
          phase,
          severity,
          rule,
          record: r.id || r.record_id || r.activity_id || r.cost_code || '(blank)',
          source: r.source || 'Session',
          row: r._row || '',
          project: r.project_id || '',
          detail,
          action,
          snapshot: JSON.stringify(r),
        });
    let key = (p, id) => canon(p) + '|' + canon(id),
      acts = new Map(),
      internal = new Map(),
      wbs = new Set(s.wbs.map((r) => key(r.project_id, r.wbs_id))),
      projects = new Set(s.projects.map((r) => canon(r.project_id)));
    let amap = settings.activityMap || {},
      cmap = settings.codeMap || {};
    let aid = (v) => amap[canon(v)] || canon(v),
      code = (v) => cmap[canon(v)] || canon(v);
    for (let a of s.activities) {
      let k = key(a.project_id, a.id);
      if (!a.id) add('validation', 'error', 'MISSING_ACTIVITY_ID', a, 'Activity code is required.');
      if (acts.has(k))
        add(
          'validation',
          'error',
          'DUPLICATE_ACTIVITY',
          a,
          'Duplicate activity code in this project.',
        );
      acts.set(k, a);
      internal.set(key(a.project_id, a.internal_id), a);
      if (!projects.has(canon(a.project_id)))
        add(
          'validation',
          'error',
          'UNKNOWN_PROJECT',
          a,
          'Activity project is absent from PROJECT.',
        );
      if (a.wbs && !wbs.has(key(a.project_id, a.wbs)))
        add('validation', 'error', 'UNKNOWN_WBS', a, `WBS ${a.wbs} is absent.`);
      for (let f of ['start', 'finish'])
        if (!validDate(a[f]))
          add(
            'validation',
            'error',
            'INVALID_DATE',
            a,
            `${f}: ${a[f] || 'missing'}. Expected YYYY-MM-DD with optional time.`,
          );
      if (validDate(a.start) && validDate(a.finish) && dateValue(a.start) > dateValue(a.finish))
        add('validation', 'error', 'DATE_ORDER', a, 'Finish precedes start.');
    }
    let edges = new Map(),
      relseen = new Set();
    for (let r of s.relationships) {
      let k = key(r.project_id, r.activity_id),
        p = key(r.predecessor_project, r.predecessor_id);
      if (!internal.has(k) || !internal.has(p))
        add(
          'validation',
          'error',
          'BROKEN_RELATIONSHIP',
          r,
          `Missing endpoint ${r.activity_id} or predecessor ${r.predecessor_id}.`,
        );
      if (k === p)
        add('validation', 'error', 'SELF_RELATIONSHIP', r, 'An activity cannot precede itself.');
      if (!['PR_FS', 'PR_SS', 'PR_FF', 'PR_SF'].includes(r.type))
        add(
          'validation',
          'warning',
          'RELATIONSHIP_TYPE',
          r,
          `Unknown relationship type ${r.type}.`,
        );
      let rk = k + '>' + p + '|' + r.type;
      if (relseen.has(rk))
        add(
          'validation',
          'warning',
          'DUPLICATE_RELATIONSHIP',
          r,
          'Duplicate predecessor relationship.',
        );
      relseen.add(rk);
      edges.set(k, [...(edges.get(k) || []), p]);
    }
    if (hasRelationshipCycle(edges))
      add(
        'validation',
        'error',
        'RELATIONSHIP_CYCLE',
        {},
        'Schedule contains a predecessor cycle.',
      );
    let budget = new Map(),
      commit = new Map();
    for (let kind of ['costs', 'commitments']) {
      let seen = new Set();
      for (let r of s[kind]) {
        let id = key(r.project_id, r.record_id);
        if (!r.record_id)
          add('validation', 'error', 'MISSING_RECORD_ID', r, 'Record identifier is required.');
        if (seen.has(id))
          add(
            'validation',
            'error',
            'DUPLICATE_RECORD',
            r,
            'Duplicate financial record ID; totals include both rows until corrected.',
          );
        seen.add(id);
        if (!r.project_id || !r.cost_code)
          add('validation', 'error', 'MISSING_FIELD', r, 'Project ID and cost code are required.');
        if (!/^[A-Z]{3}$/.test(r.currency))
          add(
            'validation',
            'error',
            'INVALID_CURRENCY',
            r,
            'Currency must be a three-letter code.',
          );
        for (let f of kind === 'costs' ? ['budget', 'actual'] : ['amount'])
          if (r[f] === null || !Number.isFinite(r[f]))
            add('validation', 'error', 'INVALID_AMOUNT', r, `${f} is missing or invalid.`);
        if (!acts.has(key(r.project_id, aid(r.activity_id))))
          add(
            'reconciliation',
            'warning',
            r.activity_id ? 'UNMATCHED_ACTIVITY' : 'MISSING_ACTIVITY_LINK',
            r,
            `Activity ${r.activity_id || '(blank)'} has no schedule match.`,
          );
        else {
          let a = acts.get(key(r.project_id, aid(r.activity_id)));
          if (a.cost_code && code(a.cost_code) !== code(r.cost_code))
            add(
              'reconciliation',
              'warning',
              'COST_CODE_INCONSISTENCY',
              r,
              `Activity uses ${a.cost_code}; financial record uses ${r.cost_code}.`,
            );
        }
        let g = key(r.project_id, code(r.cost_code)) + '|' + r.currency,
          m = kind === 'costs' ? budget : commit;
        if (!m.has(g)) m.set(g, []);
        m.get(g).push(r);
      }
    }
    for (let [k, arr] of commit)
      if (!budget.has(k))
        add(
          'reconciliation',
          'error',
          'UNMATCHED_COST_CODE',
          arr[0],
          `No budget for mapped code ${code(arr[0].cost_code)} in ${arr[0].currency}. Different currencies are never summed.`,
        );
    for (let [k, arr] of budget) {
      let b = arr.reduce((n, r) => n + (r.budget || 0), 0),
        a = arr.reduce((n, r) => n + (r.actual || 0), 0),
        c = (commit.get(k) || []).reduce((n, r) => n + (r.amount || 0), 0),
        tol = Math.max(+settings.absolute || 0, (Math.abs(b) * (+settings.percent || 0)) / 100);
      let row = {
        project: arr[0].project_id,
        cost_code: code(arr[0].cost_code),
        currency: arr[0].currency,
        budget: b,
        actual: a,
        committed: c,
        variance: c - b,
        status: arr.some((r) => r.budget === null)
          ? 'Invalid budget'
          : c > b + tol
            ? 'Over budget'
            : 'Within tolerance',
      };
      groups.push(row);
      if (!arr.some((r) => r.budget === null) && c > b + tol)
        add(
          'reconciliation',
          'warning',
          'OVER_COMMITTED',
          arr[0],
          `${c.toLocaleString()} committed vs ${b.toLocaleString()} budget ${row.currency}; variance ${(c - b).toLocaleString()}, tolerance ${tol}.`,
        );
      if (!arr.some((r) => r.budget === null) && a > b + tol)
        add(
          'reconciliation',
          'warning',
          'ACTUAL_OVER_BUDGET',
          arr[0],
          `Actual ${a} exceeds budget ${b} ${row.currency}.`,
        );
    }
    if (!s.activities.length || !s.costs.length || !s.commitments.length)
      add(
        'reconciliation',
        'info',
        'INCOMPLETE_DATA',
        {},
        'Import schedule, costs and commitments for complete reconciliation.',
      );
    return { issues, groups };
  }
  function compare(old, rows, kind) {
    let key = (r) =>
      canon(r.project_id) + '|' + canon(kind === 'activities' ? r.internal_id : r.record_id);
    let a = new Map(old.map((r) => [key(r), r])),
      b = new Map(rows.map((r) => [key(r), r])),
      out = [];
    let clean = (r) =>
      JSON.stringify(
        Object.fromEntries(Object.entries(r).filter(([k]) => !['_row', 'source'].includes(k))),
      );
    for (let [k, r] of b) {
      if (!a.has(k)) out.push({ change: 'Added', record: k, detail: 'New record' });
      else if (clean(a.get(k)) !== clean(r))
        out.push({
          change: 'Changed',
          record: k,
          detail: Object.keys(r)
            .filter(
              (f) =>
                !['_row', 'source'].includes(f) &&
                JSON.stringify(a.get(k)[f]) !== JSON.stringify(r[f]),
            )
            .map((f) => `${f}: ${a.get(k)[f]} → ${r[f]}`)
            .join('; '),
        });
    }
    for (let [k] of a)
      if (!b.has(k))
        out.push({ change: 'Removed', record: k, detail: 'Absent from replacement import' });
    return out;
  }
  function exportCSV(rows) {
    let safe = (v) => {
      v = String(v ?? '');
      if (/^[=+@\-]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    };
    return rows.map((r) => r.map(safe).join(',')).join('\r\n');
  }
  function sample() {
    let lines = [
      'ERMHDR\t8.4\t2026-11-06',
      '%T\tPROJECT',
      '%F\tproj_id\tproj_short_name',
      '%R\tHARBOR\tHarbor Point Tower',
      '%T\tPROJWBS',
      '%F\tproj_id\twbs_id\twbs_short_name',
    ];
    for (let i = 1; i <= 5; i++)
      lines.push(
        `%R\tHARBOR\t${i}\t${['Siteworks', 'Substructure', 'Structure', 'MEP', 'Finishes'][i - 1]}`,
      );
    lines.push(
      '%T\tTASK',
      '%F\tproj_id\ttask_id\ttask_code\ttask_name\twbs_id\ttarget_start_date\ttarget_end_date\tcost_code',
    );
    for (let i = 1; i <= 150; i++)
      lines.push(
        `%R\tHARBOR\t${i}\tA${String(i).padStart(4, '0')}\t${['Site preparation', 'Concrete placement', 'Steel installation', 'Services rough-in', 'Quality inspection'][i % 5]} · Zone ${Math.ceil(i / 5)}\t${Math.ceil(i / 30)}\t2026-01-05\t${i === 14 ? '2025-12-01' : i === 23 ? '2026-02-30' : '2026-03-15'}\tC-${String(((i - 1) % 80) + 1).padStart(3, '0')}`,
      );
    lines.push('%T\tTASKPRED', '%F\tproj_id\ttask_id\tpred_task_id\tpred_type');
    for (let i = 2; i <= 150; i++) lines.push(`%R\tHARBOR\t${i}\t${i === 18 ? 999 : i - 1}\tPR_FS`);
    lines.push('%E');
    let costs = [
      [
        'record_id',
        'project_id',
        'cost_code',
        'description',
        'budget',
        'actual',
        'activity_id',
        'currency',
      ],
    ];
    for (let i = 1; i <= 80; i++)
      costs.push([
        `B-${i}`,
        'HARBOR',
        `C-${String(i).padStart(3, '0')}`,
        `Work package ${i}`,
        100000 + i * 1000,
        i === 6 ? 180000 : 40000,
        `A${String(i).padStart(4, '0')}`,
        'PHP',
      ]);
    costs[9][4] = 'invalid';
    let commitments = [
      [
        'record_id',
        'project_id',
        'cost_code',
        'description',
        'amount',
        'activity_id',
        'currency',
        'type',
      ],
    ];
    for (let i = 1; i <= 30; i++)
      commitments.push([
        i === 10 ? 'PO-9' : `PO-${i}`,
        'HARBOR',
        i === 4 ? 'C-999' : `C-${String(i).padStart(3, '0')}`,
        `Supplier package ${i}`,
        i === 2 ? 160000 : 65000,
        i === 5 ? 'A9999' : `A${String(i).padStart(4, '0')}`,
        i === 7 ? 'USD' : 'PHP',
        i % 2 ? 'Purchase order' : 'Contract',
      ]);
    return {
      xer: lines.join('\r\n'),
      costs: exportCSV(costs),
      commitments: exportCSV(commitments),
    };
  }
  root.Hub = {
    canon,
    amount,
    csv,
    xer,
    fields,
    guess,
    finance,
    run,
    compare,
    exportCSV,
    sample,
    validDate,
  };
  if (typeof module !== 'undefined') module.exports = root.Hub;
})(typeof window === 'undefined' ? globalThis : window);
