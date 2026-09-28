/* Jawda Ads Board: UI. Plain DOM, no build step. */
(function () {
  'use strict';
  const D = window.JawdaData;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  const store = window.JawdaStorage.create();
  let state = { cards: [], settings: D.defaultSettings() };
  let filters = { q: '', angle: '', funnel: '', formatType: '', creativeType: '', owner: '' };
  let openId = null;
  let dragId = null;
  const saveTimers = {};
  let me = localStorage.getItem('jawda-me') || '';

  /* ---------- persistence ---------- */
  function setSync(busy, err) {
    const el = $('sync');
    el.className = 'sync ' + (store.kind === 'local' ? 'local' : '') + (busy ? ' busy' : '');
    $('syncLabel').textContent = err ? 'Not saved: ' + err : (busy ? 'Saving' : store.label);
  }
  function touch(card) { card.updatedAt = new Date().toISOString(); }
  function queueSave(card) {
    touch(card);
    clearTimeout(saveTimers[card.id]);
    setSync(true);
    saveTimers[card.id] = setTimeout(function () {
      Promise.resolve(store.saveCard(card, state)).then(function () { setSync(false); }).catch(function (e) { setSync(false, e.message || 'error'); });
    }, 450);
  }
  function saveNow(card) {
    touch(card);
    clearTimeout(saveTimers[card.id]);
    setSync(true);
    return Promise.resolve(store.saveCard(card, state)).then(function () { setSync(false); }).catch(function (e) { setSync(false, e.message || 'error'); });
  }
  function saveSettings() {
    setSync(true);
    return Promise.resolve(store.saveSettings(state.settings, state)).then(function () { setSync(false); }).catch(function (e) { setSync(false, e.message || 'error'); });
  }
  function log(card, text) { card.activity.push({ at: new Date().toISOString(), text: text }); if (card.activity.length > 200) card.activity.shift(); }

  /* ---------- helpers ---------- */
  function cardById(id) { return state.cards.find(function (c) { return c.id === id; }); }
  function statusList() { return state.settings.statuses; }
  function statusIndex(key) { return statusList().findIndex(function (s) { return s.key === key; }); }
  function statusLabel(key) { const s = statusList().find(function (x) { return x.key === key; }); return s ? s.label : key; }
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function initials(name) { return (name || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function relTime(iso) {
    const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.round(diff / 60) + ' min ago';
    if (diff < 86400) return Math.round(diff / 3600) + ' h ago';
    return D.formatDate(iso.slice(0, 10));
  }
  function progress(card) { return D.CHECKLIST.filter(function (s) { return card.checklist && card.checklist[s.key]; }).length; }

  /* ---------- filtering ---------- */
  function matches(card) {
    if (filters.angle && card.angle !== filters.angle) return false;
    if (filters.funnel && card.funnel !== filters.funnel) return false;
    if (filters.formatType && card.formatType !== filters.formatType) return false;
    if (filters.creativeType && card.creativeType !== filters.creativeType) return false;
    if (filters.owner && card.owner !== filters.owner) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = [card.id, D.buildName(card), card.description, card.product, card.primaryOne, card.primaryTwo, card.headlineOne, card.headlineTwo, card.owner, card.learnings, card.notes].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function fillFilter(id, values, current) {
    const sel = $(id); const first = sel.options[0].textContent;
    sel.innerHTML = '<option value="">' + esc(first) + '</option>' + values.map(function (v) { return '<option' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    sel.classList.toggle('active', !!current);
  }
  function renderFilters() {
    const used = function (k) { const s = {}; state.cards.forEach(function (c) { if (c[k]) s[c[k]] = 1; }); return Object.keys(s).sort(); };
    fillFilter('fAngle', used('angle'), filters.angle);
    fillFilter('fFunnel', ['Upper', 'Mid', 'Lower'].filter(function (v) { return used('funnel').indexOf(v) >= 0; }).concat(used('funnel').filter(function (v) { return ['Upper', 'Mid', 'Lower'].indexOf(v) < 0; })), filters.funnel);
    fillFilter('fFormat', used('formatType'), filters.formatType);
    fillFilter('fType', used('creativeType'), filters.creativeType);
    fillFilter('fOwner', used('owner'), filters.owner);
    const any = filters.angle || filters.funnel || filters.formatType || filters.creativeType || filters.owner || filters.q;
    $('clearFilters').hidden = !any;
  }

  /* ---------- board ---------- */
  function renderBoard() {
    renderFilters();
    const board = $('board');
    board.innerHTML = '';
    if (!state.cards.length) {
      board.innerHTML = '<div class="empty"><img class="empty-mark" src="assets/jawda-wordmark-crater.png" alt="" width="471" height="199"><h2>An empty board is a clean slate</h2>' +
        '<p>Import the SILIBI Meta Ads Max Vol. 3 tab as a CSV to bring every ad ID across with its copy and status, or start fresh with a new ticket.</p>' +
        '<div class="row"><button class="btn primary" id="emptyImport">Import from sheet</button><button class="btn" id="emptyNew">New ticket</button></div></div>';
      $('emptyImport').onclick = openImport; $('emptyNew').onclick = function () { createCard('backlog'); };
      $('boardSummary').textContent = 'No tickets yet';
      $('filterCount').textContent = '';
      return;
    }
    let shown = 0;
    statusList().forEach(function (s) {
      const cards = state.cards.filter(function (c) { return c.status === s.key; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      const visible = cards.filter(matches);
      shown += visible.length;
      const collapsed = !!state.settings.collapsed[s.key];
      const col = document.createElement('section');
      col.className = 'column' + (collapsed ? ' collapsed' : '');
      col.dataset.status = s.key;
      col.innerHTML =
        '<div class="col-head"><div class="title"><h2>' + esc(s.label) + ' <span class="n">' + visible.length + (visible.length !== cards.length ? ' of ' + cards.length : '') + '</span></h2>' +
        (s.hint ? '<p>' + esc(s.hint) + '</p>' : '') + '</div>' +
        '<button class="collapse" title="' + (collapsed ? 'Expand' : 'Collapse') + ' column" aria-label="' + (collapsed ? 'Expand' : 'Collapse') + ' column">' + (collapsed ? '&#x25B8;' : '&#x25BE;') + '</button></div>' +
        '<div class="cards"></div><button class="col-add">+ Add ticket</button>';
      const list = col.querySelector('.cards');
      visible.forEach(function (c) { list.appendChild(renderCard(c)); });
      col.querySelector('.collapse').onclick = function () { state.settings.collapsed[s.key] = !collapsed; saveSettings(); renderBoard(); };
      col.querySelector('.col-add').onclick = function () { createCard(s.key); };
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('over'); onDrop(s.key, e, list); });
      board.appendChild(col);
    });
    const pub = state.cards.filter(function (c) { return c.status === 'published'; }).length;
    $('boardSummary').textContent = state.cards.length + ' tickets, ' + pub + ' published';
    $('filterCount').textContent = shown !== state.cards.length ? shown + ' of ' + state.cards.length + ' shown' : '';
  }

  function renderCard(c) {
    const el = document.createElement('article');
    el.className = 'card'; el.draggable = true; el.dataset.id = c.id; el.tabIndex = 0;
    const name = D.buildName(c).replace(/^#\d+:?\s*/, '');
    const warn = D.claimWarnings(c).length;
    const done = progress(c);
    const late = c.dueDate && c.dueDate < today() && c.status !== 'published' && c.status !== 'rejected' && c.status !== 'retired';
    const dateShown = c.launchDate ? 'Launch ' + D.formatDate(c.launchDate) : (c.dueDate ? '' : '');
    el.innerHTML =
      '<p class="id">#' + esc(c.id) + '<span class="date">' + esc(dateShown) + '</span></p>' +
      '<p class="name">' + (name ? esc(name) : '<i style="color:var(--muted)">No details yet</i>') + '</p>' +
      (c.description ? '<p class="desc">' + esc(c.description) + '</p>' : '') +
      '<div class="chips">' + [c.funnel, c.formatType].filter(Boolean).map(function (v) { return '<span class="chip">' + esc(v) + '</span>'; }).join('') +
      (c.ai ? '<span class="chip ai">' + esc(c.ai) + '</span>' : '') + '</div>' +
      '<div class="foot">' + (c.owner ? '<span class="avatar" title="' + esc(c.owner) + '">' + esc(initials(c.owner)) + '</span>' : '<span class="avatar none" title="Unassigned">?</span>') +
      (c.dueDate ? '<span class="due' + (late ? ' late' : '') + '">' + (late ? 'Overdue ' : 'Due ') + esc(D.formatDate(c.dueDate)) + '</span>' : '') +
      (c.comments.length ? '<span class="comments-n">' + c.comments.length + ' note' + (c.comments.length > 1 ? 's' : '') + '</span>' : '') +
      '<span class="rail" title="' + done + ' of ' + D.CHECKLIST.length + ' steps done">' + D.CHECKLIST.map(function (s) { return '<i class="' + (c.checklist[s.key] ? 'on' : '') + '"></i>'; }).join('') + '</span></div>' +
      (warn ? '<span class="flag" title="Copy contains claims to check">&#9888;</span>' : '');
    el.onclick = function () { openCard(c.id); };
    el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(c.id); } };
    el.addEventListener('dragstart', function (e) { dragId = c.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); });
    el.addEventListener('dragend', function () { el.classList.remove('dragging'); dragId = null; });
    return el;
  }

  function onDrop(statusKey, e, list) {
    const id = dragId || e.dataTransfer.getData('text/plain');
    const card = cardById(id); if (!card) return;
    // Work out position from the card under the pointer.
    const siblings = Array.from(list.querySelectorAll('.card')).filter(function (n) { return n.dataset.id !== id; });
    let before = null;
    for (let i = 0; i < siblings.length; i++) { const r = siblings[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = siblings[i]; break; } }
    const after = before ? siblings[siblings.indexOf(before) - 1] : siblings[siblings.length - 1];
    const a = after ? (cardById(after.dataset.id).order || 0) : null;
    const b = before ? (cardById(before.dataset.id).order || 0) : null;
    if (a !== null && b !== null) card.order = (a + b) / 2; else if (a !== null) card.order = a + 1000; else if (b !== null) card.order = b - 1000; else card.order = Date.now();
    moveCard(card, statusKey);
  }

  function moveCard(card, statusKey) {
    if (card.status !== statusKey) {
      log(card, 'Moved from ' + statusLabel(card.status) + ' to ' + statusLabel(statusKey));
      card.status = statusKey;
      if (statusKey === 'published' && !card.launchDate) card.launchDate = today();
      if (statusKey === 'brief-prepared' && !card.briefPreparedDate) card.briefPreparedDate = today();
      if (statusKey === 'creative-ready' && !card.creativeReadyDate) card.creativeReadyDate = today();
    }
    saveNow(card); renderBoard();
    if (openId === card.id) renderDrawer();
  }

  function createCard(statusKey) {
    const card = D.newCard(D.nextId(state.cards), statusKey || 'backlog');
    if (me) card.owner = me;
    state.cards.push(card);
    saveNow(card); renderBoard(); openCard(card.id);
  }

  // Copies the ad definition, copy and links into a fresh ID. Dates, hand-offs,
  // notes and learnings start clean, since the new ad has to earn its own.
  function duplicateCard(src) {
    const card = D.newCard(D.nextId(state.cards), src.status);
    ['angle', 'funnel', 'product', 'creativeType', 'formatType', 'ai', 'description', 'inspirationLink',
      'landingPage', 'primaryOne', 'primaryTwo', 'headlineOne', 'headlineTwo', 'canvaLandscape', 'canvaSquare',
      'owner', 'notes'].forEach(function (k) { card[k] = src[k] || ''; });
    card.order = (src.order || 0) + 1;
    card.activity.push({ at: new Date().toISOString(), text: 'Duplicated from #' + src.id });
    log(src, 'Duplicated as #' + card.id);
    state.cards.push(card);
    saveNow(src); saveNow(card); renderBoard(); openCard(card.id);
    toast('#' + src.id + ' duplicated as #' + card.id);
  }

  /* ---------- drawer ---------- */
  function openCard(id) { openId = id; renderDrawer(); $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden', 'false'); $('scrim').classList.add('open'); }
  function closeDrawer() { openId = null; $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden', 'true'); $('scrim').classList.remove('open'); }

  function optionField(card, key, label, optKey, hint) {
    const opts = state.settings.options[optKey] || [];
    const listId = 'dl-' + optKey;
    return '<div class="field combo"><label for="f-' + key + '">' + esc(label) + '</label>' +
      '<input id="f-' + key + '" data-key="' + key + '" list="' + listId + '" value="' + esc(card[key]) + '" placeholder="Choose or type" autocomplete="off">' +
      '<datalist id="' + listId + '">' + opts.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' +
      (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') + '</div>';
  }
  function textField(card, key, label, opts) {
    opts = opts || {};
    const type = opts.type || 'text';
    if (opts.area) {
      return '<div class="field ' + (opts.span ? 'span' : '') + '"><label for="f-' + key + '">' + esc(label) + '</label>' +
        '<textarea id="f-' + key + '" data-key="' + key + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.placeholder || '') + '">' + esc(card[key]) + '</textarea>' +
        (opts.limit ? '<div class="meta"><span>' + esc(opts.limitNote || '') + '</span><span class="len" data-limit="' + opts.limit + '"></span></div>' : '') + '</div>';
    }
    return '<div class="field ' + (opts.span ? 'span' : '') + '"><label for="f-' + key + '">' + esc(label) + '</label>' +
      (opts.copy ? '<div class="with-btn">' : '') +
      '<input id="f-' + key + '" data-key="' + key + '" type="' + type + '" value="' + esc(card[key]) + '" placeholder="' + esc(opts.placeholder || '') + '">' +
      (opts.copy ? '<button class="btn small copy-btn" data-copy="' + key + '" type="button">Copy</button></div>' : '') +
      (opts.limit ? '<div class="meta"><span>' + esc(opts.limitNote || '') + '</span><span class="len" data-limit="' + opts.limit + '"></span></div>' : '') +
      (opts.hint ? '<p class="hint">' + esc(opts.hint) + '</p>' : '') + '</div>';
  }
  function selectField(card, key, label, values, placeholder) {
    return '<div class="field"><label for="f-' + key + '">' + esc(label) + '</label><select id="f-' + key + '" data-key="' + key + '">' +
      '<option value="">' + esc(placeholder || 'Unassigned') + '</option>' +
      values.map(function (v) { return '<option' + (v === card[key] ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') +
      (card[key] && values.indexOf(card[key]) < 0 ? '<option selected>' + esc(card[key]) + '</option>' : '') + '</select></div>';
  }

  function renderDrawer() {
    const card = cardById(openId); if (!card) { closeDrawer(); return; }
    const name = D.buildName(card); const utm = D.buildUtm(card);
    const idx = statusIndex(card.status);
    $('drawerHead').innerHTML =
      '<div class="ttl"><div class="big-id">#' + esc(card.id) + '</div>' +
      '<p class="computed-name" id="computedName">' + esc(name) + '</p>' +
      '<div class="status-row"><label class="sr-only" for="f-status">Status</label><select id="f-status" class="status">' +
      statusList().map(function (s) { return '<option value="' + s.key + '"' + (s.key === card.status ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select>' +
      '<span class="saved-note">Updated ' + esc(relTime(card.updatedAt)) + '</span></div></div>' +
      '<button class="btn quiet" id="drawerClose" aria-label="Close">Close</button>';

    const warnings = D.claimWarnings(card);
    $('drawerBody').innerHTML =
      '<div class="section"><h3>Ad definition <span>builds the ad name and UTM</span></h3><div class="grid">' +
      optionField(card, 'funnel', 'Funnel', 'funnel') + optionField(card, 'angle', 'Angle', 'angle') +
      optionField(card, 'product', 'Product', 'product') + optionField(card, 'creativeType', 'Creative type', 'creativeType') +
      optionField(card, 'formatType', 'Format type', 'formatType') + optionField(card, 'ai', 'AI or non-AI', 'ai') +
      textField(card, 'nameOverride', 'Name override', { span: true, placeholder: 'Leave blank to use the built name above', hint: 'The name follows the sheet formula: #ID: Funnel / Angle / Product / Creative type / Format / AI.' }) +
      textField(card, 'description', 'Description', { area: true, span: true, rows: 2, placeholder: 'What the creative shows, in one or two lines' }) +
      textField(card, 'inspirationLink', 'Inspiration link', { type: 'url', span: true, placeholder: 'Motion, TikTok, Instagram or reference URL' }) +
      '</div></div>' +

      '<div class="section"><h3>Who and when</h3><div class="grid">' +
      selectField(card, 'owner', 'Owner', state.settings.team) +
      textField(card, 'dueDate', 'Due date', { type: 'date' }) +
      textField(card, 'briefPreparedDate', 'Brief prepared', { type: 'date' }) +
      textField(card, 'creativeReadyDate', 'Creative ready', { type: 'date' }) +
      textField(card, 'launchDate', 'Launch date', { type: 'date' }) +
      '</div></div>' +

      '<div class="section"><h3>Copy <span>counters show the safe length before Meta truncates</span></h3><div class="grid">' +
      textField(card, 'primaryOne', 'Primary text one', { area: true, span: true, rows: 3, limit: D.LIMITS.primary, limitNote: 'Hook first, credential mid, tagline close' }) +
      textField(card, 'primaryTwo', 'Primary text two', { area: true, span: true, rows: 3, limit: D.LIMITS.primary }) +
      textField(card, 'headlineOne', 'Headline one', { limit: D.LIMITS.headline }) +
      textField(card, 'headlineTwo', 'Headline two', { limit: D.LIMITS.headline }) +
      '</div>' + (warnings.length ? '<h3 style="margin-top:12px">Check before it runs</h3><ul class="warnings" id="warnings">' + warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '<div id="warnings"></div>') + '</div>' +

      '<div class="section"><h3>Links</h3><div class="grid">' +
      textField(card, 'landingPage', 'Landing page', { type: 'url', span: true, placeholder: 'https://jawda.co.uk/...' }) +
      '<div class="field span"><label>UTM link for Meta</label><div class="with-btn"><div class="computed" id="utmOut" style="flex:1">' + (utm ? esc(utm) : '<span style="color:var(--muted)">Add a landing page and the link builds itself</span>') + '</div>' +
      '<button class="btn small" id="copyUtm" type="button"' + (utm ? '' : ' disabled') + '>Copy</button></div></div>' +
      textField(card, 'utmOverride', 'UTM override', { span: true, placeholder: 'Only if the built link is wrong for this ad' }) +
      textField(card, 'canvaLandscape', 'Canva 1920 x 1080', { type: 'url', copy: true }) +
      textField(card, 'canvaSquare', 'Canva 1080 x 1080', { type: 'url', copy: true }) +
      '</div></div>' +

      '<div class="section"><h3>Hand-offs <span>' + progress(card) + ' of ' + D.CHECKLIST.length + '</span></h3><div class="checklist">' +
      D.CHECKLIST.map(function (s) { return '<label class="' + (card.checklist[s.key] ? 'on' : '') + '"><input type="checkbox" data-check="' + s.key + '"' + (card.checklist[s.key] ? ' checked' : '') + '>' + esc(s.label) + '</label>'; }).join('') +
      '</div></div>' +

      '<div class="section"><h3>Learnings <span>fill in once it has run</span></h3>' +
      textField(card, 'learnings', 'Learnings', { area: true, rows: 3, placeholder: 'What the numbers said, what to keep, what to change' }) +
      textField(card, 'notes', 'Board notes', { area: true, rows: 2, placeholder: 'Anything the team needs to know that is not for the sheet' }) +
      '</div>' +

      '<div class="section"><h3>Discussion</h3><div class="thread" id="thread">' +
      (card.comments.length ? card.comments.map(function (m, i) { return '<div class="msg"><button class="del" data-del="' + i + '" title="Delete note">Delete</button><div class="who"><b>' + esc(m.by || 'Someone') + '</b> ' + esc(relTime(m.at)) + '</div><p>' + esc(m.text) + '</p></div>'; }).join('') : '<p class="hint">No notes yet. Use this for feedback on copy or creative so it stays with the ticket.</p>') +
      '</div><div class="compose"><select id="meSel" title="Posting as">' + ['Me'].concat(state.settings.team).map(function (t) { const v = t === 'Me' ? '' : t; return '<option value="' + esc(v) + '"' + (v === me ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<textarea id="commentBox" placeholder="Add a note for the team"></textarea><button class="btn" id="postComment" type="button">Post</button></div>' +
      '<details style="margin-top:12px"><summary>Activity</summary><ul class="activity">' + card.activity.slice().reverse().map(function (a) { return '<li><time>' + esc(relTime(a.at)) + '</time>' + esc(a.text) + '</li>'; }).join('') + '</ul></details></div>';

    $('drawerFoot').innerHTML =
      '<button class="btn danger quiet" id="deleteCard">Delete ticket</button><button class="btn quiet" id="dupCard">Duplicate</button><div class="spacer"></div>' +
      '<button class="btn" id="movePrev"' + (idx <= 0 ? ' disabled' : '') + '>&larr; ' + (idx > 0 ? esc(statusList()[idx - 1].label) : 'Back') + '</button>' +
      '<button class="btn primary" id="moveNext"' + (idx >= statusList().length - 1 ? ' disabled' : '') + '>' + (idx < statusList().length - 1 ? esc(statusList()[idx + 1].label) : 'Done') + ' &rarr;</button>';

    bindDrawer(card);
  }

  function bindDrawer(card) {
    $('drawerClose').onclick = closeDrawer;
    $('f-status').onchange = function (e) { moveCard(card, e.target.value); };
    $('movePrev').onclick = function () { const i = statusIndex(card.status); if (i > 0) moveCard(card, statusList()[i - 1].key); };
    $('moveNext').onclick = function () { const i = statusIndex(card.status); if (i < statusList().length - 1) moveCard(card, statusList()[i + 1].key); };
    $('dupCard').onclick = function () { duplicateCard(card); };
    $('deleteCard').onclick = function () {
      if (!confirm('Delete ticket #' + card.id + '? This cannot be undone.')) return;
      state.cards = state.cards.filter(function (c) { return c.id !== card.id; });
      Promise.resolve(store.deleteCard(card.id, state)).catch(function (e) { setSync(false, e.message); });
      closeDrawer(); renderBoard(); toast('Deleted #' + card.id);
    };
    const nameKeys = ['funnel', 'angle', 'product', 'creativeType', 'formatType', 'ai', 'nameOverride', 'landingPage', 'utmOverride'];
    $('drawerBody').querySelectorAll('[data-key]').forEach(function (inp) {
      const key = inp.dataset.key;
      const update = function () {
        card[key] = inp.value;
        if (nameKeys.indexOf(key) >= 0) {
          $('computedName').textContent = D.buildName(card);
          const utm = D.buildUtm(card);
          $('utmOut').innerHTML = utm ? esc(utm) : '<span style="color:var(--muted)">Add a landing page and the link builds itself</span>';
          $('copyUtm').disabled = !utm;
        }
        if (['primaryOne', 'primaryTwo', 'headlineOne', 'headlineTwo'].indexOf(key) >= 0) {
          const ws = D.claimWarnings(card); const w = $('warnings');
          if (w) { w.innerHTML = ws.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); w.className = ws.length ? 'warnings' : ''; }
        }
        queueSave(card);
      };
      inp.addEventListener('input', update);
      inp.addEventListener('change', function () { update(); learnOption(key, inp.value); renderBoardQuiet(); });
      const len = inp.parentElement.querySelector('.len');
      if (len) {
        const upd = function () { const n = inp.value.length; const lim = parseInt(len.dataset.limit, 10); len.textContent = n + ' / ' + lim; len.className = 'len' + (n > lim ? ' over' : ''); };
        inp.addEventListener('input', upd); upd();
      }
    });
    $('drawerBody').querySelectorAll('[data-check]').forEach(function (cb) {
      cb.onchange = function () {
        card.checklist[cb.dataset.check] = cb.checked;
        cb.parentElement.classList.toggle('on', cb.checked);
        log(card, (cb.checked ? 'Ticked ' : 'Unticked ') + D.CHECKLIST.find(function (s) { return s.key === cb.dataset.check; }).label);
        $('drawerBody').querySelector('.section h3 span') && renderProgressLabel(card);
        saveNow(card); renderBoardQuiet();
      };
    });
    $('drawerBody').querySelectorAll('.copy-btn').forEach(function (b) {
      b.onclick = function () { const v = card[b.dataset.copy]; if (v) navigator.clipboard.writeText(v).then(function () { toast('Copied'); }); };
    });
    $('copyUtm').onclick = function () { const u = D.buildUtm(card); if (u) navigator.clipboard.writeText(u).then(function () { toast('UTM link copied'); }); };
    $('meSel').onchange = function (e) { me = e.target.value; localStorage.setItem('jawda-me', me); };
    $('postComment').onclick = function () {
      const box = $('commentBox'); const text = box.value.trim(); if (!text) return;
      card.comments.push({ by: me || 'Someone', at: new Date().toISOString(), text: text });
      log(card, (me || 'Someone') + ' added a note');
      saveNow(card); renderDrawer(); renderBoardQuiet();
      $('commentBox').focus();
    };
    $('commentBox').onkeydown = function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('postComment').click(); };
    $('drawerBody').querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { card.comments.splice(parseInt(b.dataset.del, 10), 1); saveNow(card); renderDrawer(); renderBoardQuiet(); };
    });
  }
  function renderProgressLabel(card) {
    const h = Array.from($('drawerBody').querySelectorAll('.section h3')).find(function (h) { return /Hand-offs/.test(h.textContent); });
    if (h) h.querySelector('span').textContent = progress(card) + ' of ' + D.CHECKLIST.length;
  }
  function learnOption(key, value) {
    const map = { angle: 'angle', funnel: 'funnel', product: 'product', creativeType: 'creativeType', formatType: 'formatType', ai: 'ai' };
    if (!map[key] || !value) return;
    const list = state.settings.options[map[key]];
    if (list.indexOf(value) < 0) { list.push(value); saveSettings(); }
  }
  // Re-render the board without disturbing the open drawer.
  function renderBoardQuiet() { renderBoard(); }

  /* ---------- modal: settings ---------- */
  function openModal(title, html) { $('modalTitle').textContent = title; $('modalContent').innerHTML = html; $('modal').classList.add('open'); }
  function closeModal() { $('modal').classList.remove('open'); }

  function openSettings() {
    const s = state.settings;
    const statusRows = s.statuses.map(function (st, i) {
      const n = state.cards.filter(function (c) { return c.status === st.key; }).length;
      return '<div class="row" data-i="' + i + '"><input class="short" data-f="label" value="' + esc(st.label) + '" aria-label="Stage name"><input class="hintin" data-f="hint" value="' + esc(st.hint || '') + '" placeholder="Short hint shown under the name" aria-label="Hint">' +
        '<button class="btn small" data-mv="-1" title="Move up">&uarr;</button><button class="btn small" data-mv="1" title="Move down">&darr;</button>' +
        '<button class="btn small danger" data-rm="1"' + (n ? ' disabled title="Move its ' + n + ' tickets first"' : '') + '>Remove</button></div>';
    }).join('');
    const optPanes = Object.keys(D.DEFAULT_OPTIONS).map(function (k) {
      const label = { angle: 'Angles', funnel: 'Funnels', product: 'Products', creativeType: 'Creative types', formatType: 'Format types', ai: 'AI or non-AI' }[k];
      return '<div class="field" style="margin-bottom:10px"><label>' + label + ' <span style="color:var(--muted)">(one per line)</span></label><textarea data-opt="' + k + '" rows="' + Math.min(10, Math.max(3, s.options[k].length)) + '" style="font-family:inherit;font-size:13px;min-height:60px">' + esc(s.options[k].join('\n')) + '</textarea></div>';
    }).join('');
    openModal('Settings',
      '<div class="tabs"><button class="on" data-tab="pipeline">Pipeline</button><button data-tab="team">Team</button><button data-tab="options">Dropdown options</button><button data-tab="storage">Storage</button></div>' +
      '<div class="pane on" data-pane="pipeline"><p class="note">These are the board columns. Stage names are what goes into column A when you export back to the sheet. Keep Published and Rejected so the sheet still reads the way it always has.</p>' +
      '<div class="list-edit" id="statusList">' + statusRows + '</div><div style="margin-top:8px"><button class="btn small" id="addStatus">+ Add stage</button></div></div>' +
      '<div class="pane" data-pane="team"><p class="note">Names to assign tickets to and to post notes as.</p><div class="field"><label>Team (one per line)</label><textarea id="teamBox" rows="6" style="font-family:inherit;font-size:13px;min-height:80px">' + esc(s.team.join('\n')) + '</textarea></div></div>' +
      '<div class="pane" data-pane="options"><p class="note">Values offered in the ticket dropdowns. Typing a new value in a ticket adds it here automatically.</p>' + optPanes + '</div>' +
      '<div class="pane" data-pane="storage"><p class="note">Currently: <b>' + esc(store.label) + '</b>.' + (store.kind === 'local' ? ' Only this browser can see the board. To share it with the team, add Supabase details to <code>js/config.js</code> (see README) and run <code>supabase/schema.sql</code>. Download a backup first and restore it afterwards so nothing is lost.' : ' Everyone with the link sees the same board and changes appear live.') + '</p>' +
      '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn danger" id="wipeBoard">Clear this board</button></div></div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="settingsCancel">Cancel</button><button class="btn primary" id="settingsSave">Save settings</button></div>');

    const content = $('modalContent');
    content.querySelectorAll('.tabs button').forEach(function (b) {
      b.onclick = function () { content.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); content.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('on', p.dataset.pane === b.dataset.tab); }); };
    });
    let working = JSON.parse(JSON.stringify(s.statuses));
    const redraw = function () {
      $('statusList').innerHTML = working.map(function (st, i) {
        const n = state.cards.filter(function (c) { return c.status === st.key; }).length;
        return '<div class="row" data-i="' + i + '"><input class="short" data-f="label" value="' + esc(st.label) + '" aria-label="Stage name"><input class="hintin" data-f="hint" value="' + esc(st.hint || '') + '" placeholder="Short hint shown under the name" aria-label="Hint">' +
          '<button class="btn small" data-mv="-1" title="Move up">&uarr;</button><button class="btn small" data-mv="1" title="Move down">&darr;</button>' +
          '<button class="btn small danger" data-rm="1"' + (n ? ' disabled title="Move its ' + n + ' tickets first"' : '') + '>Remove</button></div>';
      }).join('');
      bindRows();
    };
    const bindRows = function () {
      $('statusList').querySelectorAll('.row').forEach(function (row) {
        const i = parseInt(row.dataset.i, 10);
        row.querySelectorAll('input').forEach(function (inp) { inp.oninput = function () { working[i][inp.dataset.f] = inp.value; }; });
        row.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function () { const j = i + parseInt(b.dataset.mv, 10); if (j < 0 || j >= working.length) return; const t = working[i]; working[i] = working[j]; working[j] = t; redraw(); }; });
        const rm = row.querySelector('[data-rm]'); rm.onclick = function () { if (rm.disabled) return; working.splice(i, 1); redraw(); };
      });
    };
    bindRows();
    $('addStatus').onclick = function () { const key = 'stage-' + Date.now().toString(36); working.push({ key: key, label: 'New stage', hint: '' }); redraw(); $('statusList').lastElementChild.querySelector('input').focus(); };
    $('settingsCancel').onclick = closeModal;
    $('wipeBoard').onclick = function () {
      if (!confirm('Clear every ticket on this board? Download a backup first if you might need it.')) return;
      const ids = state.cards.map(function (c) { return c.id; });
      state.cards = [];
      Promise.all(ids.map(function (id) { return Promise.resolve(store.deleteCard(id, state)); })).catch(function (e) { setSync(false, e.message); });
      closeModal(); closeDrawer(); renderBoard(); toast('Board cleared');
    };
    $('settingsSave').onclick = function () {
      working = working.filter(function (st) { return st.label.trim(); }).map(function (st) { st.label = st.label.trim(); return st; });
      s.statuses = working;
      s.team = $('teamBox').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      content.querySelectorAll('[data-opt]').forEach(function (ta) { s.options[ta.dataset.opt] = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); });
      saveSettings().then(function () { toast('Settings saved'); });
      closeModal(); renderBoard(); if (openId) renderDrawer();
    };
  }

  /* ---------- modal: import ---------- */
  function openImport() {
    openModal('Import from sheet',
      '<p class="note">In Google Sheets open the <b>SILIBI Meta Ads Max Vol. 3</b> tab, then File &rarr; Download &rarr; Comma Separated Values. Choose that file or paste its contents below. Tickets are matched by ID: existing ones are updated, new IDs are created, and any status in column A that the board does not know becomes a new stage.</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="btn" id="pickCsv">Choose CSV file</button><span class="hint" id="pickName" style="align-self:center"></span></div>' +
      '<div class="field"><label for="csvBox">Or paste CSV</label><textarea id="csvBox" placeholder="Approved?,Launch Date,ID,Angle,Funnel,..."></textarea></div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="importCancel">Cancel</button><button class="btn primary" id="importRun">Import</button></div>');
    $('pickCsv').onclick = function () { $('fileInput').accept = '.csv,text/csv'; $('fileInput').dataset.mode = 'csv'; $('fileInput').click(); };
    $('importCancel').onclick = closeModal;
    $('importRun').onclick = function () { runImport($('csvBox').value); };
  }
  function runImport(text) {
    if (!text.trim()) { toast('Nothing to import'); return; }
    try {
      const res = D.importCsv(text, state);
      setSync(true);
      Promise.resolve(store.saveAll(state)).then(function () { setSync(false); }).catch(function (e) { setSync(false, e.message); });
      closeModal(); renderBoard();
      toast('Imported: ' + res.created + ' new, ' + res.updated + ' updated' + (res.newStatuses.length ? ', new stages: ' + res.newStatuses.join(', ') : ''));
    } catch (e) { alert('Import failed. ' + e.message); }
  }

  /* ---------- events ---------- */
  function bindGlobal() {
    $('newBtn').onclick = function () { createCard('backlog'); };
    $('settingsBtn').onclick = openSettings;
    $('modalClose').onclick = closeModal;
    $('modal').onclick = function (e) { if (e.target === $('modal')) closeModal(); };
    $('scrim').onclick = closeDrawer;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if ($('modal').classList.contains('open')) closeModal(); else closeDrawer(); }
    });
    $('boardName').onchange = function (e) { state.settings.boardName = e.target.value.trim() || 'Board'; saveSettings(); };
    $('search').oninput = function (e) { filters.q = e.target.value.trim(); renderBoard(); };
    [['fAngle', 'angle'], ['fFunnel', 'funnel'], ['fFormat', 'formatType'], ['fType', 'creativeType'], ['fOwner', 'owner']].forEach(function (p) {
      $(p[0]).onchange = function (e) { filters[p[1]] = e.target.value; renderBoard(); };
    });
    $('clearFilters').onclick = function () { filters = { q: '', angle: '', funnel: '', formatType: '', creativeType: '', owner: '' }; $('search').value = ''; renderBoard(); };

    const menuBtn = $('dataMenuBtn'), menu = $('dataMenu');
    menuBtn.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', menu.classList.contains('open')); };
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    menu.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        menu.classList.remove('open');
        const act = b.dataset.act;
        if (act === 'import') openImport();
        if (act === 'export') { download('jawda-meta-ads-' + today() + '.csv', D.exportCsv(state), 'text/csv'); toast('CSV downloaded'); }
        if (act === 'backup') { download('jawda-board-backup-' + today() + '.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards: state.cards, settings: state.settings }, null, 2), 'application/json'); toast('Backup downloaded'); }
        if (act === 'restore') { $('fileInput').accept = '.json,application/json'; $('fileInput').dataset.mode = 'json'; $('fileInput').click(); }
      };
    });
    $('fileInput').onchange = function (e) {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = function () {
        if ($('fileInput').dataset.mode === 'json') restoreBackup(r.result); else { if ($('csvBox')) { $('csvBox').value = r.result; $('pickName').textContent = f.name; } else runImport(r.result); }
        e.target.value = '';
      };
      r.readAsText(f);
    };
  }
  function restoreBackup(text) {
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.cards)) throw new Error('Not a board backup.');
      if (!confirm('Restore ' + data.cards.length + ' tickets from this backup? Tickets with the same ID will be replaced.')) return;
      const byId = {}; state.cards.forEach(function (c) { byId[c.id] = c; });
      data.cards.forEach(function (c) { byId[c.id] = normalise(c); });
      state.cards = Object.keys(byId).map(function (k) { return byId[k]; });
      if (data.settings) state.settings = Object.assign(D.defaultSettings(), data.settings);
      setSync(true);
      Promise.resolve(store.saveAll(state)).then(function () { setSync(false); }).catch(function (e) { setSync(false, e.message); });
      renderBoard(); toast('Backup restored');
    } catch (e) { alert('Restore failed. ' + e.message); }
  }
  function normalise(c) {
    const base = D.newCard(c.id || '0', c.status || 'backlog');
    const out = Object.assign(base, c);
    out.checklist = Object.assign(base.checklist, c.checklist || {});
    out.comments = Array.isArray(c.comments) ? c.comments : [];
    out.activity = Array.isArray(c.activity) ? c.activity : base.activity;
    return out;
  }

  /* ---------- boot ---------- */
  function applyLoaded(data) {
    if (data && Array.isArray(data.cards)) state.cards = data.cards.map(normalise);
    if (data && data.settings) state.settings = Object.assign(D.defaultSettings(), data.settings);
    if (!state.settings.collapsed) state.settings.collapsed = {};
    $('boardName').value = state.settings.boardName || 'Board';
  }
  function boot() {
    bindGlobal();
    setSync(true);
    Promise.resolve(store.load()).then(function (data) {
      applyLoaded(data); setSync(false); renderBoard();
      store.subscribe(function () {
        // Another team member changed something: reload, but never over a field being edited.
        Promise.resolve(store.load()).then(function (fresh) {
          const editing = document.activeElement && $('drawer').contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
          applyLoaded(fresh); renderBoard();
          if (openId && !editing) renderDrawer();
        });
      });
    }).catch(function (e) {
      setSync(false, e.message || 'could not load');
      renderBoard();
      alert('Could not load the board from shared storage: ' + (e.message || e) + '\nCheck js/config.js and that supabase/schema.sql has been run.');
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
