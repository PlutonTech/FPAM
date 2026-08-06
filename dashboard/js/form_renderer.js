'use strict';
// ── DYNAMIC FORM RENDERER ─────────────────────────────────────────────────────
// Renders and collects data for any of the 15 FormRequest types, driven by
// js/form_field_defs.js. Used by both mda_portal.html (submission) and
// form_requests.html (FPAM review — read-only mode).

function _dotGet(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
function _dotSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

let _tableRowCounters = {};

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderFormFields(formType, existingData, readOnly) {
  const fields = FORM_FIELDS[formType];
  if (!fields) return `<div style="color:var(--text3);padding:20px">Unknown form type</div>`;
  existingData = existingData || {};

  return fields.map(f => renderField(f, _dotGet(existingData, f.key), readOnly)).join('');
}

function renderField(f, value, readOnly) {
  const dis = readOnly ? 'disabled' : '';
  const id = 'ff-' + f.key.replace(/\./g, '__');

  switch (f.type) {
    case 'text':
      return _wrap(f, `<input type="text" id="${id}" data-key="${f.key}" class="ff-input" value="${_esc(value)}" ${dis}>`);
    case 'number':
      return _wrap(f, `<input type="number" id="${id}" data-key="${f.key}" class="ff-input" value="${value ?? ''}" ${dis}>`);
    case 'date':
      return _wrap(f, `<input type="date" id="${id}" data-key="${f.key}" class="ff-input" value="${_dateVal(value)}" ${dis}>`);
    case 'textarea':
      return _wrap(f, `<textarea id="${id}" data-key="${f.key}" class="ff-input" rows="3" ${dis}>${_esc(value)}</textarea>`);
    case 'checkbox':
      return `<label class="ff-checkbox-row"><input type="checkbox" id="${id}" data-key="${f.key}" ${value ? 'checked' : ''} ${dis}> ${_esc(f.label)}</label>`;
    case 'select':
      return _wrap(f, `<select id="${id}" data-key="${f.key}" class="ff-input" ${dis}>
        <option value=""></option>
        ${f.options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>`);
    case 'table':
      return renderTable(f, value || [], readOnly);
    case 'ratingTable':
      return renderRatingTable(f, value || [], readOnly);
    case 'checkTable':
      return renderCheckTable(f, value || [], readOnly);
    default:
      return '';
  }
}

function _wrap(f, inner) {
  return `<div class="ff-field"><label class="ff-label">${_esc(f.label)}</label>${inner}</div>`;
}
function _esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _dateVal(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// ── TABLE (repeating rows, dynamic columns) ────────────────────────────────────
function renderTable(f, rows, readOnly) {
  const tableId = 'fftbl-' + f.key;
  _tableRowCounters[tableId] = rows.length;

  const rowHtml = (row, idx) => `<tr data-row="${idx}">
    ${f.columns.map(c => `<td>${_tableCell(f.key, idx, c, row?.[c.key], readOnly)}</td>`).join('')}
    ${readOnly ? '' : `<td><button type="button" class="btn btn-ghost btn-xs" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>`}
  </tr>`;

  return `<div class="ff-field ff-field-wide">
    <label class="ff-label">${_esc(f.label)}</label>
    <div style="overflow-x:auto">
      <table class="ff-table" id="${tableId}">
        <thead><tr>${f.columns.map(c => `<th>${_esc(c.label)}</th>`).join('')}${readOnly ? '' : '<th></th>'}</tr></thead>
        <tbody>${rows.map((r, i) => rowHtml(r, i)).join('') || (readOnly ? '' : rowHtml({}, 0))}</tbody>
      </table>
      ${readOnly ? '' : `<button type="button" class="btn btn-secondary btn-xs" style="margin-top:8px" onclick="_ffAddTableRow('${f.key}')"><i class="fa-solid fa-plus"></i> Add Row</button>`}
    </div>
  </div>`;
}

function _tableCell(tableKey, idx, col, value, readOnly) {
  const dis = readOnly ? 'disabled' : '';
  const dataAttrs = `data-table="${tableKey}" data-row="${idx}" data-col="${col.key}"`;
  if (col.type === 'select') {
    return `<select class="ff-input ff-cell" ${dataAttrs} ${dis}>
      <option value=""></option>
      ${col.options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>`;
  }
  if (col.type === 'date') {
    return `<input type="date" class="ff-input ff-cell" ${dataAttrs} value="${_dateVal(value)}" ${dis}>`;
  }
  if (col.type === 'number') {
    return `<input type="number" class="ff-input ff-cell" ${dataAttrs} value="${value ?? ''}" ${dis}>`;
  }
  return `<input type="text" class="ff-input ff-cell" ${dataAttrs} value="${_esc(value)}" ${dis}>`;
}

function _ffAddTableRow(fieldKey) {
  const tableId = 'fftbl-' + fieldKey;
  const table = document.getElementById(tableId);
  if (!table) return;
  const fields = Object.values(FORM_FIELDS).flat();
  const def = fields.find(f => f.key === fieldKey && f.type === 'table');
  if (!def) return;
  const idx = table.querySelectorAll('tbody tr').length;
  const tr = document.createElement('tr');
  tr.dataset.row = idx;
  tr.innerHTML = def.columns.map(c => `<td>${_tableCell(fieldKey, idx, c, '', false)}</td>`).join('')
    + `<td><button type="button" class="btn btn-ghost btn-xs" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>`;
  table.querySelector('tbody').appendChild(tr);
}

// ── RATING TABLE (fixed component list, 1-5 + remarks) ─────────────────────────
function renderRatingTable(f, ratings, readOnly) {
  const byComponent = {};
  ratings.forEach(r => { byComponent[r.component] = r; });
  const tableId = 'ffrating-' + f.key;

  return `<div class="ff-field ff-field-wide">
    <label class="ff-label">${_esc(f.label)}</label>
    <table class="ff-table" id="${tableId}">
      <thead><tr><th>Component</th><th>Rating (1-5)</th><th>Remarks</th></tr></thead>
      <tbody>
        ${f.components.map(comp => {
          const r = byComponent[comp] || {};
          return `<tr data-component="${_esc(comp)}">
            <td>${_esc(comp)}</td>
            <td><select class="ff-input ff-rating-select" ${readOnly?'disabled':''}>
              <option value=""></option>
              ${[5,4,3,2,1].map(n => `<option value="${n}" ${r.rating===n?'selected':''}>${n}</option>`).join('')}
            </select></td>
            <td><input type="text" class="ff-input ff-rating-remarks" value="${_esc(r.remarks)}" ${readOnly?'disabled':''}></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── CHECK TABLE (fixed item list, Y/N + remarks) ────────────────────────────────
function renderCheckTable(f, items, readOnly) {
  const byLabel = {};
  items.forEach(i => { byLabel[i.label] = i; });

  return `<div class="ff-field ff-field-wide">
    <label class="ff-label">${_esc(f.label)}</label>
    <table class="ff-table" data-checktable="${f.key}">
      <thead><tr><th>Item</th><th>Compliant</th><th>Remarks</th></tr></thead>
      <tbody>
        ${f.items.map(label => {
          const it = byLabel[label] || {};
          return `<tr data-item="${_esc(label)}">
            <td>${_esc(label)}</td>
            <td><input type="checkbox" class="ff-check-compliant" ${it.compliant ? 'checked' : ''} ${readOnly?'disabled':''}></td>
            <td><input type="text" class="ff-input ff-check-remarks" value="${_esc(it.remarks)}" ${readOnly?'disabled':''}></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── COLLECT — reads the rendered DOM back into the nested data shape ──────────
function collectFormData(formType, containerEl) {
  const fields = FORM_FIELDS[formType];
  const data = {};

  fields.forEach(f => {
    if (f.type === 'table') {
      const table = containerEl.querySelector(`#fftbl-${f.key.replace(/\./g,'__')}, #fftbl-${f.key}`);
      if (!table) return;
      const rows = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        const row = {};
        let hasValue = false;
        f.columns.forEach(c => {
          const cell = tr.querySelector(`[data-col="${c.key}"]`);
          const v = cell ? cell.value : '';
          if (v) hasValue = true;
          row[c.key] = c.type === 'number' ? (v ? Number(v) : undefined) : (v || undefined);
        });
        if (hasValue) rows.push(row);
      });
      _dotSet(data, f.key, rows);
      return;
    }
    if (f.type === 'ratingTable') {
      const table = containerEl.querySelector(`#ffrating-${f.key}`);
      if (!table) return;
      const ratings = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        const rating = tr.querySelector('.ff-rating-select').value;
        const remarks = tr.querySelector('.ff-rating-remarks').value;
        if (rating || remarks) {
          ratings.push({ component: tr.dataset.component, rating: rating ? Number(rating) : undefined, remarks: remarks || undefined });
        }
      });
      const scored = ratings.filter(r => r.rating);
      data.averageScore = scored.length ? +(scored.reduce((s,r)=>s+r.rating,0) / scored.length).toFixed(2) : undefined;
      _dotSet(data, f.key, ratings);
      return;
    }
    if (f.type === 'checkTable') {
      const table = containerEl.querySelector(`[data-checktable="${f.key}"]`);
      if (!table) return;
      const items = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        items.push({
          label: tr.dataset.item,
          compliant: tr.querySelector('.ff-check-compliant').checked,
          remarks: tr.querySelector('.ff-check-remarks').value || undefined,
        });
      });
      _dotSet(data, f.key, items);
      return;
    }
    if (f.type === 'checkbox') {
      const el = containerEl.querySelector(`#ff-${f.key.replace(/\./g,'__')}`);
      if (el) _dotSet(data, f.key, el.checked);
      return;
    }
    const el = containerEl.querySelector(`#ff-${f.key.replace(/\./g,'__')}`);
    if (el) {
      const v = el.value;
      _dotSet(data, f.key, f.type === 'number' ? (v ? Number(v) : undefined) : (v || undefined));
    }
  });

  return data;
}
