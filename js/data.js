/* Jawda Ads Board: data model, sheet formulas, CSV import and export.
   No framework. Everything here is plain functions on plain objects. */

window.JawdaData = (function () {
  'use strict';

  // Default pipeline. Sheet column A values (Published, In progress, Awaiting creative,
  // Rejected) are kept; the others are the hand-off stages between team members.
  const DEFAULT_STATUSES = [
    { key: 'backlog', label: 'Backlog', hint: 'Ideas and angles not yet briefed' },
    { key: 'brief-prepared', label: 'Brief prepared', hint: 'Brief written, waiting on content' },
    { key: 'awaiting-creative', label: 'Awaiting creative', hint: 'With studio, agency or editor' },
    { key: 'creative-ready', label: 'Creative ready', hint: 'Asset delivered, needs copy' },
    { key: 'in-progress', label: 'In progress', hint: 'Copy, links and Canva being built' },
    { key: 'awaiting-approval', label: 'Awaiting approval', hint: 'Ready for sign-off' },
    { key: 'published', label: 'Published', hint: 'Live in Ads Manager' },
    { key: 'retired', label: 'Retired', hint: 'Switched off, kept for learnings', collapsed: true },
    { key: 'rejected', label: 'Rejected', hint: 'Not going ahead', collapsed: true }
  ];

  // Option sets seeded from the Vol. 3 tab. All are editable in Settings and
  // every select also accepts a typed value.
  const DEFAULT_OPTIONS = {
    angle: ['SILIBI', 'Autumn Season', 'Summer Season', 'Natural Fibres', 'Sale', 'Try Jawda',
      'In-House Factory', 'Affordability', 'Nursing-Friendly', 'Pregnancy', 'Homepage', 'DPA'],
    funnel: ['Upper', 'Mid', 'Lower'],
    product: ['Autumn Collection', 'Summer Collection', 'Homepage', 'Natural Fibres', 'Classic Sale',
      'Lantern Sleeve Top', 'Mock Neck Jumper Abaya', 'Collar Top', 'Covered Button Jacket',
      'Side Button Dress', 'Tassel Abaya', 'Ruched Slit Dress', 'Notch Collar Top',
      'Linen Cotton Wrap Top', 'Layered Two-Piece', 'Button Sleeve Abaya', 'Shirt Collar Abaya',
      'Lace Abaya', 'Lace Top and Skirt', 'Wave Open Abaya', 'Wrap Skirt', 'Linen Cotton Skirt',
      'Striped Kimono', 'Kaftan', 'Pleated Tie Dress', 'Print Abaya', 'Print Top', 'Prints', 'NA'],
    creativeType: ['Studio', 'Lifestyle', 'Influencer / UGC', 'Brand Story', 'Detail / Fabric', 'Mix'],
    formatType: ['Video', 'Static', 'Flexible', 'GIF', 'Carousel'],
    ai: ['Non-AI', 'AI']
  };

  const DEFAULT_TEAM = ['Anisah', 'Alamin'];

  // Hand-off checklist on every ticket. Each step is one person's job done.
  const CHECKLIST = [
    { key: 'brief', label: 'Brief written' },
    { key: 'creative', label: 'Creative delivered' },
    { key: 'copy', label: 'Copy written' },
    { key: 'links', label: 'Links and Canva checked' },
    { key: 'approved', label: 'Approved' }
  ];

  // Meta character guidance. Primary text truncates at roughly 125 characters
  // on mobile; headlines are safest under 40.
  const LIMITS = { primary: 125, headline: 40 };

  // Field definitions. `sheet` is the exact header used in the Vol. 3 tab so
  // import and export round-trip cleanly.
  const FIELDS = [
    { key: 'status', sheet: 'Approved?', type: 'status' },
    { key: 'launchDate', sheet: 'Launch Date', type: 'date' },
    { key: 'id', sheet: 'ID', type: 'id' },
    { key: 'angle', sheet: 'Angle', type: 'option', options: 'angle' },
    { key: 'funnel', sheet: 'Funnel', type: 'option', options: 'funnel' },
    { key: 'product', sheet: 'Product', type: 'option', options: 'product' },
    { key: 'creativeType', sheet: 'Creative Type', type: 'option', options: 'creativeType' },
    { key: 'formatType', sheet: 'Format Type', type: 'option', options: 'formatType' },
    { key: 'ai', sheet: 'AI / Non-AI', type: 'option', options: 'ai' },
    { key: 'name', sheet: 'Name', type: 'computed' },
    { key: 'inspirationLink', sheet: 'Inspiration Link', type: 'url' },
    { key: 'description', sheet: 'Description', type: 'text' },
    { key: 'landingPage', sheet: 'Landing Page Link', type: 'url' },
    { key: 'utm', sheet: 'UTM Link for Meta', type: 'computed' },
    { key: 'primaryOne', sheet: 'Primary One', type: 'copy' },
    { key: 'primaryTwo', sheet: 'Primary Two', type: 'copy' },
    { key: 'headlineOne', sheet: 'Headline One', type: 'copy' },
    { key: 'headlineTwo', sheet: 'Headline Two', type: 'copy' },
    { key: 'canvaLandscape', sheet: 'Creative Canva 1920  1080', type: 'url' },
    { key: 'canvaSquare', sheet: 'Creative Canva 1080  1080', type: 'url' },
    { key: 'learnings', sheet: 'Learnings', type: 'text' },
    { key: 'briefPreparedDate', sheet: 'Brief Prepared Date', type: 'date' },
    { key: 'creativeReadyDate', sheet: 'Creative Ready Date', type: 'date' }
  ];

  // Extra columns the board adds on export (after the sheet's own columns).
  const EXTRA_EXPORT = [
    { key: 'owner', sheet: 'Owner' },
    { key: 'dueDate', sheet: 'Due Date' },
    { key: 'notes', sheet: 'Board Notes' }
  ];

  function newCard(id, status) {
    const now = new Date().toISOString();
    return {
      id: String(id),
      status: status || 'backlog',
      launchDate: '', angle: '', funnel: '', product: '', creativeType: '', formatType: '', ai: '',
      nameOverride: '', inspirationLink: '', description: '', landingPage: '', utmOverride: '',
      primaryOne: '', primaryTwo: '', headlineOne: '', headlineTwo: '',
      canvaLandscape: '', canvaSquare: '', learnings: '',
      briefPreparedDate: '', creativeReadyDate: '',
      owner: '', dueDate: '', notes: '',
      checklist: { brief: false, creative: false, copy: false, links: false, approved: false },
      comments: [], activity: [{ at: now, text: 'Ticket created' }],
      order: Date.now(), createdAt: now, updatedAt: now
    };
  }

  // Sheet formula: "#1141: Mid / SILIBI / Lantern Sleeve Top / Lifestyle / Video / Non-AI"
  function buildName(card) {
    if (card.nameOverride && card.nameOverride.trim()) return card.nameOverride.trim();
    const parts = [card.funnel, card.angle, card.product, card.creativeType, card.formatType, card.ai]
      .map(function (p) { return (p || '').trim(); }).filter(Boolean);
    return '#' + card.id + (parts.length ? ': ' + parts.join(' / ') : '');
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  // Sheet formula for the Triple Whale link.
  function buildUtm(card) {
    if (card.utmOverride && card.utmOverride.trim()) return card.utmOverride.trim();
    const landing = (card.landingPage || '').trim();
    if (!landing) return '';
    const content = [card.id, card.funnel, card.angle, card.product, card.creativeType, card.formatType]
      .map(slug).filter(Boolean).join('_');
    const join = landing.indexOf('?') >= 0 ? '&' : '?';
    return landing + join +
      'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}' +
      '&utm_content=' + content + '&fbadid={{ad.id}}';
  }

  function nextId(cards) {
    let max = 1000;
    cards.forEach(function (c) { const n = parseInt(c.id, 10); if (!isNaN(n) && n > max) max = n; });
    return String(max + 1);
  }

  // Dates: the sheet uses "4 May 26"; the board stores ISO (YYYY-MM-DD).
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseDate(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})$/);
    if (m) {
      const mi = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
      if (mi >= 0) {
        let y = parseInt(m[3], 10); if (y < 100) y += 2000;
        return y + '-' + String(mi + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
      }
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let y = parseInt(m[3], 10); if (y < 100) y += 2000;
      return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  function formatDate(iso, style) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    if (style === 'sheet') return d.getDate() + ' ' + mon + ' ' + String(d.getFullYear()).slice(2);
    return d.getDate() + ' ' + mon;
  }

  // RFC 4180 CSV parser (handles quoted commas and newlines).
  function parseCsv(text) {
    const rows = []; let row = []; let field = ''; let q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }
  function csvCell(v) {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function statusKeyFor(label, statuses) {
    const l = String(label || '').trim().toLowerCase();
    if (!l) return null;
    const hit = statuses.find(function (s) { return s.label.toLowerCase() === l || s.key === l; });
    return hit ? hit.key : null;
  }

  // Import rows exported from the Vol. 3 tab. Finds the header row by its "ID"
  // column, maps by header text, creates any unknown column A status as a new
  // pipeline stage, and merges into existing tickets by ID.
  function importCsv(text, state) {
    const rows = parseCsv(text);
    const hi = rows.findIndex(function (r) { return r.map(function (c) { return c.trim(); }).indexOf('ID') >= 0; });
    if (hi < 0) throw new Error('Could not find a header row with an "ID" column.');
    const header = rows[hi].map(function (h) { return h.trim().replace(/\s+/g, ' '); });
    const col = {};
    FIELDS.concat(EXTRA_EXPORT).forEach(function (f) {
      const sheet = f.sheet.replace(/\s+/g, ' ');
      const idx = header.findIndex(function (h) { return h.toLowerCase() === sheet.toLowerCase(); });
      if (idx >= 0) col[f.key] = idx;
    });
    if (col.id === undefined) throw new Error('No ID column found.');

    const statuses = state.settings.statuses.slice();
    const byId = {}; state.cards.forEach(function (c) { byId[c.id] = c; });
    const result = { created: 0, updated: 0, skipped: 0, newStatuses: [] };
    const now = new Date().toISOString();

    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r];
      const rawId = (row[col.id] || '').trim().replace(/^#/, '');
      if (!/^\d+$/.test(rawId)) { result.skipped++; continue; }
      const get = function (k) { return col[k] === undefined ? '' : (row[col[k]] || '').trim(); };

      let statusLabel = get('status');
      let key = statusKeyFor(statusLabel, statuses);
      if (!key && statusLabel) {
        key = slug(statusLabel).replace(/_/g, '-');
        const insertAt = Math.max(0, statuses.findIndex(function (s) { return s.key === 'published'; }));
        statuses.splice(insertAt, 0, { key: key, label: statusLabel, hint: 'Imported from sheet' });
        result.newStatuses.push(statusLabel);
      }
      if (!key) key = 'backlog';

      const existing = byId[rawId];
      const card = existing || newCard(rawId, key);
      card.status = key;
      ['angle', 'funnel', 'product', 'creativeType', 'formatType', 'ai', 'inspirationLink', 'description',
        'landingPage', 'primaryOne', 'primaryTwo', 'headlineOne', 'headlineTwo', 'canvaLandscape',
        'canvaSquare', 'learnings', 'owner', 'notes'].forEach(function (k) {
          const v = get(k); if (v) card[k] = v;
        });
      ['launchDate', 'briefPreparedDate', 'creativeReadyDate', 'dueDate'].forEach(function (k) {
        const v = parseDate(get(k)); if (v) card[k] = v;
      });
      // Keep a name or UTM from the sheet only if it differs from what the formula would build.
      const sheetName = get('name'); if (sheetName && sheetName !== buildName(Object.assign({}, card, { nameOverride: '' }))) card.nameOverride = sheetName;
      const sheetUtm = get('utm'); if (sheetUtm && sheetUtm !== buildUtm(Object.assign({}, card, { utmOverride: '' }))) card.utmOverride = sheetUtm;
      if (key === 'published') { card.checklist.brief = card.checklist.creative = card.checklist.copy = card.checklist.links = card.checklist.approved = true; }
      card.updatedAt = now;
      if (existing) result.updated++; else { card.activity.push({ at: now, text: 'Imported from sheet' }); state.cards.push(card); byId[rawId] = card; result.created++; }
    }
    // Learn any new option values so the dropdowns stay in step with the sheet.
    const opts = state.settings.options;
    state.cards.forEach(function (c) {
      [['angle', 'angle'], ['funnel', 'funnel'], ['product', 'product'], ['creativeType', 'creativeType'],
        ['formatType', 'formatType'], ['ai', 'ai']].forEach(function (p) {
          const v = c[p[0]]; if (v && opts[p[1]].indexOf(v) < 0) opts[p[1]].push(v);
        });
    });
    state.settings.statuses = statuses;
    return result;
  }

  function exportCsv(state) {
    const statuses = state.settings.statuses;
    const labelFor = function (k) { const s = statuses.find(function (x) { return x.key === k; }); return s ? s.label : k; };
    const cols = FIELDS.concat(EXTRA_EXPORT);
    const lines = [cols.map(function (c) { return csvCell(c.sheet); }).join(',')];
    const cards = state.cards.slice().sort(function (a, b) { return parseInt(a.id, 10) - parseInt(b.id, 10); });
    cards.forEach(function (c) {
      lines.push(cols.map(function (f) {
        switch (f.key) {
          case 'status': return csvCell(labelFor(c.status));
          case 'id': return csvCell('#' + c.id);
          case 'name': return csvCell(buildName(c));
          case 'utm': return csvCell(buildUtm(c));
          case 'launchDate': case 'briefPreparedDate': case 'creativeReadyDate': case 'dueDate':
            return csvCell(formatDate(c[f.key], 'sheet'));
          default: return csvCell(c[f.key]);
        }
      }).join(','));
    });
    return lines.join('\n');
  }

  // Flags copy claims that need substantiation on file before the ad runs.
  const CLAIM_RULES = [
    { re: /100%\s*(cotton|linen)/i, note: 'Fibre claim: confirm it holds for this exact SKU and colourway, lining included.' },
    { re: /ethical(ly)?\s*(made|produc)/i, note: 'Ethics claim: substantiation must be on file.' },
    { re: /(while stocks? last|limited (stock|quantit)|selling fast|last few)/i, note: 'Scarcity claim: must be true at the time the ad serves.' },
    { re: /(crease|wrinkle)[-\s]?(free|resistant)/i, note: 'No crease or wrinkle resistance claims on linen.' },
    { re: /(best[-\s]?seller|bestselling)/i, note: 'Prefer behavioural proof (what customers did) over a bestseller label.' },
    { re: /★|\d\.\d\s*stars?|rated/i, note: 'Rating claim: keep the review source on file.' },
    { re: /opaque|not see[-\s]?through/i, note: 'Opacity claim: verify physically before running.' }
  ];
  function claimWarnings(card) {
    const text = [card.primaryOne, card.primaryTwo, card.headlineOne, card.headlineTwo].join('\n');
    return CLAIM_RULES.filter(function (r) { return r.re.test(text); }).map(function (r) { return r.note; });
  }

  function defaultSettings() {
    return {
      boardName: 'SILIBI Meta Ads Max Vol. 3',
      statuses: JSON.parse(JSON.stringify(DEFAULT_STATUSES)),
      options: JSON.parse(JSON.stringify(DEFAULT_OPTIONS)),
      team: DEFAULT_TEAM.slice(),
      collapsed: {}
    };
  }

  return {
    DEFAULT_STATUSES: DEFAULT_STATUSES, DEFAULT_OPTIONS: DEFAULT_OPTIONS, DEFAULT_TEAM: DEFAULT_TEAM,
    CHECKLIST: CHECKLIST, LIMITS: LIMITS, FIELDS: FIELDS,
    newCard: newCard, buildName: buildName, buildUtm: buildUtm, slug: slug, nextId: nextId,
    parseDate: parseDate, formatDate: formatDate, parseCsv: parseCsv, importCsv: importCsv,
    exportCsv: exportCsv, claimWarnings: claimWarnings, defaultSettings: defaultSettings
  };
})();
