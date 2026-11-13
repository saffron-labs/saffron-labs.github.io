/* Saffron Scout on the web. Talks to the same Apps Script as the Android app.
   The page holds no secrets: signing in returns a session token from the script. */
(function () {
  'use strict';

  const SCRIPT_URL = (window.SCOUT_SCRIPT_URL || '').trim();
  const SESSION_KEY = 'saffron-scout-session';
  const TIME_ZONE = 'Asia/Kolkata';

  // ---------- sheet config (mirrors src/tracker/config.ts in the app) ----------

  const SERVICES = ['Website', 'AI Automation', 'Creatives & Ads', 'Software / App', 'Full package'];
  const INTERNATIONAL_SERVICES = ['Website', 'AI Automation', 'Creatives & Ads', 'Software', 'App', 'Full package'];
  const LOCAL_CHANNELS = ['WhatsApp', 'Call', 'Email', 'Walk-in', 'Instagram DM'];
  const INTERNATIONAL_CHANNELS = ['Email', 'Instagram DM', 'LinkedIn', 'WhatsApp', 'Contact form', 'Call'];
  const PRIORITIES = ['Crucial', 'High', 'Medium'];
  const LEAD_STATUSES = ['Not contacted', 'Contacted', 'Replied', 'Meeting set', 'Proposal sent', 'Became client', 'Not interested'];
  const PIPELINE_STAGES = ['Meeting set', 'Proposal sent', 'Negotiating', 'Became client', 'Lost'];
  const PAYMENT_STATUSES = ['Not paid', 'Advance paid', 'Partially paid', 'Fully paid'];
  const PROJECT_STATUSES = ['Onboarding', 'In progress', 'In review', 'Delivered', 'Retainer', 'Paused'];
  const CLOSED = ['Became client', 'Not interested', 'Lost'];

  const outreach = (channels) => [
    { h: 'Reached Out', k: 'bool' },
    { h: 'Contacted By', k: 'text' },
    { h: 'Date Contacted', k: 'date' },
    { h: 'Channel', k: 'select', o: channels },
    { h: 'Status', k: 'select', o: LEAD_STATUSES },
    { h: 'Next Follow-up', k: 'date' },
    { h: 'Remarks', k: 'longtext' },
  ];

  const TABS = {
    Leads: {
      title: 'Local', status: 'Status', statuses: LEAD_STATUSES, location: ['Area'], phone: 'Phone / WhatsApp',
      instagram: 'Instagram', website: 'Website', email: 'Email', maps: 'Maps Link', service: 'Best-fit Service',
      summary: ['Digital Gaps Spotted', 'Pitch Angle', 'Score Reason'],
      editable: [...outreach(LOCAL_CHANNELS), { h: 'Best-fit Service', k: 'select', o: SERVICES }, { h: 'Phone / WhatsApp', k: 'phone' },
        { h: 'Email', k: 'text' }, { h: 'Instagram', k: 'link' }, { h: 'Website', k: 'link' }],
    },
    Global: {
      title: 'India', status: 'Status', statuses: LEAD_STATUSES, location: ['City', 'State'], phone: 'Phone / WhatsApp',
      instagram: 'Instagram', website: 'Website', email: 'Email', maps: 'Maps Link', service: 'Best-fit Service',
      summary: ['Digital Gaps Spotted', 'Pitch Angle', 'Score Reason', 'Est. Deal Size (₹)'],
      editable: [...outreach(LOCAL_CHANNELS), { h: 'Priority', k: 'select', o: PRIORITIES }, { h: 'Best-fit Service', k: 'select', o: SERVICES },
        { h: 'Phone / WhatsApp', k: 'phone' }, { h: 'Email', k: 'text' }],
    },
    International: {
      title: 'International', status: 'Status', statuses: LEAD_STATUSES, location: ['City', 'Country'], phone: 'Phone',
      instagram: 'Instagram / Social', website: 'Website', email: 'Email', service: 'Best-fit Service',
      summary: ['Demand Signal (rating, reviews, price)', 'Digital Gaps Spotted', 'Pitch Angle', 'Est. Deal Size (USD)',
        'Email Subject (draft)', 'Email Draft (review before sending)'],
      editable: [...outreach(INTERNATIONAL_CHANNELS), { h: 'Priority', k: 'select', o: PRIORITIES },
        { h: 'Best-fit Service', k: 'select', o: INTERNATIONAL_SERVICES }, { h: 'Email', k: 'text' }],
    },
    Pipeline: {
      title: 'Pipeline', status: 'Stage', statuses: PIPELINE_STAGES, location: ['Area'], phone: 'Phone / WhatsApp',
      instagram: 'Instagram', service: 'Best-fit Service', summary: ['Pitch Angle'],
      editable: [{ h: 'Stage', k: 'select', o: PIPELINE_STAGES }, { h: 'Meeting Date', k: 'date' }, { h: 'Meeting Time', k: 'text' },
        { h: 'Proposal Sent Date', k: 'date' }, { h: 'Quoted Value (₹)', k: 'money' }, { h: 'Next Follow-up', k: 'date' },
        { h: 'Remarks', k: 'longtext' }, { h: 'Contacted By', k: 'text' }, { h: 'Channel', k: 'select', o: LOCAL_CHANNELS }],
    },
    Clients: {
      title: 'Clients', status: 'Project Status', statuses: PROJECT_STATUSES, location: [], phone: 'Phone / WhatsApp',
      instagram: 'Instagram', email: 'Email', service: 'Services Taken', summary: ['Notes'],
      editable: [{ h: 'Project Status', k: 'select', o: PROJECT_STATUSES }, { h: 'Payment Status', k: 'select', o: PAYMENT_STATUSES },
        { h: 'Deal Value (₹)', k: 'money' }, { h: 'Advance Paid (₹)', k: 'money' }, { h: 'Balance Due (₹)', k: 'money' },
        { h: 'Start Date', k: 'date' }, { h: 'Deadline', k: 'date' }, { h: 'Assigned To', k: 'text' }, { h: 'Contact Person', k: 'text' },
        { h: 'Phone / WhatsApp', k: 'phone' }, { h: 'Email', k: 'text' }, { h: 'Notes', k: 'longtext' }],
    },
  };
  const LEAD_TABS = ['Leads', 'Global', 'International'];
  const SECTIONS = [
    { id: 'today', title: 'Today' },
    { id: 'scout', title: 'Scout' },
    ...Object.keys(TABS).map((id) => ({ id, title: TABS[id].title })),
    { id: 'social', title: 'Social' },
    { id: 'todo', title: 'To-do' },
    { id: 'calendar', title: 'Calendar' },
    { id: 'inbox', title: 'Chats' },
  ];

  // ---------- state ----------

  const state = {
    session: null,
    section: 'today',
    tabs: {}, // tab -> { rows, loading, error, loadedAt }
    filters: {}, // tab -> { q, status, sort }
    summary: null,
    social: null,
    socialView: 'posts',
    team: null,
    shareLead: null,
    postFilter: 'Pending',
  };

  const $ = (id) => document.getElementById(id);

  // ---------- small helpers ----------

  const esc = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cell = (row, header) => {
    const v = row.values[header];
    return typeof v === 'string' ? v.trim() : v == null ? '' : v;
  };
  const str = (row, header) => String(cell(row, header) === false ? '' : cell(row, header));
  const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

  const todayIso = () => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return p; // en-CA gives yyyy-mm-dd
  };
  const isoPlusDays = (days) => {
    const [y, m, d] = todayIso().split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + days));
    return t.toISOString().slice(0, 10);
  };
  const daysFromToday = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    const [y, mo, d] = todayIso().split('-').map(Number);
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(y, mo - 1, d)) / 86400000);
  };
  const shortDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  const dueLabel = (days, iso) => {
    if (days === null) return null;
    if (days < 0) return { text: `${-days}d overdue`, cls: 'due-over' };
    if (days === 0) return { text: 'Today', cls: 'due-today' };
    if (days === 1) return { text: 'Tomorrow', cls: 'due-soon' };
    return { text: shortDate(iso), cls: 'due-soon' };
  };
  const rupees = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  const statusClass = (status) => {
    if (!status || status === 'Not contacted' || status === 'Not paid') return 's-new';
    if (['Contacted', 'Replied', 'Onboarding', 'Advance paid', 'Partially paid'].includes(status)) return 's-warm';
    if (['Meeting set', 'Proposal sent', 'Negotiating', 'In progress', 'In review'].includes(status)) return 's-hot';
    if (['Became client', 'Delivered', 'Retainer', 'Fully paid', 'Approved', 'Posted'].includes(status)) return 's-won';
    if (['Not interested', 'Lost', 'Paused', 'Rejected', 'Error'].includes(status)) return 's-dead';
    return 's-new';
  };

  const safeUrl = (raw) => {
    const v = String(raw || '').trim().replace(/^'/, '');
    if (!v || /\s/.test(v)) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (/^www\.|^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) return 'https://' + v;
    return '';
  };
  const instagramUrl = (raw) => {
    const v = String(raw || '').trim();
    const handle = /^@([A-Za-z0-9._]{2,30})$/.exec(v);
    return handle ? 'https://instagram.com/' + handle[1] : safeUrl(v);
  };
  const phoneDigits = (raw) => {
    const m = String(raw || '').replace(/^'/, '').match(/\+?\d[\d\s-]{7,}\d/);
    if (!m) return '';
    let d = m[0].replace(/\D/g, '');
    if (d.length === 10) d = '91' + d;
    if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
    return d;
  };
  const driveImage = (raw) => {
    const v = safeUrl(raw);
    if (!v) return '';
    const id = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/.exec(v);
    return id ? `https://drive.google.com/thumbnail?id=${id[1]}&sz=w900` : v;
  };

  let toastTimer;
  const toast = (message, bad) => {
    const el = $('toast');
    el.textContent = message;
    el.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = 'toast' + (bad ? ' bad' : '')), bad ? 5200 : 2600);
  };

  // ---------- session & API ----------

  const loadSession = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s && s.token && s.expires > Date.now() ? s : null;
    } catch (e) {
      return null;
    }
  };
  const saveSession = (s) => {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      /* private mode: the session lasts until the tab closes */
    }
  };

  class SessionExpired extends Error {}

  const api = async (action, payload, opts) => {
    if (!SCRIPT_URL) throw new Error('This page is not connected to the sheet yet. Add the script URL to scout/config.js.');
    const body = Object.assign({ action }, payload || {});
    if (!(opts && opts.noAuth)) body.token = state.session && state.session.token;
    let response;
    try {
      response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // plain text avoids a CORS preflight Apps Script can't answer
        body: JSON.stringify(body),
        redirect: 'follow',
      });
    } catch (e) {
      throw new Error("Couldn't reach the sheet. Check your connection and try again.");
    }
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('The sheet script sent an unexpected reply. It may need a new deployment.');
    }
    if (!data || data.ok !== true) {
      const reason = (data && data.error) || 'The sheet did not confirm. Try again.';
      if (/session expired|wrong sheet secret/i.test(reason) && !(opts && opts.noAuth)) throw new SessionExpired(reason);
      throw new Error(reason);
    }
    return data;
  };

  const handleError = (error) => {
    if (error instanceof SessionExpired) {
      signOut('Your session ended. Sign in again.');
      return;
    }
    toast(error.message || 'Something went wrong. Try again.', true);
  };

  // ---------- login ----------

  const showLogin = (message) => {
    closeDrawer(true);
    $('app').hidden = true;
    $('login').hidden = false;
    $('login-error').textContent = message || (SCRIPT_URL ? '' : 'Not connected to the sheet yet. Ask Kashi to finish setup.');
    $('login-password').value = '';
    setTimeout(() => ($('login-name').value ? $('login-password') : $('login-name')).focus(), 0);
  };

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('login-name').value.trim();
    const password = $('login-password').value;
    if (!name || !password) {
      $('login-error').textContent = !name ? 'Enter your name.' : 'Enter your password.';
      return;
    }
    const button = $('login-button');
    button.disabled = true;
    button.textContent = 'Signing in…';
    $('login-error').textContent = '';
    try {
      const data = await api('webLogin', { name, password }, { noAuth: true });
      state.session = { token: data.token, name: data.name, expires: data.expires };
      saveSession(state.session);
      startApp();
    } catch (error) {
      $('login-error').textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  const signOut = (message) => {
    const token = state.session && state.session.token;
    if (token && !message) api('webLogout', { token }, { noAuth: true }).catch(() => {});
    state.session = null;
    state.tabs = {};
    state.summary = null;
    state.social = null;
    state.chat = null;
    state.openChat = null;
    clearInterval(chatTimer);
    clearInterval(todoTimer);
    state.todo = { loaded: false, loading: false, error: '', me: '', members: [], groups: [], tasks: [], scope: 'mine', view: 'priority', group: '', prio: '', q: '', showDone: false };
    saveSession(null);
    showLogin(message);
  };
  $('logout').addEventListener('click', () => signOut());

  // ---------- shell ----------

  const startApp = () => {
    $('login').hidden = true;
    $('app').hidden = false;
    $('who').textContent = 'Signed in as ' + state.session.name;
    const fromHash = decodeURIComponent(location.hash.slice(1));
    go(SECTIONS.some((s) => s.id === fromHash) ? fromHash : 'today', true);
    startTeamPolling();
    startTodoPolling();
  };

  const renderTabs = () => {
    $('tabs').innerHTML = SECTIONS.map((s) => {
      const t = state.tabs[s.id];
      const open = t && t.rows ? t.rows.filter((r) => !CLOSED.includes(str(r, TABS[s.id].status))).length : null;
      const unread = s.id === 'inbox' ? totalUnread() : s.id === 'todo' ? todoAttention() : 0;
      return `<button class="tab" type="button" data-section="${s.id}" ${s.id === state.section ? 'aria-current="page"' : ''}>${esc(s.title)}${
        unread ? `<span class="tab-badge" aria-label="${unread} ${s.id === 'todo' ? 'need attention' : 'unread'}">${unread > 9 ? '9+' : unread}</span>` : open !== null ? `<span class="count">${open}</span>` : ''
      }</button>`;
    }).join('');
  };
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (b) go(b.dataset.section);
  });
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (state.session && id !== state.section && SECTIONS.some((s) => s.id === id)) go(id, true);
  });

  const go = (section, fromHash) => {
    state.section = section;
    document.body.classList.toggle('chat-full', section === 'inbox');
    if (!fromHash) history.replaceState(null, '', '#' + section);
    renderTabs();
    const active = $('tabs').querySelector('[aria-current="page"]');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    if (section === 'today') renderToday();
    else if (section === 'scout') renderScout();
    else if (section === 'social') renderSocial();
    else if (section === 'todo') renderTodo();
    else if (section === 'calendar') renderCalendar();
    else if (section === 'inbox') { state.openFresh = !!state.openChat; renderChats(); restartPolling(); }
    else renderTab(section);
    window.scrollTo(0, 0);
  };

  const skeletons = (n) => `<div class="grid">${'<div class="skeleton"></div>'.repeat(n)}</div>`;
  const emptyState = (title, text, action) =>
    `<div class="empty"><b>${esc(title)}</b>${esc(text)}${action || ''}</div>`;

  // ---------- Today ----------

  const renderToday = async (force) => {
    const view = $('view');
    view.innerHTML = `<div class="view-head"><div><p class="eyebrow">${esc(shortDate(todayIso()))}</p><h2>Today</h2></div>
      <button class="btn btn-outline btn-sm" type="button" data-refresh>Refresh</button></div><div id="today-body">${
        state.summary && !force ? '' : skeletons(4)
      }</div>`;
    view.querySelector('[data-refresh]').onclick = () => renderToday(true);
    if (!state.summary || force) {
      try {
        state.summary = await api('widgetSummary');
      } catch (error) {
        handleError(error);
        if (state.section === 'today' && $('today-body'))
          $('today-body').innerHTML = emptyState("Couldn't load today's summary.", ' ' + error.message,
            '<br><button class="btn btn-outline" type="button" data-retry>Try again</button>');
        const retry = view.querySelector('[data-retry]');
        if (retry) retry.onclick = () => renderToday(true);
        return;
      }
    }
    if (state.section !== 'today') return;
    const s = state.summary;
    const p = s.pipeline || {};
    const stat = (value, label, hot) => `<div class="stat${hot ? ' hot' : ''}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
    const follow = (s.followUps || [])
      .map((f, i) => {
        const due = dueLabel(f.days, '');
        return `<button class="row-item" type="button" data-follow="${i}">
          <div class="grow"><strong>${esc(f.name)}</strong><span class="meta">${esc(f.reason)} · ${esc((TABS[f.tab] || {}).title || f.tab)}${
            f.status ? ' · ' + esc(f.status) : ''
          }</span></div>${due ? `<span class="pill ${due.cls}">${esc(due.text)}</span>` : ''}</button>`;
      })
      .join('');
    const social = s.social;
    $('today-body').innerHTML = `
      <div class="stats">
        ${stat(s.overdue || 0, 'Overdue', (s.overdue || 0) > 0)}
        ${stat(s.dueToday || 0, 'Due today')}
        ${stat(s.upcoming || 0, 'Next 3 days')}
        ${stat(p.openDeals || 0, 'Open deals')}
        ${stat(rupees(p.quotedTotal), 'Quoted')}
        ${stat(p.meetingsThisWeek || 0, 'Meetings this week')}
        ${stat(p.activeClients || 0, 'Active clients')}
        ${stat(rupees(p.balanceDue), 'Balance due')}
        ${social ? stat(social.pendingCount || 0, 'Posts to review', (social.pendingCount || 0) > 0) : ''}
      </div>
      <h3 class="section-title">Follow-ups</h3>
      ${follow ? `<div class="list">${follow}</div>` : emptyState('Nothing due.', ' No follow-ups or meetings are due today or overdue.')}
      <p class="meta" style="margin-top:14px">Updated ${esc(s.updatedAt || '')}</p>`;
    $('today-body').querySelectorAll('[data-follow]').forEach((b) => {
      b.onclick = async () => {
        const f = s.followUps[Number(b.dataset.follow)];
        go(f.tab);
        await ensureTab(f.tab);
        const row = findRow(f.tab, f.row, f.name);
        if (row) openRow(f.tab, row, b);
      };
    });
  };

  // ---------- tracker tabs ----------

  const ensureTab = async (tab, force) => {
    const t = (state.tabs[tab] = state.tabs[tab] || {});
    if (t.rows && !force) return t.rows;
    if (t.loading) return t.loading;
    t.loading = api('list', { tab })
      .then((data) => {
        t.rows = (data.rows || []).filter((r) => r.row > 1).map((r) => ({ tab, row: r.row, values: r.values || {} }));
        t.error = null;
        t.loadedAt = Date.now();
        return t.rows;
      })
      .catch((error) => {
        t.error = error;
        throw error;
      })
      .finally(() => {
        t.loading = null;
      });
    return t.loading;
  };

  const findRow = (tab, rowNumber, name) => {
    const rows = (state.tabs[tab] && state.tabs[tab].rows) || [];
    const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return rows.find((r) => r.row === rowNumber && norm(str(r, 'Business Name')) === norm(name)) ||
      rows.find((r) => norm(str(r, 'Business Name')) === norm(name));
  };

  const followUpOf = (tab, row) => {
    const dates = [str(row, 'Next Follow-up')];
    if (tab === 'Pipeline') dates.push(str(row, 'Meeting Date'));
    const days = dates.map((d) => ({ d, n: daysFromToday(d) })).filter((x) => x.n !== null).sort((a, b) => a.n - b.n);
    return days[0] || null;
  };

  const renderTab = async (tab, force) => {
    const cfg = TABS[tab];
    const f = (state.filters[tab] = state.filters[tab] || { q: '', status: 'open', sort: 'follow' });
    const view = $('view');
    view.innerHTML = `
      <div class="view-head"><div><p class="eyebrow">${esc(tab === 'Leads' ? 'Leads · Local' : tab === 'Global' ? 'Leads · India' : tab === 'International' ? 'Leads · International' : 'Tracker')}</p>
        <h2>${esc(cfg.title)}</h2></div>
        <button class="btn btn-outline btn-sm" type="button" data-refresh>Refresh</button></div>
      <div class="toolbar">
        <input class="search" type="search" placeholder="Search name, category, area, person" aria-label="Search ${esc(cfg.title)}" value="${esc(f.q)}" data-q>
        <select class="select" aria-label="Filter by ${esc(cfg.status)}" data-status>
          <option value="open">Open</option><option value="all">All</option>
          ${cfg.statuses.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <select class="select" aria-label="Sort" data-sort>
          <option value="follow">Follow-up first</option><option value="new">Newest</option><option value="name">Name A–Z</option>
        </select>
        <span class="meta" data-count></span>
      </div>
      <div id="results">${skeletons(6)}</div>`;
    view.querySelector('[data-status]').value = f.status;
    view.querySelector('[data-sort]').value = f.sort;
    view.querySelector('[data-q]').oninput = (e) => { f.q = e.target.value; renderResults(tab); };
    view.querySelector('[data-status]').onchange = (e) => { f.status = e.target.value; renderResults(tab); };
    view.querySelector('[data-sort]').onchange = (e) => { f.sort = e.target.value; renderResults(tab); };
    view.querySelector('[data-refresh]').onclick = () => renderTab(tab, true);
    try {
      await ensureTab(tab, force);
    } catch (error) {
      handleError(error);
      if (state.section === tab && $('results')) {
        $('results').innerHTML = emptyState(`Couldn't load ${cfg.title}.`, ' ' + error.message,
          '<br><button class="btn btn-outline" type="button" data-retry>Try again</button>');
        $('results').querySelector('[data-retry]').onclick = () => renderTab(tab, true);
      }
      return;
    }
    if (state.section !== tab) return;
    renderTabs();
    renderResults(tab);
  };

  const renderResults = (tab) => {
    const cfg = TABS[tab];
    const f = state.filters[tab];
    const all = (state.tabs[tab] && state.tabs[tab].rows) || [];
    const q = f.q.trim().toLowerCase();
    let rows = all.filter((r) => {
      const status = str(r, cfg.status);
      if (f.status === 'open' && CLOSED.includes(status)) return false;
      if (f.status !== 'open' && f.status !== 'all' && status !== f.status) return false;
      if (!q) return true;
      const hay = ['Business Name', 'Category', 'Contacted By', 'Assigned To', 'Contact Person', ...cfg.location]
        .map((h) => str(r, h)).join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (f.sort === 'new') rows = rows.slice().sort((a, b) => b.row - a.row);
    else if (f.sort === 'name') rows = rows.slice().sort((a, b) => str(a, 'Business Name').localeCompare(str(b, 'Business Name')));
    else rows = rows.slice().sort((a, b) => {
      const fa = followUpOf(tab, a), fb = followUpOf(tab, b);
      if (fa && fb) return fa.n - fb.n;
      if (fa) return -1;
      if (fb) return 1;
      return b.row - a.row;
    });
    const count = $('view').querySelector('[data-count]');
    if (count) count.textContent = `${rows.length} of ${all.length}`;
    const results = $('results');
    if (!rows.length) {
      results.innerHTML = all.length
        ? emptyState('No matches.', ' Try a different search or filter.', '<br><button class="btn btn-outline" type="button" data-clear>Clear filters</button>')
        : emptyState(`${cfg.title} is empty.`, ' Rows added in the sheet or the app show up here.');
      const clear = results.querySelector('[data-clear]');
      if (clear) clear.onclick = () => { f.q = ''; f.status = 'all'; renderTab(tab); };
      return;
    }
    results.innerHTML = `<div class="grid">${rows.map((r) => {
      const status = str(r, cfg.status);
      const fu = followUpOf(tab, r);
      const due = fu ? dueLabel(fu.n, fu.d) : null;
      const where = cfg.location.map((h) => str(r, h)).filter(Boolean).join(', ');
      const sub = [str(r, 'Category'), where].filter(Boolean).join(' · ');
      const who = str(r, 'Contacted By') || str(r, 'Assigned To');
      const extra = tab === 'Clients' ? str(r, 'Payment Status') : tab === 'Pipeline' && str(r, 'Quoted Value (₹)') ? rupees(str(r, 'Quoted Value (₹)').replace(/[^\d.]/g, '')) : str(r, 'Priority');
      return `<button class="card" type="button" data-row="${r.row}">
        <div class="card-top"><h3>${esc(str(r, 'Business Name'))}</h3>${status ? `<span class="pill ${statusClass(status)}">${esc(status)}</span>` : ''}</div>
        ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
        <div class="tags">${due ? `<span class="pill ${due.cls}">${esc(due.text)}</span>` : ''}${extra ? `<span class="pill">${esc(extra)}</span>` : ''}${
          who ? `<span class="pill">${esc(who)}</span>` : ''}</div>
      </button>`;
    }).join('')}</div>`;
    results.querySelectorAll('[data-row]').forEach((b) => {
      b.onclick = () => {
        const row = all.find((r) => r.row === Number(b.dataset.row));
        if (row) openRow(tab, row, b);
      };
    });
  };

  // ---------- drawer ----------

  let drawerOpener = null;
  let drawerDirty = () => false;

  const openDrawer = (html, opener) => {
    drawerOpener = opener || document.activeElement;
    drawerDirty = () => false;
    $('drawer').classList.remove('drawer-wide');
    $('drawer').innerHTML = html;
    $('drawer').hidden = false;
    $('drawer-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    const first = $('drawer').querySelector('[data-close]');
    if (first) first.focus();
  };
  const closeDrawer = (force) => {
    if ($('drawer').hidden) return true;
    if (!force && drawerDirty() && !confirm('Discard your unsaved changes?')) return false;
    $('drawer').hidden = true;
    $('drawer-backdrop').hidden = true;
    $('drawer').innerHTML = '';
    document.body.style.overflow = '';
    if (drawerOpener && document.contains(drawerOpener)) drawerOpener.focus();
    return true;
  };
  $('drawer-backdrop').addEventListener('click', () => closeDrawer());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('drawer').hidden) closeDrawer();
    if (e.key === 'Tab' && !$('drawer').hidden) {
      const items = [...$('drawer').querySelectorAll('button,input,select,textarea,a[href]')].filter((el) => !el.disabled && el.offsetParent);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  const fieldHtml = (spec, value, id) => {
    const label = `<label for="${id}">${esc(spec.h)}</label>`;
    const v = value === false ? '' : String(value);
    switch (spec.k) {
      case 'bool':
        return `<div class="field"><span class="field-label" aria-hidden="true">&nbsp;</span><label class="check" for="${id}" style="text-transform:none;font:15px 'DM Sans';color:var(--ink);letter-spacing:0">
          <input id="${id}" type="checkbox" data-h="${esc(spec.h)}" ${isTrue(value) ? 'checked' : ''}> ${esc(spec.h)}</label></div>`;
      case 'select': {
        const opts = spec.o.includes(v) || !v ? spec.o : [v, ...spec.o];
        return `<div class="field">${label}<select id="${id}" data-h="${esc(spec.h)}"><option value="">—</option>${opts
          .map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
      }
      case 'date':
        return `<div class="field">${label}<input id="${id}" type="date" data-h="${esc(spec.h)}" value="${/^\d{4}-\d{2}-\d{2}$/.test(v) ? esc(v) : ''}" ${
          v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? `placeholder="${esc(v)}"` : ''}></div>`;
      case 'longtext':
        return `<div class="field full">${label}<textarea id="${id}" data-h="${esc(spec.h)}">${esc(v)}</textarea></div>`;
      case 'money':
        return `<div class="field">${label}<input id="${id}" inputmode="decimal" data-h="${esc(spec.h)}" value="${esc(v)}"></div>`;
      case 'phone':
        return `<div class="field">${label}<input id="${id}" type="tel" data-h="${esc(spec.h)}" value="${esc(v.replace(/^'/, ''))}"></div>`;
      default:
        return `<div class="field">${label}<input id="${id}" data-h="${esc(spec.h)}" value="${esc(v)}"></div>`;
    }
  };

  const readForm = (root) => {
    const out = {};
    root.querySelectorAll('[data-h]').forEach((el) => {
      out[el.dataset.h] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return out;
  };

  const openRow = (tab, row, opener) => {
    const cfg = TABS[tab];
    const name = str(row, 'Business Name');
    const status = str(row, cfg.status);
    const editable = cfg.editable.filter((s) => s.h in row.values);
    const original = {};
    editable.forEach((s) => {
      const v = cell(row, s.h);
      original[s.h] = s.k === 'bool' ? isTrue(v) : String(v === false ? '' : v).replace(s.k === 'phone' ? /^'/ : /$^/, '');
    });

    const links = [];
    const phone = phoneDigits(str(row, cfg.phone));
    if (phone) {
      links.push(`<a class="btn btn-outline btn-sm" href="tel:+${phone}">Call</a>`);
      links.push(`<a class="btn btn-outline btn-sm" href="https://wa.me/${phone}" target="_blank" rel="noopener">WhatsApp</a>`);
    }
    const email = str(row, cfg.email || 'Email');
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) links.push(`<a class="btn btn-outline btn-sm" href="mailto:${esc(email)}">Email</a>`);
    const maps = safeUrl(str(row, cfg.maps || 'Maps Link'));
    if (maps) links.push(`<a class="btn btn-outline btn-sm" href="${esc(maps)}" target="_blank" rel="noopener">Maps</a>`);
    const insta = instagramUrl(str(row, cfg.instagram));
    if (insta) links.push(`<a class="btn btn-outline btn-sm" href="${esc(insta)}" target="_blank" rel="noopener">Instagram</a>`);
    const site = safeUrl(str(row, cfg.website || 'Website'));
    if (site) links.push(`<a class="btn btn-outline btn-sm" href="${esc(site)}" target="_blank" rel="noopener">Website</a>`);

    const fact = (h) => {
      const v = str(row, h);
      if (!v) return '';
      const url = safeUrl(v);
      return `<div class="fact"><span>${esc(h)}</span><p>${url && !/\s/.test(v) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</p></div>`;
    };
    const editableHeaders = editable.map((s) => s.h);
    const summaryHeaders = [cfg.service, ...cfg.summary].filter((h, i, a) => a.indexOf(h) === i && !editableHeaders.includes(h));
    const summary = summaryHeaders.map(fact).join('');
    const shown = new Set([...summaryHeaders, ...editable.map((s) => s.h), 'Business Name']);
    const rest = Object.keys(row.values).filter((h) => !shown.has(h)).map(fact).join('');
    const canMovePipeline = LEAD_TABS.includes(tab);
    const canMakeClient = LEAD_TABS.includes(tab) || tab === 'Pipeline';
    const where = cfg.location.map((h) => str(row, h)).filter(Boolean).join(', ');

    openDrawer(`
      <div class="drawer-head"><div class="grow">
        <p class="eyebrow">${esc(cfg.title)} · row ${row.row}</p>
        <h2 id="drawer-title">${esc(name)}</h2>
        <span class="meta">${esc([str(row, 'Category'), where].filter(Boolean).join(' · '))}</span>
        ${status ? ` <span class="pill ${statusClass(status)}">${esc(status)}</span>` : ''}
      </div><button class="btn btn-outline icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body">
        ${links.length ? `<div class="quick">${links.join('')}</div>` : ''}
        ${LEAD_TABS.includes(tab) && !isTrue(cell(row, 'Reached Out')) ? '<div><button class="btn btn-accent" type="button" data-contacted>Mark contacted</button></div>' : ''}
        ${summary ? `<div class="facts">${summary}</div>` : ''}
        ${editable.length ? `<div><p class="block-title">Update</p><form class="form" data-form>${editable.map((s, i) => fieldHtml(s, original[s.h], 'f' + i)).join('')}</form></div>` : ''}
        ${rest ? `<details class="all"><summary>All details</summary><div class="facts">${rest}</div></details>` : ''}
        <div class="quick">
          ${tab !== 'Clients' ? '<button class="btn btn-accent" type="button" data-pitch>Pitch deck</button><button class="btn" type="button" data-assist>Start Assist</button>' : ''}
          <button class="btn btn-outline" type="button" data-share>Send to teammate</button>
          ${canMovePipeline ? '<button class="btn btn-outline" type="button" data-move="Pipeline">Move to Pipeline</button>' : ''}
          ${canMakeClient ? '<button class="btn btn-outline" type="button" data-move="Clients">Make client</button>' : ''}</div>
      </div>
      <div class="drawer-foot"><span class="status-text" data-status-text>No changes</span>
        <button class="btn btn-outline" type="button" data-close-foot>Close</button>
        <button class="btn btn-primary" type="button" data-save disabled>Save</button></div>`, opener);

    const drawer = $('drawer');
    const form = drawer.querySelector('[data-form]');
    // Baseline is what the form shows, so values the inputs can't represent don't count as edits.
    if (form) Object.assign(original, readForm(form));
    const changes = () => {
      if (!form) return {};
      const now = readForm(form);
      const diff = {};
      Object.keys(now).forEach((h) => { if (now[h] !== original[h]) diff[h] = now[h]; });
      return diff;
    };
    const refreshDirty = () => {
      const diff = changes();
      const n = Object.keys(diff).length;
      drawer.querySelector('[data-save]').disabled = !n;
      drawer.querySelector('[data-status-text]').textContent = n ? `${n} unsaved change${n > 1 ? 's' : ''}` : 'No changes';
      if (form) form.querySelectorAll('[data-h]').forEach((el) => el.closest('.field').classList.toggle('changed', el.dataset.h in diff));
    };
    drawerDirty = () => Object.keys(changes()).length > 0;
    if (form) {
      form.addEventListener('input', refreshDirty);
      form.addEventListener('change', refreshDirty);
      form.addEventListener('submit', (e) => e.preventDefault());
    }
    drawer.querySelector('[data-close]').onclick = () => closeDrawer();
    drawer.querySelector('[data-close-foot]').onclick = () => closeDrawer();

    const busy = (on, label) => {
      drawer.querySelectorAll('button').forEach((b) => { if (!b.matches('[data-close],[data-close-foot]')) b.disabled = on; });
      if (label) drawer.querySelector('[data-status-text]').textContent = label;
      if (!on) refreshDirty();
    };

    const save = async (diff) => {
      if (!Object.keys(diff).length) return true;
      busy(true, 'Saving…');
      try {
        const data = await api('update', { tab, row: row.row, businessName: name, changes: diff });
        Object.assign(row.values, diff);
        if (typeof data.row === 'number') row.row = data.row;
        Object.keys(diff).forEach((h) => (original[h] = diff[h]));
        state.summary = null;
        toast('Saved to the sheet');
        busy(false);
        if (state.section === tab) renderResults(tab);
        return true;
      } catch (error) {
        busy(false);
        drawer.querySelector('[data-status-text]').textContent = 'Not saved';
        handleError(error);
        return false;
      }
    };
    drawer.querySelector('[data-save]').onclick = () => save(changes());

    const contacted = drawer.querySelector('[data-contacted]');
    if (contacted) contacted.onclick = async () => {
      const set = { 'Reached Out': true, 'Contacted By': str(row, 'Contacted By') || state.session.name, 'Date Contacted': todayIso() };
      if (!status || status === 'Not contacted') set.Status = 'Contacted';
      if (!str(row, 'Next Follow-up')) set['Next Follow-up'] = isoPlusDays(3);
      const ok = await save(Object.assign(changes(), set));
      if (ok) openRow(tab, row, opener);
    };

    const pitchButton = drawer.querySelector('[data-pitch]');
    const assistButton = drawer.querySelector('[data-assist]');
    if (assistButton) assistButton.onclick = () => openAssist(tab, row);
    if (pitchButton) pitchButton.onclick = () => { if (closeDrawer()) openPitch(tab, row, opener); };
    const shareButton = drawer.querySelector('[data-share]');
    if (shareButton) shareButton.onclick = () => {
      if (!closeDrawer()) return;
      state.shareLead = { tab, row: row.row, business: name };
      if (!state.openChat) state.openChat = TEAM_CHAT;
      state.openFresh = true;
      go('inbox');
    };

    drawer.querySelectorAll('[data-move]').forEach((b) => {
      b.onclick = async () => {
        const to = b.dataset.move;
        const question = to === 'Pipeline'
          ? `Move ${name} to Pipeline? It is copied there with stage "Meeting set".`
          : `Make ${name} a client? It is copied to Clients and marked "Became client" here.`;
        if (!confirm(question)) return;
        if (!(await save(changes()))) return;
        busy(true, to === 'Pipeline' ? 'Moving…' : 'Adding to Clients…');
        try {
          const data = await api('move', { fromTab: tab, row: row.row, businessName: name, to });
          toast(data.duplicate ? `${name} is already in ${TABS[to].title}` : `${name} added to ${TABS[to].title}`);
          delete state.tabs[to];
          state.summary = null;
          closeDrawer(true);
          renderTab(tab, true);
        } catch (error) {
          busy(false);
          handleError(error);
        }
      };
    });
  };

  // ---------- Social ----------

  const loadSocial = async (force) => {
    if (state.social && !force) return state.social;
    state.social = await api('socialList');
    return state.social;
  };

  const renderSocial = async (force) => {
    const view = $('view');
    view.innerHTML = `
      <div class="view-head"><div><p class="eyebrow">Social Autopilot</p><h2>Social</h2></div>
        <button class="btn btn-outline btn-sm" type="button" data-refresh>Refresh</button></div>
      <div class="chips" role="group" aria-label="Social section">
        ${[['posts', 'Posts'], ['ideas', 'Ideas'], ['setup', 'Services & offers']].map(([id, t]) =>
          `<button class="chip" type="button" data-sv="${id}" aria-pressed="${state.socialView === id}">${t}</button>`).join('')}
      </div><div id="social-body">${skeletons(3)}</div>`;
    view.querySelector('[data-refresh]').onclick = () => renderSocial(true);
    view.querySelectorAll('[data-sv]').forEach((b) => (b.onclick = () => { state.socialView = b.dataset.sv; renderSocial(); }));
    try {
      await loadSocial(force);
    } catch (error) {
      handleError(error);
      if (state.section === 'social' && $('social-body')) {
        $('social-body').innerHTML = emptyState("Couldn't load Social.", ' ' + error.message,
          '<br><button class="btn btn-outline" type="button" data-retry>Try again</button>');
        $('social-body').querySelector('[data-retry]').onclick = () => renderSocial(true);
      }
      return;
    }
    if (state.section !== 'social') return;
    if (state.socialView === 'ideas') renderIdeas();
    else if (state.socialView === 'setup') renderSetup();
    else renderPosts();
  };

  const postStatus = (p) => String(p.values.Status || '').trim() || 'Pending';
  const LOCKED = ['Publishing', 'Posted'];

  const renderPosts = () => {
    const body = $('social-body');
    const posts = (state.social.posts || []).filter((p) => String(p.values['Post ID'] || '').trim()).slice().reverse();
    const filters = ['Pending', 'Approved', 'Posted', 'Rejected', 'Error', 'All'];
    const shown = state.postFilter === 'All' ? posts : posts.filter((p) => postStatus(p) === state.postFilter);
    body.innerHTML = `
      <div class="chips" role="group" aria-label="Post status">${filters.map((f) => {
        const n = f === 'All' ? posts.length : posts.filter((p) => postStatus(p) === f).length;
        return `<button class="chip" type="button" data-pf="${f}" aria-pressed="${state.postFilter === f}">${f} <span class="meta">${n}</span></button>`;
      }).join('')}</div>
      ${shown.length ? `<div class="grid">${shown.map((p) => postCard(p)).join('')}</div>`
        : emptyState(state.postFilter === 'Pending' ? 'Nothing to review.' : 'No posts here.', state.postFilter === 'Pending' ? ' New drafts from the automation appear here for approval.' : '')}`;
    body.querySelectorAll('[data-pf]').forEach((b) => (b.onclick = () => { state.postFilter = b.dataset.pf; renderPosts(); }));
    body.querySelectorAll('[data-post]').forEach((el) => {
      const post = posts.find((p) => String(p.values['Post ID']) === el.dataset.post);
      el.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => setPost(post, { Status: b.dataset.set }, b)));
      const edit = el.querySelector('[data-edit]');
      if (edit) edit.onclick = () => openPost(post, edit);
    });
  };

  const postCard = (p) => {
    const v = p.values;
    const status = postStatus(p);
    const img = driveImage(v['Image URL']);
    const locked = LOCKED.includes(status);
    const meta = [v.Service, v['Hook style'], v['AI rating'] ? 'AI ' + v['AI rating'] : ''].filter(Boolean).join(' · ');
    const stats = status === 'Posted' ? [['Reach', v.Reach], ['Likes', v.Likes], ['Saves', v.Saves]].filter(([, n]) => n !== '' && n != null).map(([k, n]) => `${k} ${n}`).join(' · ') : '';
    return `<article class="card post" data-post="${esc(v['Post ID'])}">
      <div class="post-media">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="meta">No image yet</span>'}</div>
      <div class="post-body">
        <div class="card-top"><h3>${esc(v.Hook || 'Untitled post')}</h3><span class="pill ${statusClass(status)}">${esc(status)}</span></div>
        ${meta ? `<span class="meta">${esc(meta)}</span>` : ''}
        ${v.Caption ? `<div class="clamp">${esc(v.Caption)}</div>` : ''}
        ${v.Hashtags ? `<div class="hashtags">${esc(v.Hashtags)}</div>` : ''}
        ${v['Owner note'] ? `<div class="note-line">Note: ${esc(v['Owner note'])}</div>` : ''}
        ${status === 'Error' && v['Error detail'] ? `<div class="note-line" style="color:var(--danger)">${esc(v['Error detail'])}</div>` : ''}
        ${stats ? `<div class="meta">${esc(stats)}</div>` : ''}
        ${safeUrl(v['Instagram link']) ? `<a class="meta" href="${esc(safeUrl(v['Instagram link']))}" target="_blank" rel="noopener">Open on Instagram ↗</a>` : ''}
        ${locked ? '' : `<div class="post-actions">
          ${status !== 'Approved' ? '<button class="btn btn-primary btn-sm" type="button" data-set="Approved">Approve</button>' : ''}
          ${status !== 'Rejected' ? '<button class="btn btn-danger btn-sm" type="button" data-set="Rejected">Reject</button>' : ''}
          ${status !== 'Pending' ? '<button class="btn btn-outline btn-sm" type="button" data-set="Pending">Back to pending</button>' : ''}
          <button class="btn btn-outline btn-sm" type="button" data-edit>Edit</button></div>`}
      </div></article>`;
  };

  const setPost = async (post, changes, button) => {
    if (button) button.disabled = true;
    try {
      await api('socialUpdatePost', { postId: String(post.values['Post ID']), expectedStatus: String(post.values.Status || '').trim(), changes });
      Object.assign(post.values, changes);
      state.summary = null;
      toast(changes.Status ? `Post ${changes.Status.toLowerCase()}` : 'Post saved');
      if (state.section === 'social' && state.socialView === 'posts') renderPosts();
      return true;
    } catch (error) {
      if (button) button.disabled = false;
      handleError(error);
      if (/refresh/i.test(error.message)) state.social = null;
      return false;
    }
  };

  const openPost = (post, opener) => {
    const v = post.values;
    const original = { Caption: String(v.Caption || ''), Hashtags: String(v.Hashtags || ''), 'Owner note': String(v['Owner note'] || '') };
    openDrawer(`
      <div class="drawer-head"><div class="grow"><p class="eyebrow">Post ${esc(v['Post ID'])} · ${esc(postStatus(post))}</p>
        <h2 id="drawer-title">${esc(v.Hook || 'Untitled post')}</h2></div>
        <button class="btn btn-outline icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body"><form class="form" data-form>
        <div class="field full"><label for="pc">Caption</label><textarea id="pc" data-h="Caption" style="min-height:200px">${esc(original.Caption)}</textarea></div>
        <div class="field full"><label for="ph">Hashtags</label><textarea id="ph" data-h="Hashtags">${esc(original.Hashtags)}</textarea></div>
        <div class="field full"><label for="pn">Owner note</label><textarea id="pn" data-h="Owner note" placeholder="What should change? The automation reads this.">${esc(original['Owner note'])}</textarea></div>
      </form></div>
      <div class="drawer-foot"><span class="status-text" data-status-text></span>
        <button class="btn btn-outline" type="button" data-close-foot>Close</button>
        <button class="btn btn-primary" type="button" data-save>Save</button></div>`, opener);
    const drawer = $('drawer');
    const form = drawer.querySelector('[data-form]');
    const diff = () => {
      const now = readForm(form);
      const out = {};
      Object.keys(now).forEach((h) => { if (now[h] !== original[h].trim()) out[h] = now[h]; });
      return out;
    };
    drawerDirty = () => Object.keys(diff()).length > 0;
    drawer.querySelector('[data-close]').onclick = () => closeDrawer();
    drawer.querySelector('[data-close-foot]').onclick = () => closeDrawer();
    drawer.querySelector('[data-save]').onclick = async (e) => {
      const d = diff();
      if (!Object.keys(d).length) { closeDrawer(true); return; }
      e.target.disabled = true;
      drawer.querySelector('[data-status-text]').textContent = 'Saving…';
      if (await setPost(post, d)) closeDrawer(true);
      else { e.target.disabled = false; drawer.querySelector('[data-status-text]').textContent = 'Not saved'; }
    };
  };

  const renderIdeas = () => {
    const body = $('social-body');
    const ideas = (state.social.suggestions || []).slice().reverse();
    body.innerHTML = `<div class="two-col">
      <form class="panel form" data-idea style="grid-template-columns:1fr">
        <p class="block-title" style="margin:0">New idea</p>
        <div class="field"><label for="is">Idea</label><textarea id="is" required placeholder="A post you'd like the automation to make"></textarea></div>
        <div class="field"><label for="il">Reference link (optional)</label><input id="il" inputmode="url" placeholder="https://"></div>
        <div class="field"><label for="ip">Reference image (optional)</label><input id="ip" type="file" accept="image/*"></div>
        <p class="form-error" data-err style="color:var(--danger);margin:0"></p>
        <button class="btn btn-primary" type="submit">Add idea</button>
      </form>
      <div class="list">${ideas.length ? ideas.map((i) => {
        const v = i.values;
        const ref = safeUrl(v['Reference image']);
        return `<div class="panel"><div class="card-top"><strong style="white-space:pre-line">${esc(v.Suggestion)}</strong>${
          v.Status ? `<span class="pill ${v.Status === 'Used' ? 's-won' : 's-new'}">${esc(v.Status)}</span>` : ''}</div>
          <span class="meta">${esc(shortDate(String(v.Added || '')))}${v['Used in post'] ? ' · used in ' + esc(v['Used in post']) : ''}</span>
          ${ref ? ` · <a class="meta" href="${esc(ref)}" target="_blank" rel="noopener">reference ↗</a>` : ''}</div>`;
      }).join('') : emptyState('No ideas yet.', ' Add one and the automation will pick it up.')}</div></div>`;
    const form = body.querySelector('[data-idea]');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const suggestion = form.querySelector('#is').value.trim();
      const err = form.querySelector('[data-err]');
      if (!suggestion) { err.textContent = 'Write the idea first.'; form.querySelector('#is').focus(); return; }
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      button.textContent = 'Adding…';
      err.textContent = '';
      try {
        const file = form.querySelector('#ip').files[0];
        const photoBase64 = file ? await imageToBase64(file) : '';
        await api('socialAddSuggestion', { suggestion, referenceLink: form.querySelector('#il').value.trim(), photoBase64, addedBy: state.session.name });
        toast('Idea added');
        state.social = null;
        renderSocial();
      } catch (error) {
        handleError(error);
        err.textContent = error.message;
        button.disabled = false;
        button.textContent = 'Add idea';
      }
    };
  };

  const imageToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read. Try a JPG or PNG.")); };
      img.src = url;
    });

  const renderSetup = () => {
    const body = $('social-body');
    const list = (tab, records) => {
      const items = records.map((r) => {
        const name = recordName(r);
        if (!name) return '';
        const detail = [r.values.Service, r.values.Notes].filter(Boolean).join(' · ');
        return `<div class="toggle-row"><div><strong>${esc(name)}</strong>${detail ? `<div class="meta">${esc(detail)}</div>` : ''}</div>
          <label class="switch"><input type="checkbox" data-tab="${tab}" data-name="${esc(name)}" ${isTrue(r.values.Active) ? 'checked' : ''} aria-label="${esc(name)} active"><span></span></label></div>`;
      }).join('');
      return `<div class="panel"><p class="block-title">${tab}</p>${items || '<p class="meta">None listed in the sheet.</p>'}</div>`;
    };
    body.innerHTML = `<p class="meta" style="margin:-4px 0 14px">Active items are what the automation can post about.</p>
      <div class="two-col">${list('Services', state.social.services || [])}${list('Offers', state.social.offers || [])}</div>`;
    body.querySelectorAll('[data-tab]').forEach((input) => {
      input.onchange = async () => {
        input.disabled = true;
        try {
          await api('socialSetActive', { tab: input.dataset.tab, name: input.dataset.name, active: input.checked });
          const rec = (input.dataset.tab === 'Services' ? state.social.services : state.social.offers)
            .find((r) => recordName(r) === input.dataset.name);
          if (rec) rec.values.Active = input.checked;
          toast(`${input.dataset.name} ${input.checked ? 'on' : 'off'}`);
        } catch (error) {
          input.checked = !input.checked;
          handleError(error);
        } finally {
          input.disabled = false;
        }
      };
    });
  };

  // The script matches Services/Offers rows by their first column.
  function recordName(r) {
    return String(Object.values(r.values)[0] || '').trim();
  }

  // ---------- AI (scouting + pitch decks) ----------
  // scout-ai.js is the app's own pipeline and pitch code, bundled for the browser.
  // Its API calls come back here and go through the Apps Script, which holds the keys.

  window.ScoutProxy = async (url, payload, headers) => {
    const data = await api('aiProxy', { url, payload, headers });
    return { status: data.status, text: data.text };
  };

  window.ScoutInstagram = (username) => api('webInstagram', { username });

  let aiLoading = null;
  const loadAi = () => {
    if (window.ScoutAI) return Promise.resolve(window.ScoutAI);
    if (!aiLoading) {
      aiLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'scout-ai.js?v=12';
        s.onload = () => resolve(window.ScoutAI);
        s.onerror = () => { aiLoading = null; reject(new Error("Couldn't load the scouting tools. Check your connection.")); };
        document.head.appendChild(s);
      });
    }
    return aiLoading;
  };

  const aiSettings = async () => {
    if (!state.aiKeys) {
      try {
        state.aiKeys = (await api('aiProxy', { check: true })).keys || {};
      } catch (error) {
        if (/unknown action/i.test(error.message)) {
          throw new Error('The sheet script needs the AI update (AiProxy.gs) before scouting and pitch decks work.');
        }
        throw error;
      }
    }
    const k = state.aiKeys;
    if (!k.gemini && !k.claude) throw new Error('No AI key in the sheet script yet. Add GEMINI_API_KEY to its Script properties.');
    const via = (on) => (on ? 'via-script' : '');
    return {
      provider: k.gemini ? 'gemini' : 'claude',
      geminiKey: via(k.gemini), anthropicKey: via(k.claude), placesKey: via(k.places), tavilyKey: via(k.tavily),
      sheetUrl: '', sheetSecret: '', userName: state.session.name, model: '', githubToken: '',
    };
  };

  const shrinkImage = (file, maxWidth, quality) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read. Try a JPG or PNG.")); };
      img.src = url;
    });

  // ---------- Scout ----------

  const SCOUT_STEPS = [
    ['reading', 'Reading the photo'],
    ['maps', 'Searching Google Maps'],
    ['web', 'Searching the web'],
    ['matching', 'Matching the details'],
    ['website', 'Reading their website'],
    ['competitors', 'Checking nearby competitors'],
  ];
  const LEAD_FIELDS = [
    { k: 'businessName', h: 'Business name' }, { k: 'category', h: 'Category' }, { k: 'area', h: 'Area' },
    { k: 'phone', h: 'Phone / WhatsApp', t: 'tel' }, { k: 'email', h: 'Email' }, { k: 'contactPerson', h: 'Contact person' },
    { k: 'instagram', h: 'Instagram' }, { k: 'facebook', h: 'Facebook' }, { k: 'website', h: 'Website' }, { k: 'mapsUrl', h: 'Maps link' },
    { k: 'rating', h: 'Google rating' }, { k: 'reviewCount', h: 'Reviews' },
    { k: 'bestFitService', h: 'Best-fit service', select: 'services' }, { k: 'fitScore', h: 'Fit score (1-5)', select: ['1', '2', '3', '4', '5'] },
    { k: 'digitalGaps', h: 'Digital gaps spotted', long: true }, { k: 'pitchAngle', h: 'Pitch angle', long: true },
    { k: 'scoreReason', h: 'Score reason', long: true }, { k: 'otherLinks', h: 'Other listings', long: true },
    { k: 'note', h: 'Your note', long: true },
  ];

  const newScout = () => ({ step: 'capture', photo: null, lat: null, lng: null, accuracy: null, area: '', note: '', progress: '', lead: null, warnings: [], error: '' });

  const renderScout = () => {
    const sc = (state.scout = state.scout || newScout());
    const view = $('view');
    const head = `<div class="view-head"><div><p class="eyebrow">New lead</p><h2>Scout</h2></div>
      ${sc.step !== 'capture' && sc.step !== 'running' ? '<button class="btn btn-outline btn-sm" type="button" data-again>Scout another</button>' : ''}</div>`;

    if (sc.step === 'running') {
      const at = SCOUT_STEPS.findIndex(([id]) => id === sc.progress);
      view.innerHTML = head + `<div class="panel" style="max-width:520px"><p class="block-title">Looking it up</p><div class="list">${SCOUT_STEPS.map(([id, label], i) =>
        `<div class="toggle-row"><span>${esc(label)}</span><span class="pill ${i < at ? 's-won' : i === at ? 'due-today' : ''}">${i < at ? 'Done' : i === at ? 'Working…' : 'Waiting'}</span></div>`).join('')}</div>
        <p class="meta" style="margin-top:12px">Takes about 20–40 seconds. You can leave this tab open and come back.</p></div>`;
      return;
    }

    if (sc.step === 'saved') {
      view.innerHTML = head + `<div class="panel" style="max-width:520px">
        <p class="block-title">Saved to Local leads</p>
        <h3 class="section-title" style="margin:6px 0 10px">${esc(sc.lead.businessName)}</h3>
        ${sc.duplicate ? `<p style="color:var(--danger);margin:0 0 12px">This looks like a duplicate of an existing lead. It was saved anyway and noted in Remarks, so check row ${esc(sc.duplicate)}.</p>` : ''}
        <div class="quick"><button class="btn btn-primary" type="button" data-open>Open the lead</button>
        <button class="btn btn-outline" type="button" data-again2>Scout another</button></div></div>`;
      view.querySelector('[data-again]').onclick = view.querySelector('[data-again2]').onclick = () => { state.scout = newScout(); renderScout(); };
      view.querySelector('[data-open]').onclick = async (e) => {
        go('Leads');
        await ensureTab('Leads', true).catch(handleError);
        const row = findRow('Leads', sc.row, sc.lead.businessName);
        if (row) openRow('Leads', row, e.target);
      };
      return;
    }

    if (sc.step === 'review') {
      const services = (window.ScoutAI && window.ScoutAI.SERVICES) || SERVICES;
      const lead = sc.lead;
      const field = (f) => {
        const v = lead[f.k] == null ? '' : String(lead[f.k]);
        const id = 'lf-' + f.k;
        let input;
        if (f.select) {
          const opts = f.select === 'services' ? services : f.select;
          const all = v && !opts.includes(v) ? [v, ...opts] : opts;
          input = `<select id="${id}" data-k="${f.k}"><option value="">—</option>${all.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        } else if (f.long) input = `<textarea id="${id}" data-k="${f.k}">${esc(v)}</textarea>`;
        else input = `<input id="${id}" data-k="${f.k}" ${f.t ? `type="${f.t}"` : ''} value="${esc(v)}">`;
        return `<div class="field${f.long ? ' full' : ''}"><label for="${id}">${esc(f.h)}</label>${input}</div>`;
      };
      const comps = lead.competitors || [];
      view.innerHTML = head + `<div class="two-col" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div class="panel"><div class="card-top" style="margin-bottom:14px"><p class="block-title" style="margin:0">Check before saving</p>
          <span class="pill ${lead.confidence === 'high' ? 's-won' : lead.confidence === 'medium' ? 's-warm' : 's-dead'}">${esc(lead.confidence || 'low')} match</span></div>
          ${lead.matchNotes ? `<p class="meta" style="margin:0 0 14px">${esc(lead.matchNotes)}</p>` : ''}
          <form class="form" data-lead>${LEAD_FIELDS.map(field).join('')}</form>
          <p class="form-error" data-err style="color:var(--danger);margin:14px 0 0"></p>
          <div class="quick" style="margin-top:14px"><button class="btn btn-primary" type="button" data-save-lead>Save to Local leads</button>
          <button class="btn btn-outline" type="button" data-again2>Discard</button></div></div>
        <div class="list">
          ${sc.photo ? `<img src="${sc.photo.dataUrl}" alt="The photo you scouted" style="width:100%;border-radius:12px;border:1px solid var(--line)">` : ''}
          ${sc.warnings.length ? `<div class="panel"><p class="block-title">Heads-up</p>${sc.warnings.map((w) => `<p class="meta" style="margin:0 0 6px">${esc(w)}</p>`).join('')}</div>` : ''}
          <div class="panel"><p class="block-title">Nearby competitors</p>${comps.length ? comps.map((c) =>
            `<div class="toggle-row"><span>${esc(c.name)}</span><span class="meta">${c.rating != null ? esc(c.rating) + '★ ' : ''}${c.reviewCount != null ? esc(c.reviewCount) + ' reviews' : ''}</span></div>`).join('')
            : '<p class="meta" style="margin:0">None found.</p>'}</div></div></div>`;
      view.querySelector('[data-again]').onclick = view.querySelector('[data-again2]').onclick = () => {
        if (confirm('Discard this lead? Nothing has been saved yet.')) { state.scout = newScout(); renderScout(); }
      };
      const form = view.querySelector('[data-lead]');
      form.addEventListener('input', (e) => { if (e.target.dataset.k) lead[e.target.dataset.k] = e.target.value; });
      form.addEventListener('change', (e) => { if (e.target.dataset.k) lead[e.target.dataset.k] = e.target.value; });
      view.querySelector('[data-save-lead]').onclick = async (e) => {
        const err = view.querySelector('[data-err]');
        if (!String(lead.businessName || '').trim()) { err.textContent = 'Add the business name first.'; view.querySelector('#lf-businessName').focus(); return; }
        e.target.disabled = true;
        e.target.textContent = 'Saving…';
        err.textContent = '';
        try {
          const AI = await loadAi();
          const data = await api('addLead', {
            loggedBy: state.session.name,
            lead: {
              businessName: lead.businessName, category: lead.category, area: lead.area, mapsUrl: lead.mapsUrl, phone: lead.phone,
              instagram: lead.instagram, website: lead.website, digitalGaps: lead.digitalGaps, bestFitService: lead.bestFitService,
              fitScore: lead.fitScore ? Number(lead.fitScore) : null, scoreReason: lead.scoreReason, pitchAngle: lead.pitchAngle,
              note: lead.note, confidence: lead.confidence, matchNotes: lead.matchNotes, email: lead.email,
              contactPerson: lead.contactPerson, facebook: lead.facebook, otherLinks: lead.otherLinks, rating: lead.rating,
              reviewCount: lead.reviewCount, competitors: AI.competitorsToRemark(lead.competitors || []), source: 'gallery',
            },
            photoBase64: sc.photo ? sc.photo.base64 : '',
          });
          sc.row = data.row;
          sc.duplicate = data.duplicate ? data.row : 0;
          sc.step = 'saved';
          delete state.tabs.Leads;
          state.summary = null;
          toast('Saved to Local leads');
          if (state.section === 'scout') renderScout();
        } catch (error) {
          handleError(error);
          err.textContent = `Not saved yet. ${error.message} Your edits are still here, so try again.`;
          e.target.disabled = false;
          e.target.textContent = 'Save to Local leads';
        }
      };
      return;
    }

    // capture
    view.innerHTML = head + `<div class="two-col">
      <form class="panel form" data-capture style="grid-template-columns:1fr">
        <div class="field"><label for="sc-photo">Photo</label>
          <input id="sc-photo" type="file" accept="image/*" capture="environment">
          <span class="meta">A shop front, visiting card, flyer or a screenshot of their Instagram or Maps listing.</span></div>
        <div class="field"><label for="sc-area">Area or landmark</label><input id="sc-area" value="${esc(sc.area)}" placeholder="e.g. Kakkanad, Kochi"></div>
        <div><button class="btn btn-outline btn-sm" type="button" data-locate>${sc.lat != null ? 'Location added ✓' : 'Use my location'}</button>
          <span class="meta" data-loc-msg>${sc.lat != null ? ` ±${esc(Math.round(sc.accuracy || 0))} m` : ' Helps find the right shop on Maps.'}</span></div>
        <div class="field"><label for="sc-note">Note (optional)</label><textarea id="sc-note" placeholder="Anything you noticed: owner's name, what they asked for">${esc(sc.note)}</textarea></div>
        <p class="form-error" data-err style="color:var(--danger);margin:0">${esc(sc.error)}</p>
        <button class="btn btn-primary" type="submit">Find this business</button>
      </form>
      <div data-preview>${sc.photo ? `<img src="${sc.photo.dataUrl}" alt="Selected photo" style="width:100%;border-radius:12px;border:1px solid var(--line)">`
        : emptyState('No photo yet.', ' Pick one on the left. On a phone this opens the camera.')}</div></div>`;
    const form = view.querySelector('[data-capture]');
    const err = form.querySelector('[data-err]');
    form.querySelector('#sc-area').oninput = (e) => (sc.area = e.target.value);
    form.querySelector('#sc-note').oninput = (e) => (sc.note = e.target.value);
    form.querySelector('#sc-photo').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        sc.photo = await shrinkImage(file, 1280, 0.7);
        view.querySelector('[data-preview]').innerHTML = `<img src="${sc.photo.dataUrl}" alt="Selected photo" style="width:100%;border-radius:12px;border:1px solid var(--line)">`;
        err.textContent = '';
      } catch (error) {
        err.textContent = error.message;
      }
    };
    form.querySelector('[data-locate]').onclick = (e) => {
      const msg = form.querySelector('[data-loc-msg]');
      if (!navigator.geolocation) { msg.textContent = " This browser can't share location. Type the area instead."; return; }
      e.target.disabled = true;
      msg.textContent = ' Finding you…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sc.lat = pos.coords.latitude; sc.lng = pos.coords.longitude; sc.accuracy = pos.coords.accuracy;
          e.target.textContent = 'Location added ✓';
          e.target.disabled = false;
          msg.textContent = ` ±${Math.round(pos.coords.accuracy)} m`;
        },
        () => { e.target.disabled = false; msg.textContent = ' Location was blocked. Type the area instead.'; },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!sc.photo) { err.textContent = 'Pick a photo first.'; form.querySelector('#sc-photo').focus(); return; }
      sc.error = '';
      sc.step = 'running';
      sc.progress = 'reading';
      renderScout();
      try {
        const [AI, settings] = await Promise.all([loadAi(), aiSettings()]);
        const capture = { source: 'gallery', photoUri: '', photoBase64: sc.photo.base64, latitude: sc.lat, longitude: sc.lng, locality: sc.area.trim(), note: sc.note.trim() };
        const result = await AI.scoutBusiness(settings, capture, (step) => {
          sc.progress = step;
          if (state.section === 'scout') renderScout();
        });
        sc.lead = Object.assign({}, result.lead, { area: result.lead.area || sc.area.trim(), note: result.lead.note || sc.note.trim() });
        sc.warnings = result.warnings || [];
        sc.step = 'review';
      } catch (error) {
        if (error instanceof SessionExpired) { handleError(error); return; }
        sc.step = 'capture';
        sc.error = 'Lookup failed. ' + error.message;
      }
      if (state.section === 'scout') renderScout();
      else toast(sc.step === 'review' ? 'Scout finished. Open the Scout tab to review.' : 'Scout lookup failed.', sc.step !== 'review');
    };
  };

  // ---------- Pitch decks ----------

  const PITCH_STAGES = [['gathering', 'Reading the lead'], ['competitors', 'Checking competitors'], ['writing', 'Writing the deck']];

  // ---------- Scout Assist: typed, live help while on a call ----------
  const LOOKUP_LABEL = { google_place: 'Google listing', instagram: 'Instagram', competitors: 'Competitors', web_search: 'Web', site_text: 'Their website', page_speed: 'Site speed', domain_age: 'Domain age' };

  // Rotating particle globe with HUD rings; spins and pulses faster while Scout is working.
  const drawOrb = (canvas) => {
    const ctx = canvas.getContext('2d');
    const N = 520;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, j: Math.random() * 6.28 };
    });
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let spin = 0, energy = 0, t = 0;
    const W = canvas.width, C = W / 2;
    const frame = () => {
      if (!canvas.isConnected) return;
      const busy = canvas.classList.contains('thinking');
      energy += ((busy ? 1 : 0) - energy) * 0.06;
      const dt = reduce ? 0 : 1;
      t += dt * (0.016 + energy * 0.05);
      spin += dt * (0.004 + energy * 0.03);
      ctx.clearRect(0, 0, W, W);
      const R = C * 0.5 * (1 + Math.sin(t * 3) * 0.03 * (0.4 + energy));
      // outer HUD rings
      ctx.lineWidth = 2;
      [[0.93, 0.0, 60, 'rgba(246,183,60,.85)', 1], [0.8, 0.5, 18, 'rgba(92,225,255,.75)', -1.6], [0.68, 1.1, 90, 'rgba(124,92,255,.7)', 2.2]].forEach(([k, off, dash, col, sp]) => {
        ctx.beginPath();
        ctx.setLineDash([dash, dash * 0.6]);
        ctx.strokeStyle = col;
        ctx.lineDashOffset = -(t * 60 * sp + off * 100);
        ctx.arc(C, C, C * k, 0, 6.2832);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * 6.2832 + spin * 0.3;
        const long = i % 6 === 0;
        ctx.strokeStyle = long ? 'rgba(246,183,60,.9)' : 'rgba(255,255,255,.28)';
        ctx.lineWidth = long ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(a) * C * 0.97, C + Math.sin(a) * C * 0.97);
        ctx.lineTo(C + Math.cos(a) * C * (long ? 0.89 : 0.93), C + Math.sin(a) * C * (long ? 0.89 : 0.93));
        ctx.stroke();
      }
      // pulse wave while working
      if (energy > 0.05) {
        const p = (t * 1.5) % 1;
        ctx.strokeStyle = `rgba(92,225,255,${(1 - p) * 0.5 * energy})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(C, C, R * (1 + p * 0.9), 0, 6.2832);
        ctx.stroke();
      }
      // globe
      const cs = Math.cos(spin), sn = Math.sin(spin), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
      const proj = pts.map((p) => {
        const wob = 1 + Math.sin(t * 6 + p.j) * 0.05 * energy;
        const x1 = (p.x * cs - p.z * sn) * wob, z1 = (p.x * sn + p.z * cs) * wob;
        const y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
        return { x: C + x1 * R, y: C + y2 * R * wob, z: z2 };
      }).sort((a, b) => a.z - b.z);
      proj.forEach((q) => {
        const d = (q.z + 1) / 2;
        const warm = d > 0.55;
        ctx.fillStyle = warm ? `rgba(246,${150 + d * 90 | 0},60,${0.25 + d * 0.75})` : `rgba(92,${200 + d * 40 | 0},255,${0.15 + d * 0.6})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.1 + d * 2.1, 0, 6.2832);
        ctx.fill();
      });
      const g = ctx.createRadialGradient(C, C, 0, C, C, R * 0.8);
      g.addColorStop(0, `rgba(255,236,190,${0.22 + energy * 0.25})`);
      g.addColorStop(1, 'rgba(124,92,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(C, C, R * 0.8, 0, 6.2832);
      ctx.fill();
      requestAnimationFrame(frame);
    };
    frame();
  };

  const openAssist = (tab, row) => {
    closeDrawer();
    const cfg = TABS[tab];
    const name = str(row, 'Business Name');
    const noteHeader = cfg.editable.some((x) => x.h === 'Remarks') ? 'Remarks' : 'Notes';
    const turns = [];
    let busy = false;
    const el = document.createElement('div');
    el.className = 'assist';
    el.dataset.view = 'chat';
    const phone = phoneDigits(str(row, cfg.phone));
    el.innerHTML = `
      <div class="assist-top">
        <div class="assist-title"><strong>${esc(name)}</strong><span>${esc(cfg.title)} · Scout Assist</span></div>
        <div class="assist-tabs" role="tablist">
          <button type="button" data-view-btn="lead">Lead</button><button type="button" data-view-btn="chat" class="on">Assist</button><button type="button" data-view-btn="intel">Intel</button>
        </div>
        <button type="button" class="btn btn-ghost-light" data-close>End assist</button>
      </div>
      <div class="assist-grid">
        <section class="panel panel-lead" data-panel="lead" aria-label="Lead console"></section>
        <section class="assist-center" data-panel="chat">
          <div class="assist-body">
            <canvas class="orb" data-orb width="440" height="440" aria-hidden="true"></canvas>
            <div class="assist-status" data-status>Ready. Ask me anything about ${esc(name)}.</div>
            <div class="assist-feed" data-feed aria-live="polite"></div>
          </div>
          <div class="assist-quick" data-quick>
            ${['Quick summary', 'How are their reviews?', 'Is their website any good?', 'Who are their competitors?', 'Suggest an opening line', 'Write a WhatsApp follow-up'].map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
          </div>
          <form class="assist-form" data-form>
            <input data-input type="text" autocomplete="off" placeholder="Type what you need, e.g. “mark interested, call back Friday”" aria-label="Ask Scout Assist" />
            <button class="btn btn-accent" type="submit">Ask</button>
          </form>
        </section>
        <section class="panel panel-intel" data-panel="intel" aria-label="Live intel"></section>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('assist-open');
    const feed = el.querySelector('[data-feed]');
    const status = el.querySelector('[data-status]');
    const input = el.querySelector('[data-input]');
    const orb = el.querySelector('[data-orb]');
    drawOrb(orb);
    const close = () => { document.removeEventListener('keydown', onKey); el.remove(); document.body.classList.remove('assist-open'); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    el.querySelector('[data-close]').onclick = close;
    el.querySelectorAll('[data-view-btn]').forEach((b) => (b.onclick = () => {
      el.dataset.view = b.dataset.viewBtn;
      el.querySelectorAll('[data-view-btn]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    input.focus();

    // ---- left: lead console (works without the AI) ----
    const save = async (changes, ok) => {
      try {
        await api('update', { tab, row: row.row, businessName: name, changes });
        Object.assign(row.values, changes);
        state.summary = null;
        toast(ok || 'Saved to the sheet');
        paintLead();
        return true;
      } catch (error) { toast(error.message || 'Could not save', true); return false; }
    };
    const logLine = (text) => {
      const cur = str(row, noteHeader);
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return `${cur ? cur + '\n' : ''}${today}: ${text} (via Assist, ${state.chat.me})`;
    };
    const paintLead = () => {
      const p = el.querySelector('[data-panel="lead"]');
      const statusNow = str(row, cfg.status);
      const fu = str(row, 'Next Follow-up');
      const fuDays = daysFromToday(fu);
      const notes = str(row, noteHeader).split('\n').filter(Boolean).slice(-3).reverse();
      const where = cfg.location.map((h) => str(row, h)).filter(Boolean).join(', ');
      p.innerHTML = `
        <h3>Lead console</h3>
        <div class="kv"><span>${esc(where || '—')}</span><span>${esc(str(row, cfg.service) || '')}</span></div>
        <div class="act-row">
          ${phone ? `<a class="pbtn" href="tel:+${phone}">Call</a><a class="pbtn" target="_blank" rel="noopener" href="https://wa.me/${phone}">WhatsApp</a>` : '<span class="muted">No phone in the sheet</span>'}
        </div>
        <h4>Status</h4>
        <div class="chips">${cfg.statuses.map((s) => `<button type="button" class="pchip${s === statusNow ? ' on' : ''}" data-status-set="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        ${tab !== 'Clients' ? `<h4>Next follow-up <em>${fu ? `${esc(shortDate(fu))}${fuDays !== null ? (fuDays < 0 ? ' · overdue' : fuDays === 0 ? ' · today' : ` · in ${fuDays}d`) : ''}` : 'not set'}</em></h4>
        <div class="chips">
          <button type="button" class="pchip" data-fu="1">Tomorrow</button><button type="button" class="pchip" data-fu="3">In 3 days</button><button type="button" class="pchip" data-fu="7">Next week</button>
          <input type="date" data-fu-date value="${esc(fu)}" aria-label="Pick follow-up date" />
        </div>` : ''}
        <h4>Log a note</h4>
        <form class="note-form" data-note-form><input data-note-input type="text" placeholder="e.g. owner busy, call after 4pm" autocomplete="off" aria-label="Note" /><button class="pbtn" type="submit">Log</button></form>
        ${notes.length ? `<h4>Recent notes</h4><ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
      p.querySelectorAll('[data-status-set]').forEach((b) => (b.onclick = () => {
        const s = b.dataset.statusSet;
        if (s === statusNow) return;
        const changes = { [cfg.status]: s };
        if (cfg.status === 'Status' && s !== 'Not contacted') changes['Reached Out'] = true;
        save(changes, `Status → ${s}`);
      }));
      p.querySelectorAll('[data-fu]').forEach((b) => (b.onclick = () => save({ 'Next Follow-up': isoPlusDays(Number(b.dataset.fu)) }, 'Follow-up set')));
      const dateInput = p.querySelector('[data-fu-date]');
      if (dateInput) dateInput.onchange = () => dateInput.value && save({ 'Next Follow-up': dateInput.value }, 'Follow-up set');
      p.querySelector('[data-note-form]').onsubmit = async (e) => {
        e.preventDefault();
        const v = p.querySelector('[data-note-input]').value.trim();
        if (v) await save({ [noteHeader]: logLine(v) }, 'Note logged');
      };
    };
    paintLead();

    // ---- right: live intel cards, filled as lookups finish ----
    const CARDS = [
      ['google_place', 'Google listing'], ['instagram', 'Instagram'], ['page_speed', 'Site speed'],
      ['domain_age', 'Domain'], ['competitors', 'Competitors'], ['web_search', 'Web'],
    ];
    const intel = el.querySelector('[data-panel="intel"]');
    intel.innerHTML = '<h3>Live intel</h3>' + CARDS.map(([k, t]) => `<article class="card idle" data-card="${k}"><header>${t}<i></i></header><div class="body muted">Waiting</div></article>`).join('');
    const postTiles = (list, big) => (list || []).map((m) => !m.image ? `<a class="ig-tile text" href="${esc(m.link || '#')}" target="_blank" rel="noopener"><span class="cap">${esc(m.when)} · ♥ ${m.likes} · 💬 ${m.comments}<br>${esc(m.caption || 'No caption')}<br><u>Open on Instagram</u> (Instagram sent no image for this post)</span></a>` : `<a class="ig-tile${big ? ' big' : ''}" href="${esc(m.link || '#')}" target="_blank" rel="noopener" title="${esc(m.caption || '')}"><img src="${esc(m.image)}" alt="Instagram post ${esc(m.when || '')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('broken')">${m.video ? '<span class="vid">▶</span>' : ''}${big ? `<span class="cap">${esc(m.when)} · ♥ ${m.likes} · 💬 ${m.comments}${m.caption ? '<br>' + esc(m.caption) : ''}</span>` : ''}</a>`).join('');
    const bar = (label, v) => `<div class="meter"><span>${label}</span><div><b style="width:${v ?? 0}%" class="${v >= 90 ? 'g' : v >= 50 ? 'a' : 'r'}"></b></div><em>${v ?? '?'}</em></div>`;
    const render = {
      google_place: (d) => `<div class="big">${d.rating ?? '–'}<small>★ · ${d.reviews ?? '?'} reviews</small></div><div class="muted">${esc(d.status === 'OPERATIONAL' ? 'Open for business' : d.status || 'Status unknown')}${d.website ? '' : ' · no website listed'}</div>${d.mapsUrl ? `<a href="${esc(d.mapsUrl)}" target="_blank" rel="noopener">Open in Maps</a>` : ''}`,
      instagram: (d) => d.missing ? '<div class="muted">Not a public business account</div>' : `<div class="muted">@${esc(d.handle)}</div><div class="big">${Number(d.followers || 0).toLocaleString('en-IN')}<small> followers</small></div><div class="muted">${d.posts ?? '?'} posts · last ${esc(d.last || 'unknown')} · ~${d.avgLikes} likes</div>${d.bio ? `<div class="muted">${esc(d.bio)}</div>` : ''}${d.recent && d.recent.length ? `<div class="ig-strip">${postTiles(d.recent)}</div>` : ''}`,
      page_speed: (d) => bar('Speed', d.performance) + bar('SEO', d.seo) + bar('Access.', d.accessibility) + (d.lcp ? `<div class="muted">Main content in ${esc(d.lcp)}</div>` : ''),
      domain_age: (d) => d.registered ? `<div class="big">${d.years}<small> years old</small></div><div class="muted">${esc(d.domain)} · registered ${esc(d.registered)}</div>` : `<div class="muted">${esc(d.domain || '')}: date not published</div>`,
      competitors: (d) => (d.list && d.list.length ? `<ul class="plain">${d.list.map((c) => `<li><span>${esc(c.name)}</span><em>${c.rating ?? '–'}★ ${c.reviews ?? ''}</em></li>`).join('')}</ul>` : '<div class="muted">None found nearby</div>'),
      web_search: (d) => `<ul class="plain">${(d.results || []).map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><em>${esc(r.host)}</em></li>`).join('')}</ul>`,
    };
    const setCard = (tool, st, result) => {
      const c = intel.querySelector(`[data-card="${tool}"]`);
      if (!c || (st !== 'run' && !result)) return;
      c.className = 'card ' + st;
      const body = c.querySelector('.body') || c.appendChild(Object.assign(document.createElement('div'), { className: 'body' }));
      body.className = 'body';
      if (st === 'run') { body.className = 'body muted'; body.textContent = 'Fetching…'; }
      else if (st === 'done' && result && result.data && render[tool]) body.innerHTML = render[tool](result.data);
      else { body.className = 'body muted'; body.textContent = result ? result.text.slice(0, 120) : 'Not available'; }
    };

    // ---- centre: chat ----
    let sessionPromise = null;
    const getSession = () => {
      if (!sessionPromise) {
        sessionPromise = (async () => {
          const [AI, settings] = await Promise.all([loadAi(), aiSettings()]);
          await Promise.all(Object.keys(TABS).map((t) => ensureTab(t).catch(() => null)));
          const tabs = {};
          Object.keys(TABS).forEach((t) => (tabs[t] = (state.tabs[t] && state.tabs[t].rows) || []));
          const world = { me: state.chat.me, members: state.chat.members.filter((x) => normName(x) !== normName(state.chat.me)), tabs, social: state.social };
          return { AI, session: AI.createAssistSession(settings, world, findRow(tab, row.row, name) || row) };
        })();
        sessionPromise.catch(() => { sessionPromise = null; });
      }
      return sessionPromise;
    };
    const cardProgress = ({ tool, state: st, result }) => { if (tool !== 'think') setCard(tool, st === 'run' ? 'run' : st, result); };
    getSession().then((x) => x.session.prefetch(cardProgress)).catch((e) => CARDS.forEach(([k]) => setCard(k, 'fail', { text: e.message })));

    const toEnd = () => requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' }));
    const add = (cls, html) => {
      const d = document.createElement('div');
      d.className = cls;
      d.innerHTML = html;
      feed.appendChild(d);
      d.querySelectorAll('img').forEach((img) => img.addEventListener('load', toEnd));
      toEnd();
      return d;
    };

    const ask = async (question) => {
      if (busy || !question.trim()) return;
      busy = true;
      input.value = '';
      el.querySelector('[data-quick]').hidden = true;
      add('a-you', esc(question));
      orb.classList.add('thinking');
      status.textContent = 'Looking things up…';
      try {
        const { AI, session } = await getSession();
        const steps = add('a-steps', '');
        const marks = {};
        const progress = (step) => {
          const { tool, label, state: st } = step;
          cardProgress(step);
          let li = marks[tool];
          if (!li) { li = document.createElement('div'); marks[tool] = li; steps.appendChild(li); }
          li.className = 'step ' + st;
          li.innerHTML = `<span class="tick">${st === 'done' ? '✓' : st === 'fail' ? '✕' : ''}</span>${esc(label)}`;
          if (st === 'run') status.textContent = tool === 'think' ? 'Writing the answer…' : `Checking ${label.toLowerCase()}…`;
          toEnd();
        };
        const out = await session.ask(question, turns.slice(-6), progress);
        setTimeout(() => steps.classList.add('fold'), 700);
        turns.push({ role: 'user', text: question }, { role: 'agent', text: out.say });
        const sources = out.lookups.map((l) => `<span class="chip ${l.ok ? '' : 'bad'}" title="${esc(l.text.slice(0, 300))}">${esc(LOOKUP_LABEL[l.tool] || l.tool)}${l.ok ? '' : ' ✕'}</span>`).join('');
        const card = add('a-scout', `<div>${esc(out.say || 'Sorry, I did not get that.').replace(/\n/g, '<br>')}</div>${sources ? `<div class="a-src">Live from: ${sources}</div>` : ''}`);
        const igHit = out.lookups.filter((l) => l.tool === 'instagram' && l.ok && l.data && l.data.recent && l.data.recent.length).pop();
        if (igHit) {
          const wantAll = /posts|recent|latest few|last (3|three|few)/i.test(question);
          const fig = document.createElement('div');
          fig.className = 'ig-fig';
          fig.innerHTML = postTiles(wantAll ? igHit.data.recent : igHit.data.recent.slice(0, 1), !wantAll);
          fig.querySelectorAll('img').forEach((img) => img.addEventListener('load', toEnd));
          card.appendChild(fig);
        }
        (out.actions || []).filter((a) => AI.needsConfirm(a) || a.type === 'whatsapp_draft').forEach((a) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'a-act';
          b.textContent = a.type === 'whatsapp_draft' ? 'Open WhatsApp draft' : `Apply: ${AI.describeAction(a)}`;
          b.onclick = async () => {
            b.disabled = true;
            try {
              if (a.type === 'whatsapp_draft') {
                if (!phone) throw new Error('No phone number in the sheet.');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(a.text)}`, '_blank', 'noopener');
              } else {
                await runAction(a);
                paintLead();
              }
              b.textContent = '✓ Done';
            } catch (error) { b.disabled = false; b.textContent = 'Retry: ' + AI.describeAction(a); toast(error.message, true); }
          };
          card.appendChild(b);
          if (a.type === 'send_message') { b.textContent = 'Sending…'; b.onclick().then(() => { if (!b.disabled) b.textContent = 'Retry: ' + AI.describeAction(a); else b.textContent = '✓ Sent'; }); }
        });
        if (out.rejected && out.rejected.length) add('a-note', esc(out.rejected[0]));
        status.textContent = 'Ready.';
        toEnd();
        setTimeout(toEnd, 400);
      } catch (error) {
        add('a-note', esc(error.message || 'Something went wrong.'));
        status.textContent = 'That did not work. Try again.';
      }
      orb.classList.remove('thinking');
      busy = false;
      input.focus();
    };

    el.querySelector('[data-form]').onsubmit = (e) => { e.preventDefault(); ask(input.value); };
    el.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => ask(b.dataset.q)));
  };

  const openPitch = (tab, row, opener) => {
    const name = str(row, 'Business Name');
    const p = { stage: 'brief', content: null, error: '', pptx: null, savedKey: '', drive: '', brief: null, offers: [] };
    const BRIEF_KEY = 'saffron-scout-briefs';
    const SERVICES_LIST = ['Website', 'AI automation', 'WhatsApp bot', 'Ads & creatives', 'Reels', 'Custom software / app', 'Google Business profile'];
    const LANGS = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Hinglish'];
    const TONES = ['Friendly', 'Professional', 'Bold'];
    const briefKey = `${tab}:${name}`;
    const defaultBrief = () => {
      const facts = window.ScoutAI.gatherFacts(row);
      const intl = facts.market === 'international';
      return {
        services: SERVICES_LIST.filter((s) => (facts.bestFitService || '').toLowerCase().includes(s.split(' ')[0].toLowerCase())).slice(0, 2),
        offer: '', price: '', timeline: '', language: 'English', tone: 'Friendly', includeCompetitors: true,
        format: intl ? 'landscape' : 'portrait', channel: intl || (!facts.phone && facts.email) ? 'email' : 'whatsapp', notes: '',
      };
    };
    const loadBriefSaved = () => { try { return (JSON.parse(localStorage.getItem(BRIEF_KEY) || '{}'))[briefKey] || null; } catch (e) { return null; } };
    const saveBriefSaved = () => { try { const all = JSON.parse(localStorage.getItem(BRIEF_KEY) || '{}'); all[briefKey] = p.brief; localStorage.setItem(BRIEF_KEY, JSON.stringify(all)); } catch (e) { /* not remembered */ } };

    const shell = (body, foot) => `
      <div class="drawer-head"><div class="grow"><p class="eyebrow">Pitch deck · ${esc(TABS[tab].title)}</p>
        <h2 id="drawer-title">${esc(name)}</h2></div>
        <button class="btn btn-outline icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;

    const paint = () => {
      if ($('drawer').hidden || !$('drawer').querySelector('[data-pitch-drawer]')) return;
      const drawer = $('drawer');
      if (p.stage === 'brief' && !p.content) {
        const b = p.brief;
        if (!b) { drawer.innerHTML = shell('<div data-pitch-drawer><div class="list"><div class="toggle-row"><span>Loading…</span></div></div></div>'); return; }
        const chips = (name, items, sel) => items.map((v, i) => `<button type="button" class="chip${sel(v) ? ' on' : ''}" data-chip="${name}" data-i="${i}">${esc(v)}</button>`).join('');
        drawer.innerHTML = shell(`<div data-pitch-drawer class="brief">
          <p class="meta">Choose what goes in. Leave anything empty and Scout decides.</p>
          <div class="field"><label>Services to pitch</label><div class="chips">${chips('service', SERVICES_LIST, (v) => b.services.includes(v))}</div></div>
          <div class="field"><label>Offer</label><div class="chips"><button type="button" class="chip${!b.offer ? ' on' : ''}" data-chip="offer" data-i="-1">Scout picks</button>${chips('offer', p.offers.map((o) => o.split(':')[0]), (v) => { const o = p.offers.find((x) => x.split(':')[0] === v); return b.offer === o; })}</div>
            <input id="b-offer" placeholder="Or write your own offer" value="${esc(p.offers.includes(b.offer) ? '' : b.offer)}"></div>
          <div class="field"><label for="b-price">Price to show</label><input id="b-price" placeholder="e.g. ₹15,000 one time (empty = no price)" value="${esc(b.price)}"></div>
          <div class="field"><label for="b-time">Timeline</label><input id="b-time" placeholder="e.g. 7 days" value="${esc(b.timeline)}"></div>
          <div class="field"><label>Language</label><div class="chips">${chips('lang', LANGS, (v) => b.language === v)}</div></div>
          <div class="field"><label>Tone</label><div class="chips">${chips('tone', TONES, (v) => b.tone === v)}</div></div>
          <div class="field"><label>Format</label><div class="chips">${chips('format', ['Portrait (WhatsApp)', 'Landscape (slides)'], (v) => (b.format === 'portrait') === v.startsWith('Portrait'))}</div></div>
          <div class="field"><label>Send by</label><div class="chips">${chips('channel', ['WhatsApp', 'Email'], (v) => b.channel === v.toLowerCase())}</div></div>
          <label class="check"><input type="checkbox" id="b-comp" ${b.includeCompetitors ? 'checked' : ''}> Compare with nearby competitors</label>
          <div class="field"><label for="b-notes">Notes for Scout</label><textarea id="b-notes" placeholder="Anything to stress or avoid">${esc(b.notes)}</textarea></div>
          <button class="btn btn-primary" type="button" data-generate>Generate deck</button>
        </div>`);
        const readInputs = () => {
          b.price = $('b-price').value.trim(); b.timeline = $('b-time').value.trim(); b.notes = $('b-notes').value.trim(); b.includeCompetitors = $('b-comp').checked;
          const own = $('b-offer').value.trim(); if (own) b.offer = own;
        };
        drawer.querySelectorAll('[data-chip]').forEach((el) => (el.onclick = () => {
          readInputs();
          const i = Number(el.dataset.i);
          switch (el.dataset.chip) {
            case 'service': { const v = SERVICES_LIST[i]; b.services = b.services.includes(v) ? b.services.filter((s) => s !== v) : [...b.services, v]; break; }
            case 'offer': b.offer = i < 0 ? '' : p.offers[i]; break;
            case 'lang': b.language = LANGS[i]; break;
            case 'tone': b.tone = TONES[i]; break;
            case 'format': b.format = i === 0 ? 'portrait' : 'landscape'; break;
            case 'channel': b.channel = i === 0 ? 'whatsapp' : 'email'; break;
          }
          if (el.dataset.chip === 'offer') $('b-offer').value = '';
          paint();
        }));
        drawer.querySelector('[data-generate]').onclick = () => { readInputs(); generate(); };
        drawer.querySelector('[data-close]').onclick = () => closeDrawer();
        return;
      }
      if (!p.content) {
        const at = PITCH_STAGES.findIndex(([id]) => id === p.stage);
        drawer.innerHTML = shell(`<div data-pitch-drawer>${p.error
          ? emptyState("Couldn't make the deck.", ' ' + p.error, '<br><button class="btn btn-outline" type="button" data-regen>Try again</button>')
          : `<div class="list">${PITCH_STAGES.map(([id, label], i) =>
              `<div class="toggle-row"><span>${esc(label)}</span><span class="pill ${i < at ? 's-won' : i === at ? 'due-today' : ''}">${i < at ? 'Done' : i === at ? 'Working…' : 'Waiting'}</span></div>`).join('')}</div>
             <p class="meta">Usually 15–30 seconds.</p>`}</div>`);
      } else {
        const c = p.content;
        const phone = phoneDigits(str(row, TABS[tab].phone));
        const email = (str(row, TABS[tab].email || 'Email').match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0];
        drawer.innerHTML = shell(`<div data-pitch-drawer style="display:flex;flex-direction:column;gap:16px">
          <div class="quick">
            <button class="btn btn-primary" type="button" data-pdf>Save as PDF</button>
            <button class="btn btn-outline" type="button" data-pptx>Download PowerPoint</button>
            ${phone ? '<button class="btn btn-outline" type="button" data-wa>Send on WhatsApp</button>' : ''}
            ${email ? '<button class="btn btn-outline" type="button" data-mail>Email it</button>' : ''}
          </div>
          <div class="field"><label for="pitch-intro">${c.channel === 'email' ? 'Email message' : 'WhatsApp message'}</label>
            <textarea id="pitch-intro" style="min-height:120px">${esc(c.introMessage)}</textarea>
            <span class="meta">Attach the PDF or PowerPoint yourself after it opens. WhatsApp and email links can't carry files.</span></div>
          <div class="pitch-frame"><iframe title="Pitch deck preview" sandbox="allow-same-origin" data-frame></iframe></div>
        </div>`, `<span class="status-text" data-drive>${esc(p.drive)}</span><button class="btn btn-outline" type="button" data-regen>Change &amp; redo</button>`);
        const frame = drawer.querySelector('[data-frame]');
        const page = window.ScoutAI.PAGE[c.format];
        const pagePx = page.width * (96 / 72);
        frame.style.width = pagePx + 'px';
        frame.srcdoc = window.ScoutAI.renderPitchHtml(c);
        frame.onload = () => {
          const box = frame.parentElement;
          const scale = Math.min(1, box.clientWidth / pagePx);
          const h = frame.contentDocument ? frame.contentDocument.documentElement.scrollHeight : 1200;
          frame.style.height = h + 'px';
          frame.style.transform = `scale(${scale})`;
          box.style.height = Math.ceil(h * scale) + 'px';
        };
        const intro = drawer.querySelector('#pitch-intro');
        drawer.querySelector('[data-pdf]').onclick = () => {
          const win = window.open('', '_blank');
          if (!win) { toast('Allow pop-ups for this site to save the PDF.', true); return; }
          win.document.open();
          win.document.write(window.ScoutAI.renderPitchHtml(c).replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body>'));
          win.document.close();
          saveCopy();
        };
        drawer.querySelector('[data-pptx]').onclick = async (e) => {
          e.target.disabled = true;
          try {
            const b64 = await makePptx();
            const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${c.businessName.replace(/[^\w\s-]/g, '').trim() || 'pitch'} - Saffron Labs.pptx`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            saveCopy();
          } catch (error) {
            handleError(error);
          } finally {
            e.target.disabled = false;
          }
        };
        const wa = drawer.querySelector('[data-wa]');
        if (wa) wa.onclick = () => { window.open(`https://wa.me/${phone}?text=${encodeURIComponent(intro.value)}`, '_blank', 'noopener'); saveCopy(); };
        const mail = drawer.querySelector('[data-mail]');
        if (mail) mail.onclick = () => { location.href = `mailto:${email}?subject=${encodeURIComponent(c.emailSubject)}&body=${encodeURIComponent(intro.value)}`; saveCopy(); };
      }
      drawer.querySelector('[data-close]').onclick = () => closeDrawer();
      const regen = drawer.querySelector('[data-regen]');
      if (regen) regen.onclick = () => { p.content = null; p.error = ''; p.stage = 'brief'; paint(); };
    };

    const makePptx = async () => {
      const key = JSON.stringify(p.content);
      if (p.pptx && p.pptx.key === key) return p.pptx.base64;
      const base64 = await window.ScoutAI.buildPitchPptx(p.content);
      p.pptx = { key, base64 };
      return base64;
    };

    // Like the app: every deck that gets shared also goes to Drive, linked in the lead's Remarks.
    const saveCopy = async () => {
      const key = JSON.stringify(p.content);
      if (p.savedKey === key) return;
      p.savedKey = key;
      const set = (msg) => { p.drive = msg; const el = $('drawer').querySelector('[data-drive]'); if (el) el.textContent = msg; };
      set('Saving a copy to Drive…');
      try {
        const fileBase64 = await makePptx();
        await api('savePitch', { tab, row: row.row, businessName: name, format: 'pptx', fileBase64 });
        set('Copy saved to Drive and linked in the lead');
        delete state.tabs[tab];
      } catch (error) {
        p.savedKey = '';
        set("Couldn't save the Drive copy");
        if (error instanceof SessionExpired) handleError(error);
      }
    };

    const generate = async () => {
      p.content = null; p.error = ''; p.stage = 'gathering'; p.pptx = null;
      saveBriefSaved();
      paint();
      try {
        const [AI, settings] = await Promise.all([loadAi(), aiSettings()]);
        const facts = AI.gatherFacts(row);
        p.stage = 'competitors'; paint();
        const enriched = p.brief.includeCompetitors ? await AI.withCompetitors(settings, facts) : { ...facts, competitors: [] };
        p.stage = 'writing'; paint();
        p.content = await AI.writePitch(settings, enriched, p.offers, p.brief);
      } catch (error) {
        if (error instanceof SessionExpired) { handleError(error); return; }
        p.error = error.message;
      }
      paint();
    };

    openDrawer(shell('<div data-pitch-drawer></div>'), opener);
    $('drawer').classList.add('drawer-wide');
    (async () => {
      try { await loadAi(); } catch (e) { /* surfaced when generating */ }
      try {
        const social = await loadSocial();
        p.offers = (social.offers || []).filter((o) => isTrue(o.values.Active)).map((o) => String(o.values.Offer || '').trim()).filter(Boolean);
      } catch (e) { /* default offers are used */ }
      try { p.brief = loadBriefSaved() || defaultBrief(); } catch (e) { p.brief = { services: [], offer: '', price: '', timeline: '', language: 'English', tone: 'Friendly', includeCompetitors: true, format: 'portrait', channel: 'whatsapp', notes: '' }; }
      paint();
    })();
  };

  // ---------- Team chats ----------
  // Same chats as the app: list on the left, conversation on the right, "/" commands and Scout.
  // Kept in this browser between visits; only changes since the last sync are downloaded.

  const CHAT_KEY = () => `saffron-scout-chats-${(state.session && state.session.name || '').toLowerCase()}`;
  const TEAM_CHAT = 'team';
  const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dmId = (a, b) => 'dm:' + [normName(a), normName(b)].sort().join('|');
  let chatTimer = null;
  let chatBusy = false;

  const loadChatCache = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CHAT_KEY()) || 'null');
      if (c && Array.isArray(c.messages)) return { me: state.session.name, cursor: 0, epoch: '0', ...c, members: Array.isArray(c.members) ? c.members : [], chats: Array.isArray(c.chats) ? c.chats : [] };
    } catch (e) { /* fall back to a fresh sync */ }
    return { me: state.session.name, members: [], chats: [], messages: [], cursor: 0, epoch: '0' };
  };
  const saveChatCache = () => {
    try {
      const c = state.chat;
      localStorage.setItem(CHAT_KEY(), JSON.stringify({ ...c, messages: c.messages.slice(-1500) }));
    } catch (e) { /* storage full or blocked: the sheet still has everything */ }
  };
  const mergeMsgs = (current, incoming) => {
    const byId = new Map(current.map((m) => [m.id, m]));
    incoming.forEach((m) => {
      const old = byId.get(m.id);
      if (!old || old.local || m.updated >= old.updated) byId.set(m.id, m);
    });
    return [...byId.values()].sort((a, b) => a.sent - b.sent);
  };
  const isUnread = (m, me) =>
    !m.local && normName(m.from) !== normName(me) && !(m.from === 'Scout' && m.meta && normName(m.meta.for) === normName(me)) &&
    !(m.readBy || []).some((n) => normName(n) === normName(me));

  const chatSummaries = () => {
    const c = state.chat;
    const me = c.me;
    const dms = c.members.filter((m) => normName(m) !== normName(me)).map((m) => ({ id: dmId(me, m), name: m, members: [me, m], kind: 'dm' }));
    const all = [...(c.chats.length ? c.chats : [{ id: TEAM_CHAT, name: 'Saffron Team', members: [], kind: 'team' }]), ...dms];
    return all.map((ch) => {
      const list = c.messages.filter((m) => m.chat === ch.id);
      return { ...ch, last: list[list.length - 1] || null, unread: list.filter((m) => isUnread(m, me)).length };
    }).sort((a, b) => ((b.last && b.last.sent) || (b.kind === 'team' ? 1 : 0)) - ((a.last && a.last.sent) || (a.kind === 'team' ? 1 : 0)));
  };
  const totalUnread = () => (state.chat ? chatSummaries().reduce((s, c) => s + c.unread, 0) : 0);

  const syncChats = async () => {
    if (chatBusy || !state.session) return;
    chatBusy = true;
    try {
      state.chat = state.chat || loadChatCache();
      const before = totalUnread();
      const data = await api('teamSync', { since: Math.max(0, state.chat.cursor - 2000), epoch: state.chat.epoch || '0', appVersion: 'web' });
      state.chat = { ...state.chat, me: data.me || state.chat.me, members: data.members || [], chats: data.chats || [], cursor: data.cursor, epoch: data.epoch || '0', messages: (data.epoch || '0') !== (state.chat.epoch || '0') ? (data.messages || []) : mergeMsgs(state.chat.messages, data.messages || []) };
      saveChatCache();
      const after = totalUnread();
      document.title = after ? `(${after}) Saffron Scout` : 'Saffron Scout';
      renderTabs();
      if (after > before && state.section !== 'inbox') toast(`New message${after - before > 1 ? 's' : ''} in Chats`);
      if (state.section === 'inbox') renderChats(true);
    } catch (error) {
      if (error instanceof SessionExpired) handleError(error);
      else state.chatError = error.message;
    } finally {
      chatBusy = false;
    }
  };
  const startTeamPolling = () => {
    clearInterval(chatTimer);
    state.chat = loadChatCache();
    syncChats();
    chatTimer = setInterval(() => { if (!document.hidden) syncChats(); }, state.openChat ? 8000 : 45000);
  };
  const restartPolling = () => {
    clearInterval(chatTimer);
    chatTimer = setInterval(() => { if (!document.hidden) syncChats(); }, state.section === 'inbox' && state.openChat ? 8000 : 45000);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.session) syncChats(); });

  const timeShort = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const dayName = (ms) => {
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const avatar = (kind, name) => kind === 'team' || kind === 'group'
    ? `<span class="av av-group" aria-hidden="true">${kind === 'team' ? '◆' : '#'}</span>`
    : kind === 'scout' ? '<span class="av av-scout" aria-hidden="true">✦</span>'
    : `<span class="av" style="background:${avColor(name)}" aria-hidden="true">${esc((name || '?').slice(0, 1).toUpperCase())}</span>`;
  const avColor = (name) => {
    const p = ['#5E1220', '#2B5C9E', '#2F7D4A', '#B7791F', '#7A3E9D', '#A94425'];
    let h = 0;
    for (const ch of String(name).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return p[Math.abs(h) % p.length];
  };
  const ticks = (m, members) => {
    if (m.local === 'sending') return '<span class="tick" title="Sending">🕓</span>';
    if (m.local === 'failed') return '<span class="tick fail" title="Not sent">!</span>';
    const me = state.chat.me;
    const others = members.filter((x) => normName(x) !== normName(me));
    const readers = (m.readBy || []).filter((x) => normName(x) !== normName(me));
    const all = others.length && others.every((o) => readers.some((r) => normName(r) === normName(o)));
    return `<span class="tick${all ? ' read' : ''}" title="${all ? 'Read' : readers.length ? 'Read by some' : 'Sent'}">${readers.length ? '✓✓' : '✓'}</span>`;
  };

  const renderChats = async (soft) => {
    const view = $('view');
    if (!state.chat) state.chat = loadChatCache();
    if (!state.chat.cursor && !soft) {
      view.innerHTML = `<div class="view-head"><div><p class="eyebrow">Team</p><h2>Chats</h2></div></div>${skeletons(3)}`;
      await syncChats();
      if (!state.chat.cursor && state.section === 'inbox') {
        view.innerHTML = `<div class="view-head"><div><p class="eyebrow">Team</p><h2>Chats</h2></div></div>` + emptyState("Couldn't load chats.", ' ' + (state.chatError || ''), '<br><button class="btn btn-outline" type="button" data-retry>Try again</button>');
        view.querySelector('[data-retry]').onclick = () => renderChats();
      }
      return;
    }
    if (state.section !== 'inbox') return;
    const focused = document.activeElement && document.activeElement.id === 'chat-input';
    const draft = $('chat-input') ? $('chat-input').value : state.chatDraft || '';
    const scrolledUp = (() => { const l = view.querySelector('.thread'); return l && l.scrollHeight - l.scrollTop - l.clientHeight > 80; })();
    let summaries;
    try { summaries = chatSummaries(); } catch (e) {
      localStorage.removeItem(CHAT_KEY()); state.chat = null;
      view.innerHTML = emptyState("Chats got out of sync.", ' Reloading them…', '');
      setTimeout(() => renderChats(), 50);
      return;
    }
    const open = state.openChat && summaries.find((c) => c.id === state.openChat);
    view.innerHTML = `<div class="chat-app${open ? ' has-open' : ''}">
      <aside class="chat-list" aria-label="Chats">
        <div class="chat-list-head"><h2>Chats</h2><span><button class="btn btn-sm" type="button" data-clear-chats>Clear all</button> <button class="btn btn-accent btn-sm" type="button" data-new-group>New group</button></span></div>
        ${summaries.map((c) => {
          const last = c.last;
          const who = !last ? '' : last.meta && last.meta.kind === 'system' ? '' : normName(last.from) === normName(state.chat.me) ? 'You: ' : last.from === 'Scout' ? 'Scout: ' : c.kind === 'dm' ? '' : last.from + ': ';
          return `<button class="chat-row${c.id === state.openChat ? ' on' : ''}" type="button" data-chat="${esc(c.id)}">
            ${avatar(c.kind, c.name)}
            <span class="chat-row-text"><span class="chat-row-top"><b>${esc(c.name)}</b><span class="meta${c.unread ? ' hot' : ''}">${esc(last ? timeShort(last.sent) : '')}</span></span>
            <span class="chat-row-top"><span class="chat-prev">${esc(last ? who + last.message.replace(/\s+/g, ' ') : c.kind === 'dm' ? 'Say hi 👋' : 'No messages yet')}</span>${c.unread ? `<span class="unread">${c.unread}</span>` : ''}</span></span>
          </button>`;
        }).join('')}
      </aside>
      <section class="chat-pane" aria-label="Conversation">${open ? conversationHtml(open, draft) : '<div class="chat-empty"><span class="av av-scout big">✦</span><p>Pick a chat. In any chat, type <b>/</b> for Scout commands or start with <b>@scout</b> to ask a question.</p></div>'}</section>
    </div>`;
    view.querySelectorAll('[data-chat]').forEach((b) => (b.onclick = () => { state.openChat = b.dataset.chat; state.chatDraft = ''; restartPolling(); renderChats(true); }));
    view.querySelector('[data-new-group]').onclick = openNewGroup;
    view.querySelector('[data-clear-chats]').onclick = async () => {
      if (!confirm('Clear ALL team chats and groups for everyone? This cannot be undone.')) return;
      try { await clearAllChats(); toast('All chats cleared'); } catch (error) { toast(error.message); }
    };
    if (open) wireConversation(open, focused, scrolledUp);
  };

  const conversationHtml = (open, draft) => {
    const msgs = state.chat.messages.filter((m) => m.chat === open.id);
    let lastDay = '';
    const rows = msgs.map((m) => {
      const day = new Date(m.sent).toDateString();
      const sep = day !== lastDay ? `<div class="day"><span>${esc(dayName(m.sent))}</span></div>` : '';
      lastDay = day;
      return sep + bubbleHtml(m, open);
    }).join('');
    const lead = state.shareLead;
    return `<header class="chat-head"><button class="btn btn-outline btn-sm chat-back" type="button" data-back aria-label="Back to chats">←</button>${avatar(open.kind, open.name)}<div><b>${esc(open.name)}</b><span class="meta">${esc(open.kind === 'dm' ? 'Direct message' : open.members.join(', '))}</span></div></header>
      ${(() => { const p = [...msgs].reverse().find((x) => x.meta && x.meta.pinned && !x.meta.deleted); return p ? `<div class="pin-banner">📌 <b>${esc(p.from)}</b>: ${esc(p.message.slice(0, 120))}</div>` : ''; })()}
      <div class="thread" role="log" aria-live="polite">${rows || '<div class="chat-empty"><p>No messages yet. Say hi, or type / for Scout.</p></div>'}${state.scoutThinking === open.id ? '<div class="bubble scout thinking">Scout is thinking…</div>' : ''}</div>
      <form class="composer" data-composer>
        <div class="cmd-menu" data-cmds hidden></div>
        ${state.replyTo ? `<div class="reply-bar"><div><b>Replying to ${esc(state.replyTo.from)}</b><span>${esc(state.replyTo.message.slice(0, 100))}</span></div><button type="button" class="chip-x" data-cancel-reply aria-label="Cancel reply">✕</button></div>` : ''}
        ${lead ? `<div class="lead-chip">Sharing <b>${esc(lead.business)}</b> <button type="button" class="chip-x" data-unlink aria-label="Don't share the lead">✕</button></div>` : ''}
        <div class="composer-row"><button class="slash" type="button" data-slash aria-label="Commands">/</button>
        <textarea id="chat-input" rows="1" placeholder="Message · / for Scout" aria-label="Message">${esc(draft)}</textarea>
        <button class="btn btn-primary send" type="submit" aria-label="Send">➤</button></div>
      </form>`;
  };

  // Scout writes **bold**, *italic*, `code` and "- " bullets; show formatting, not symbols.
  const rich = (raw) => esc(raw)
    .replace(/^[ \t]*[-*•][ \t]+/gm, '• ')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<b>${a || b}</b>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*(?!\s)([^*\n]+?)\*/g, '<i>$1</i>');

  const bubbleHtml = (m, open) => {
    if (m.meta && m.meta.kind === 'system') return `<div class="day"><span class="sys">${esc(m.message)}</span></div>`;
    const me = state.chat.me;
    const scout = m.from === 'Scout';
    const mine = !scout && normName(m.from) === normName(me);
    const meta = m.meta || {};
    const actions = meta.actions || [];
    const forMe = normName(meta.for) === normName(me);
    let actionHtml = '';
    if (scout && actions.length) {
      actionHtml = meta.state === 'waiting'
        ? forMe ? `<button class="btn btn-primary btn-sm" type="button" data-review="${esc(m.id)}">Review ${actions.length === 1 ? 'change' : actions.length + ' changes'}</button>` : `<span class="meta">Waiting for ${esc(meta.for)} to approve</span>`
        : `<span class="state ${meta.state === 'done' ? 'ok' : meta.state === 'failed' ? 'bad' : ''}">${meta.state === 'done' ? '✓ ' : meta.state === 'failed' ? '⚠ ' : ''}${esc(meta.result || (meta.state === 'cancelled' ? 'Cancelled' : ''))}</span>`;
    }
    const deleted = meta.deleted === true;
    const reactions = Object.entries(meta.reactions || {}).filter(([, n]) => n.length);
    const quote = meta.replyTo && !deleted ? `<div class="quote"><b>${esc(meta.replyTo.from)}</b><span>${esc(meta.replyTo.text)}</span></div>` : '';
    const reactHtml = reactions.length ? `<div class="reactions">${reactions.map(([e, n]) => `<span title="${esc(n.join(', '))}">${esc(e)}${n.length > 1 ? ' ' + n.length : ''}</span>`).join('')}</div>` : '';
    return `<div class="bubble-row ${mine ? 'mine' : 'theirs'}"><div class="bubble ${mine ? 'mine' : scout ? 'scout' : 'theirs'}">
      ${m.local || deleted ? '' : `<button class="more" type="button" data-more="${esc(m.id)}" aria-label="Message options">⋯</button>`}
      ${meta.pinned ? '<span class="meta">📌 Pinned</span>' : ''}
      ${quote}
      ${scout ? `<span class="who scout-who">✦ Scout${meta.for ? ' · for ' + esc(meta.for) : ''}</span>` : !mine && open.kind !== 'dm' ? `<span class="who" style="color:${avColor(m.from)}">${esc(m.from)}</span>` : ''}
      ${deleted ? '<p class="deleted">This message was deleted</p>' : `<p>${rich(m.message)}</p>`}
      ${m.leadTab && m.leadRow > 1 ? `<button class="lead-card" type="button" data-lead="${esc(m.leadTab)}|${m.leadRow}|${esc(m.business)}"><b>${esc(m.business)}</b><span>${esc((TABS[m.leadTab] || {}).title || m.leadTab)} · open</span></button>` : ''}
      ${actionHtml ? `<div class="actions-box">${actionHtml}</div>` : ''}
      <span class="stamp">${esc(new Date(m.sent).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))} ${mine ? ticks(m, open.members) : ''}</span>
    </div>${reactHtml}${m.local === 'failed' ? `<button class="retry" type="button" data-retry-msg="${esc(m.id)}">Not sent · retry</button>` : ''}</div>`;
  };

  const wireConversation = (open, focused, scrolledUp) => {
    const view = $('view');
    const thread = view.querySelector('.thread');
    if (!scrolledUp) thread.scrollTop = thread.scrollHeight;
    const input = $('chat-input');
    const menu = view.querySelector('[data-cmds]');
    const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; };
    grow();
    const showMenu = () => {
      const list = window.ScoutAI ? window.ScoutAI.matchingCommands(input.value) : [];
      menu.hidden = !list.length;
      menu.innerHTML = list.map((c) => `<button type="button" data-cmd="${esc(c.hint)}"><b>/${esc(c.name)}</b>${c.args ? ` <i>${esc(c.args)}</i>` : ''}<span>${esc(c.description)}</span></button>`).join('');
      menu.querySelectorAll('[data-cmd]').forEach((b) => (b.onclick = () => { input.value = b.dataset.cmd; state.chatDraft = input.value; showMenu(); input.focus(); }));
    };
    // Typing "@" lists Scout and this chat's people; picking one fills in the name.
    const showMentions = () => {
      const m = /(?:^|\s)@([A-Za-z]*)$/.exec(input.value);
      if (!m) return false;
      const names = ['Scout', ...(open.members && open.members.length ? open.members : state.chat.members)]
        .filter((n, i, all) => normName(n) !== normName(state.chat.me) && all.findIndex((x) => normName(x) === normName(n)) === i)
        .filter((n) => n.toLowerCase().startsWith(m[1].toLowerCase()));
      menu.hidden = !names.length;
      menu.innerHTML = names.map((n) => `<button type="button" data-mention="${esc(n)}"><b>@${esc(n)}</b><span>${n === 'Scout' ? 'Ask Scout, or give it a task' : 'Mention teammate'}</span></button>`).join('');
      menu.querySelectorAll('[data-mention]').forEach((b) => (b.onclick = () => { input.value = input.value.replace(/@[A-Za-z]*$/, '@' + b.dataset.mention + ' '); state.chatDraft = input.value; menu.hidden = true; input.focus(); }));
      return true;
    };
    input.oninput = () => { state.chatDraft = input.value; grow(); if (showMentions()) return; if (input.value.startsWith('/')) loadAi().then(showMenu).catch(() => {}); else menu.hidden = true; };
    input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); view.querySelector('[data-composer]').requestSubmit(); } };
    if (focused || state.openFresh) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    state.openFresh = false;
    if (input.value.startsWith('/')) loadAi().then(showMenu).catch(() => {});
    view.querySelector('[data-slash]').onclick = () => { input.value = input.value.startsWith('/') ? '' : '/'; state.chatDraft = input.value; input.focus(); loadAi().then(showMenu).catch(() => {}); };
    const cancelReply = view.querySelector('[data-cancel-reply]');
    if (cancelReply) cancelReply.onclick = () => { state.replyTo = null; renderChats(true); };
    view.querySelectorAll('[data-more]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openMessageMenu(b.dataset.more, b); }));
    view.querySelector('[data-back]').onclick = () => { state.openChat = null; restartPolling(); renderChats(true); };
    const unlink = view.querySelector('[data-unlink]');
    if (unlink) unlink.onclick = () => { state.shareLead = null; renderChats(true); };
    view.querySelector('[data-composer]').onsubmit = (e) => { e.preventDefault(); submitChat(open, input.value); };
    view.querySelectorAll('[data-review]').forEach((b) => (b.onclick = () => openApproval(b.dataset.review)));
    view.querySelectorAll('[data-retry-msg]').forEach((b) => (b.onclick = () => retryMsg(b.dataset.retryMsg)));
    view.querySelectorAll('[data-lead]').forEach((b) => (b.onclick = async () => {
      const [tab, row, business] = b.dataset.lead.split('|');
      try { await ensureTab(tab); } catch (error) { handleError(error); return; }
      const found = findRow(tab, Number(row), business);
      if (found) openRow(tab, found, b); else toast(`${business} isn't in ${TABS[tab].title} any more.`, true);
    }));
    // Opening the chat reads it.
    const unread = state.chat.messages.filter((m) => m.chat === open.id && isUnread(m, state.chat.me));
    if (unread.length) {
      unread.forEach((m) => (m.readBy = [...(m.readBy || []), state.chat.me]));
      saveChatCache();
      renderTabs();
      api('teamRead', { chat: open.id }).catch(() => {});
    }
  };

  const localId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const deliver = async (local, extra) => {
    try {
      const data = await api('teamSend', { chat: local.chat, message: local.message, clientId: local.id, leadTab: local.leadTab, leadRow: local.leadRow || '', business: local.business, ...extra });
      state.chat.messages = mergeMsgs(state.chat.messages.filter((m) => m.id !== local.id), [data.message]);
      saveChatCache();
      if (state.section === 'inbox') renderChats(true);
      return data.message;
    } catch (error) {
      local.local = 'failed';
      if (state.section === 'inbox') renderChats(true);
      handleError(error);
      throw error;
    }
  };
  const postMessage = (chat, text, opts) => {
    const o = opts || {};
    const local = {
      id: localId(), chat, sent: Date.now(), from: o.asScout ? 'Scout' : state.chat.me, message: text,
      leadTab: o.lead ? o.lead.tab : '', leadRow: o.lead ? o.lead.row : 0, business: o.lead ? o.lead.business : '',
      readBy: [state.chat.me], meta: o.asScout ? { ...(o.meta || {}), kind: 'scout', for: state.chat.me } : o.meta || null, updated: Date.now(), local: 'sending',
    };
    state.chat.messages.push(local);
    if (state.section === 'inbox') renderChats(true);
    return deliver(local, { meta: o.meta || null, asScout: !!o.asScout });
  };
  const retryMsg = (id) => {
    const m = state.chat.messages.find((x) => x.id === id);
    if (!m) return;
    m.local = 'sending';
    renderChats(true);
    deliver(m, { meta: m.meta, asScout: m.from === 'Scout' }).catch(() => {});
  };

  const chatAct = async (id, op, emoji) => {
    try {
      const data = await api('teamAct', { id, op, emoji: emoji || '' });
      const i = state.chat.messages.findIndex((m) => m.id === id);
      if (i >= 0 && data.message) state.chat.messages[i] = data.message;
      saveChatCache();
      renderChats(true);
    } catch (error) { toast(error.message, true); }
  };

  const openMessageMenu = (id, anchor) => {
    document.querySelectorAll('.msg-menu').forEach((n) => n.remove());
    const m = state.chat.messages.find((x) => x.id === id);
    if (!m) return;
    const mine = normName(m.from) === normName(state.chat.me);
    const pinned = m.meta && m.meta.pinned;
    const menu = document.createElement('div');
    menu.className = 'msg-menu';
    menu.innerHTML = `<div class="emoji-row">${['👍', '❤️', '😂', '🙏', '🔥', '🎉'].map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
      <button type="button" data-do="reply">↩ Reply</button><button type="button" data-do="copy">⧉ Copy</button>
      <button type="button" data-do="pin">${pinned ? '📌 Unpin' : '📌 Pin'}</button>${mine ? '<button type="button" data-do="delete" class="danger">🗑 Delete for everyone</button>' : ''}`;
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 4) + 'px';
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth)) + 'px';
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
    menu.querySelectorAll('[data-emoji]').forEach((b) => (b.onclick = () => { close(); chatAct(id, 'react', b.dataset.emoji); }));
    menu.querySelectorAll('[data-do]').forEach((b) => (b.onclick = async () => {
      close();
      const what = b.dataset.do;
      if (what === 'reply') { state.replyTo = m; renderChats(true); const i = $('chat-input'); if (i) i.focus(); }
      else if (what === 'copy') { try { await navigator.clipboard.writeText(m.message); toast('Copied'); } catch (e) { toast("Couldn't copy", true); } }
      else if (what === 'pin') chatAct(id, pinned ? 'unpin' : 'pin');
      else if (what === 'delete' && confirm('Delete this message for everyone?')) chatAct(id, 'delete');
    }));
  };

  const submitChat = async (open, raw) => {
    const text = raw.trim();
    if (!text || state.scoutThinking) return;
    state.chatDraft = '';
    $('chat-input').value = '';
    const lead = state.shareLead;
    state.shareLead = null;
    const AI = await loadAi().catch(() => null);
    const parsed = AI ? AI.parseInput(text) : { kind: 'text' };
    const quoted = state.replyTo;
    state.replyTo = null;
    postMessage(open.id, text, { lead, meta: quoted ? { kind: 'chat', replyTo: { id: quoted.id, from: quoted.from, text: quoted.message.slice(0, 160) } } : null }).catch(() => {});
    if (parsed.kind === 'text') return;
    state.scoutThinking = open.id;
    renderChats(true);
    try {
      await Promise.all(Object.keys(TABS).map((t) => ensureTab(t).catch(() => null)));
      await loadSocial().catch(() => null);
      const tabs = {};
      Object.keys(TABS).forEach((t) => (tabs[t] = (state.tabs[t] && state.tabs[t].rows) || []));
      const reply = (msg, actions, leadRef, question) => postMessage(open.id, msg, {
        asScout: true, lead: leadRef || null,
        meta: { kind: 'scout', actions: (actions || []).filter(AI.needsConfirm), state: (actions || []).some(AI.needsConfirm) ? 'waiting' : '', question },
      });
      let saved;
      if (parsed.kind === 'command' && parsed.name !== 'brief') {
        const local = AI.runLocalCommand(parsed.name, parsed.args, tabs, state.social);
        if (!local) saved = await reply(`I don't know /${parsed.name}. Type /help to see what I can do.`, [], null, text);
        else if (local.idea) saved = await reply(`Add this Instagram post idea?\n“${local.idea}”`, [{ type: 'add_idea', text: local.idea }], null, text);
        else if (local.text) saved = await reply(local.text, [], local.lead, text);
        else parsed.question = local.ask;
      }
      if (!saved) {
        const question = parsed.kind === 'ask' ? parsed.question : parsed.question || AI.runLocalCommand('brief', '', tabs, null).ask;
        const recent = state.chat.messages.filter((m) => m.chat === open.id && !(m.meta && m.meta.kind === 'system')).slice(-15).map((m) => `${m.from}: ${m.message.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n');
        const history = state.chat.messages.filter((m) => m.chat === open.id && m.from === 'Scout' && m.meta && normName(m.meta.for) === normName(state.chat.me)).slice(-4)
          .flatMap((m) => [...(m.meta.question ? [{ role: 'user', text: m.meta.question }] : []), { role: 'agent', text: m.message }]);
        try {
          const settings = await aiSettings();
          const answer = await AI.askAgentLive(settings, { me: state.chat.me, members: state.chat.members.filter((x) => normName(x) !== normName(state.chat.me)), tabs, social: state.social }, history, question, 'chat', recent, (label) => { const b = document.querySelector('.bubble.scout.thinking'); if (b) b.textContent = label === 'Writing the answer' ? 'Scout is writing the answer…' : `Scout is checking ${label.toLowerCase()}…`; });
          let msg = answer.say || 'Sorry, I did not get that.';
          if (answer.rejected.length && !answer.actions.length) msg = `Sorry: ${answer.rejected[0]}`;
          else if (answer.rejected.length) msg += `\n(I couldn't do one part: ${answer.rejected[0]})`;
          saved = await reply(msg, answer.actions, null, question);
          const wa = answer.actions.find((a) => a.type === 'whatsapp_draft');
          if (wa && !answer.actions.some(AI.needsConfirm)) {
            const waRow = findRow(wa.tab, wa.row, wa.business);
            const digits = waRow ? phoneDigits(str(waRow, TABS[wa.tab].phone)) : '';
            if (digits) setTimeout(() => window.open(`https://wa.me/${digits}?text=${encodeURIComponent(wa.text)}`, '_blank', 'noopener'), 500);
            else toast(`${wa.business} has no phone number in the sheet.`, true);
          }
          const nav = answer.actions.find((a) => a.type === 'open_lead' || a.type === 'create_pitch');
          if (nav && !answer.actions.some(AI.needsConfirm)) {
            const row = findRow(nav.tab, nav.row, nav.business);
            if (row) setTimeout(() => (nav.type === 'create_pitch' ? openPitch(nav.tab, row, null) : openRow(nav.tab, row, null)), 500);
          }
        } catch (error) {
          if (error instanceof SessionExpired) throw error;
          saved = await reply(/429/.test(error.message) ? 'The free Gemini limit is used up for now. Try again in a bit.' : `I couldn't answer that: ${error.message}`, [], null, question);
        }
      }
      state.scoutThinking = null;
      if (saved && saved.meta && saved.meta.state === 'waiting') openApproval(saved.id);
    } catch (error) {
      handleError(error);
    } finally {
      state.scoutThinking = null;
      if (state.section === 'inbox') renderChats(true);
    }
  };

  // ---------- approval box ----------

  const openApproval = (id) => {
    const m = state.chat.messages.find((x) => x.id === id);
    if (!m || !m.meta || m.meta.state !== 'waiting' || !window.ScoutAI) return;
    const AI = window.ScoutAI;
    const box = document.createElement('div');
    box.className = 'approval';
    box.innerHTML = `<div class="approval-card" role="dialog" aria-modal="true" aria-labelledby="ap-title">
      <div class="approval-head"><span class="av av-scout">✦</span><div><h3 id="ap-title">Approve ${m.meta.actions.length === 1 ? 'this change' : m.meta.actions.length + ' changes'}?</h3><p class="meta">Scout saves to the sheet only after you approve.</p></div></div>
      <ul>${m.meta.actions.map((a) => `<li>${esc(AI.describeAction(a))}</li>`).join('')}</ul>
      <p class="form-error" data-err style="color:var(--danger)"></p>
      <div class="quick"><button class="btn btn-outline" type="button" data-no>Cancel</button><button class="btn btn-primary" type="button" data-yes>Approve</button></div></div>`;
    document.body.appendChild(box);
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', onKey);
    const setState = async (st, result) => {
      m.meta = { ...m.meta, state: st, result };
      renderChats(true);
      const data = await api('teamSetMeta', { id: m.id, meta: { state: st, result } }).catch(() => null);
      if (data && data.message) { state.chat.messages = mergeMsgs(state.chat.messages, [data.message]); saveChatCache(); renderChats(true); }
    };
    const cancel = () => { close(); setState('cancelled', 'Cancelled. Nothing changed.'); };
    box.querySelector('[data-no]').onclick = cancel;
    box.onclick = (e) => { if (e.target === box) cancel(); };
    box.querySelector('[data-yes]').onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      const done = [], failed = [];
      for (const a of m.meta.actions) {
        try { await runAction(a); done.push(AI.describeAction(a)); } catch (error) { failed.push(`${AI.describeAction(a)}: ${error.message}`); }
      }
      close();
      await setState(failed.length ? 'failed' : 'done', failed.length ? `${done.length ? 'Saved: ' + done.join('; ') + '\n' : ''}Failed: ${failed.join('; ')}` : `Saved: ${done.join('; ')}`);
      toast(failed.length ? 'Some changes failed' : 'Saved to the sheet', failed.length > 0);
    };
    box.querySelector('[data-yes]').focus();
  };

  const runAction = async (a) => {
    const tag = `(via Scout, ${state.chat.me})`;
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    switch (a.type) {
      case 'update_lead': {
        await ensureTab(a.tab);
        const row = findRow(a.tab, a.row, a.business);
        if (!row) throw new Error(`${a.business} moved in the sheet; ask again`);
        const changes = {};
        a.changes.forEach((c) => (changes[c.column] = c.value));
        const noteHeader = TABS[a.tab].editable.some((s) => s.h === 'Remarks') ? 'Remarks' : 'Notes';
        if (noteHeader in row.values) {
          if (typeof changes[noteHeader] === 'string' && changes[noteHeader]) changes[noteHeader] += ' ' + tag;
          else if (!(noteHeader in changes)) {
            const cur = str(row, noteHeader);
            changes[noteHeader] = `${cur ? cur + '\n' : ''}${today}: ${a.changes.map((c) => `${c.column}: ${c.value === true ? 'yes' : c.value === false ? 'no' : c.value}`).join(', ')} ${tag}`;
          }
        }
        await api('update', { tab: a.tab, row: row.row, businessName: a.business, changes });
        Object.assign(row.values, changes);
        state.summary = null;
        return;
      }
      case 'move_lead': {
        await api('move', { fromTab: a.tab, row: a.row, businessName: a.business, to: a.to });
        delete state.tabs[a.tab];
        delete state.tabs[a.to];
        state.summary = null;
        return;
      }
      case 'set_post_status':
      case 'post_note': {
        const social = await loadSocial(true);
        const post = (social.posts || []).find((p) => String(p.values['Post ID']) === a.postId);
        if (!post) throw new Error('post not found');
        const changes = a.type === 'set_post_status' ? { Status: a.status } : { 'Owner note': `${a.text} ${tag}` };
        await api('socialUpdatePost', { postId: a.postId, expectedStatus: String(post.values.Status || '').trim(), changes });
        state.social = null;
        return;
      }
      case 'add_idea':
        await api('socialAddSuggestion', { suggestion: a.text, referenceLink: '', photoBase64: '', addedBy: state.chat.me });
        state.social = null;
        return;
      case 'send_message': {
        const chat = a.to === 'Everyone' ? TEAM_CHAT : dmId(state.chat.me, a.to);
        await postMessage(chat, a.text, { lead: a.tab ? { tab: a.tab, row: a.row, business: a.business } : null });
        return;
      }
      case 'create_group':
        await api('teamCreateGroup', { title: a.title, members: a.members });
        await syncChats();
        return;
      case 'clear_chats':
        await clearAllChats();
        return;
      default:
        return;
    }
  };

  const clearAllChats = async () => {
    await api('teamResetChats', {});
    state.chat = { ...state.chat, messages: [], chats: [], cursor: 0, epoch: '' };
    await syncChats();
  };

  const openNewGroup = () => {
    const others = state.chat.members.filter((m) => normName(m) !== normName(state.chat.me));
    const box = document.createElement('div');
    box.className = 'approval';
    box.innerHTML = `<form class="approval-card" role="dialog" aria-modal="true" aria-labelledby="ng-title">
      <h3 id="ng-title">New group</h3>
      <div class="field"><label for="ng-name">Group name</label><input id="ng-name" maxlength="60" placeholder="e.g. Kochi sales"></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font:500 11px/1 'DM Mono';letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Members</legend>
      ${others.map((n) => `<label class="check" style="text-transform:none;font:15px 'DM Sans';color:var(--ink);letter-spacing:0"><input type="checkbox" value="${esc(n)}"> ${esc(n)}</label>`).join('')}</fieldset>
      <p class="form-error" data-err style="color:var(--danger)"></p>
      <div class="quick"><button class="btn btn-outline" type="button" data-no>Cancel</button><button class="btn btn-primary" type="submit">Create group</button></div></form>`;
    document.body.appendChild(box);
    const form = box.querySelector('form');
    form.querySelector('#ng-name').focus();
    box.querySelector('[data-no]').onclick = () => box.remove();
    box.onclick = (e) => { if (e.target === box) box.remove(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = form.querySelector('#ng-name').value.trim();
      const members = [...form.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
      const err = form.querySelector('[data-err]');
      if (!title) { err.textContent = 'Give the group a name.'; return; }
      if (!members.length) { err.textContent = 'Pick at least one person.'; return; }
      try {
        const data = await api('teamCreateGroup', { title, members });
        box.remove();
        state.openChat = data.chat.id;
        await syncChats();
        renderChats(true);
      } catch (error) { err.textContent = error.message; }
    };
  };

  // ---------- To-do ----------

  const T_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
  const T_COLORS = { Urgent: '#d92d20', High: '#ee7a1b', Medium: '#c9a227', Low: '#5b9a78' };
  const T_ICONS = { Urgent: '▲▲', High: '▲', Medium: '●', Low: '▼' };
  const T_STATUSES = ['To do', 'Doing', 'Done'];
  const T_EVERYONE = 'Everyone';
  const T_AVATARS = ['#b5495c', '#2b5c9e', '#2f7d4a', '#8a5cc2', '#d2691e', '#1f8f8f', '#c9a227'];
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  state.todo = { loaded: false, loading: false, error: '', me: '', members: [], groups: [], tasks: [], scope: 'mine', view: 'priority', group: '', prio: '', q: '', showDone: false };
  let todoTimer = null;

  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const assignedTo = (t, name) => t.assignees.some((a) => sameName(a, T_EVERYONE) || sameName(a, name));
  const groupColor = (name) => ((state.todo.groups.find((g) => sameName(g.name, name))) || {}).color || '#7a6a6e';
  const prioRank = (p) => Math.max(0, T_PRIORITIES.indexOf(p));
  const avatarColor = (name) => {
    let h = 0;
    for (const ch of String(name).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return T_AVATARS[h % T_AVATARS.length];
  };
  const avatarHtml = (name) =>
    sameName(name, T_EVERYONE)
      ? '<span class="t-av" style="background:var(--wine)" title="Everyone">★</span>'
      : `<span class="t-av" style="background:${avatarColor(name)}" title="${esc(name)}">${esc(String(name).trim().charAt(0).toUpperCase())}</span>`;
  const taskDays = (t) => (t.due ? daysFromToday(t.due) : null);
  // Times are "HH:MM" (24-hour), shown as "5:30 pm".
  const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
  const fmtTime = (hhmm) => {
    if (!isTime(hhmm)) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
  };
  const nowTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const whenKey = (due, time) => `${due || '9999-99-99'} ${isTime(time) ? time : '99:99'}`;
  const nextWeekday = (index) => {
    const day = new Date(todayIso() + 'T00:00:00Z').getUTCDay();
    return isoPlusDays(((index - day + 7) % 7) || 7);
  };
  const nextMondayIso = () => {
    const day = new Date(todayIso() + 'T00:00:00Z').getUTCDay();
    return isoPlusDays(((8 - day) % 7) || 7);
  };
  const todoAttention = () => {
    const t = state.todo;
    return t.loaded ? t.tasks.filter((x) => x.status !== 'Done' && assignedTo(x, t.me) && (taskDays(x) ?? 1) <= 0).length : 0;
  };

  // "call Dev tomorrow urgent for Adriel" -> title, priority, due, assignees (same rules as the app).
  const parseQuickAdd = (input, members, me) => {
    const st = { text: ` ${String(input).trim()} ` };
    const take = (re) => {
      const m = re.exec(st.text);
      if (m) st.text = st.text.slice(0, m.index) + ' ' + st.text.slice(m.index + m[0].length);
      return m;
    };
    let priority = '', due = '', time = '';
    const assignees = [];
    // Times first, so "5:30" or "at 5pm" is never read as a date. "at 5" alone means 5 pm.
    const clock = take(/\b(?:at |by )?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?=\s|$|[,.;!?])/i) ||
      take(/\b(?:at |by )?([01]?\d|2[0-3])[:.]([0-5]\d)\b/i) ||
      take(/\bat (\d{1,2})\b(?! ?(?:day|days|week|weeks|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i);
    if (clock) {
      let hour = Number(clock[1]);
      const minute = Number(clock[2] || 0);
      const mer = (clock[3] || '').toLowerCase().replace(/\./g, '');
      if (mer === 'pm' && hour < 12) hour += 12;
      else if (mer === 'am' && hour === 12) hour = 0;
      else if (!mer && clock[2] === undefined && hour >= 1 && hour <= 7) hour += 12;
      if (hour <= 23 && minute <= 59) time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    } else if (take(/\b(?:at )?noon\b/i)) time = '12:00';
    else if (take(/\bin the morning\b/i)) time = '09:00';
    else if (take(/\bin the evening\b/i)) time = '18:00';
    if (take(/\b(?:urgent(?:ly)?|asap|critical|p0)\b/i)) priority = 'Urgent';
    else if (take(/\b(?:high priority|priority high|important|p1)\b/i)) priority = 'High';
    else if (take(/\b(?:medium priority|priority medium|p2)\b/i)) priority = 'Medium';
    else if (take(/\b(?:low priority|priority low|no rush|whenever|p3)\b/i)) priority = 'Low';
    const today = todayIso();
    if (take(/\bday after tomorrow\b/i)) due = isoPlusDays(2);
    else if (take(/\b(?:tomorrow|tmrw|tmr)\b/i)) due = isoPlusDays(1);
    else if (take(/\btonight\b/i)) { due = today; if (!time) time = '20:00'; }
    else if (take(/\b(?:today|eod)\b/i)) due = today;
    else if (take(/\bnext week\b/i)) due = nextMondayIso();
    else {
      const iso = take(/\b(\d{4}-\d{2}-\d{2})\b/);
      const inDays = iso ? null : take(/\bin (\d{1,2}) (day|days|week|weeks)\b/i);
      const mon = MONTHS.join('|');
      const dm = iso || inDays ? null : take(new RegExp(`\\b(?:on |by )?(\\d{1,2})(?:st|nd|rd|th)? (${mon})[a-z]*\\b`, 'i'));
      const md = iso || inDays || dm ? null : take(new RegExp(`\\b(?:on |by )?(${mon})[a-z]* (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
      const wd = iso || inDays || dm || md ? null : take(new RegExp(`\\b(?:on |by |next |this )?(${WEEKDAYS.join('|')})\\b`, 'i'));
      if (iso) due = iso[1];
      else if (inDays) due = isoPlusDays(Number(inDays[1]) * (/^week/i.test(inDays[2]) ? 7 : 1));
      else if (dm || md) {
        const day = Number(dm ? dm[1] : md[2]);
        const month = MONTHS.indexOf((dm ? dm[2] : md[1]).toLowerCase().slice(0, 3));
        const year = Number(today.slice(0, 4));
        const pad = (n) => String(n).padStart(2, '0');
        let cand = `${year}-${pad(month + 1)}-${pad(day)}`;
        if (cand < today) cand = `${year + 1}-${pad(month + 1)}-${pad(day)}`;
        if (month >= 0 && new Date(cand + 'T00:00:00Z').getUTCDate() === day) due = cand;
      } else if (wd) due = nextWeekday(WEEKDAYS.indexOf(wd[1].toLowerCase()));
    }
    const names = [...members.map((m) => m.split(' ')[0].replace(/[^a-z0-9]/gi, '')), 'everyone', 'all', 'team', 'me'];
    const who = new RegExp(`(?:\\bfor\\b|\\bassign(?:ed)?(?: to)?\\b|@)\\s*(${names.join('|')})\\b`, 'ig');
    for (let m = who.exec(st.text); m; m = who.exec(st.text)) {
      const w = m[1].toLowerCase();
      if (w === 'everyone' || w === 'all' || w === 'team') assignees.push(T_EVERYONE);
      else if (w === 'me') assignees.push(me);
      else {
        const member = members.find((x) => x.split(' ')[0].toLowerCase() === w);
        if (member && !assignees.includes(member)) assignees.push(member);
      }
    }
    if (assignees.length) st.text = st.text.replace(who, ' ');
    let title = st.text.replace(/\s+/g, ' ').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '').replace(/\b(?:by|on|at|due)$/i, '').trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (time && !due) due = time > nowTime() ? today : isoPlusDays(1);
    return { title: title || String(input).trim(), priority, due, time, assignees };
  };

  const loadTodo = async (force) => {
    const t = state.todo;
    if (t.loading || !state.session) return;
    if (!force && t.loaded && Date.now() - (t.at || 0) < 15000) return;
    t.loading = true;
    try {
      const data = await api('taskList', {});
      Object.assign(t, { me: data.me, members: data.members || [], groups: data.groups || [], tasks: data.tasks || [], loaded: true, error: '', at: Date.now() });
    } catch (error) {
      if (error instanceof SessionExpired) { handleError(error); return; }
      t.error = error.message;
    } finally {
      t.loading = false;
    }
    renderTabs();
    if (state.section === 'todo' || state.section === 'calendar') renderTodoBody();
  };
  const startTodoPolling = () => {
    clearInterval(todoTimer);
    loadTodo(true);
    todoTimer = setInterval(() => { if (!document.hidden) loadTodo(true); }, 60000);
  };

  // Optimistic save: show the change at once, roll back if the sheet refuses it.
  const todoSave = async (task, optimistic) => {
    const t = state.todo;
    const snapshot = t.tasks.map((x) => ({ ...x }));
    if (optimistic) optimistic();
    renderTabs();
    if (state.section === 'todo' || state.section === 'calendar') renderTodoBody();
    try {
      const data = await api('taskSave', { task });
      const i = t.tasks.findIndex((x) => x.id === data.task.id);
      if (i >= 0) t.tasks[i] = data.task;
      else t.tasks.unshift(data.task);
      if (!t.groups.some((g) => sameName(g.name, data.task.group))) loadTodo(true);
      return data.task;
    } catch (error) {
      t.tasks = snapshot;
      handleError(error);
      return null;
    } finally {
      renderTabs();
      if (state.section === 'todo' || state.section === 'calendar') renderTodoBody();
    }
  };

  const toggleTodo = (id) => {
    const task = state.todo.tasks.find((x) => x.id === id);
    if (!task) return;
    const status = task.status === 'Done' ? 'To do' : 'Done';
    todoSave({ id, status }, () => { Object.assign(task, { status, doneAt: status === 'Done' ? Date.now() : 0, doneBy: status === 'Done' ? state.todo.me : '' }); });
  };

  const dueInfo = (iso, time) => {
    const d = daysFromToday(iso);
    if (d === null) return null;
    const at = isTime(time) ? ' · ' + fmtTime(time) : '';
    if (d < 0) return { text: d === -1 ? 'Yesterday' + at : `${-d}d overdue`, cls: 'due-over' };
    if (d === 0) return { text: 'Today' + at, cls: at && time < nowTime() ? 'due-over' : 'due-today' };
    if (d === 1) return { text: 'Tomorrow' + at, cls: 'due-soon' };
    return { text: shortDate(iso) + at, cls: 'due-soon' };
  };

  const taskHtml = (task, showGroup) => {
    const done = task.status === 'Done';
    const color = T_COLORS[task.priority] || T_COLORS.Medium;
    const due = task.due && !done ? dueInfo(task.due, task.time) : null;
    return `<div class="task${done ? ' done' : ''}" style="--pc:${color}">
      <button class="t-check" type="button" data-toggle="${esc(task.id)}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>
      <button class="t-main" type="button" data-open="${esc(task.id)}">
        <span class="t-title">${esc(task.title)}</span>
        <span class="t-meta">
          ${!done && (task.priority === 'Urgent' || task.priority === 'High') ? `<span class="pill t-prio">${T_ICONS[task.priority]} ${esc(task.priority)}</span>` : ''}
          ${due ? `<span class="pill ${due.cls}">${esc(due.text)}</span>` : ''}
          ${showGroup ? `<span class="t-group"><i style="background:${esc(groupColor(task.group))}"></i>${esc(task.group)}</span>` : ''}
          ${task.notes ? '<span class="t-note" title="Has notes">☰</span>' : ''}
          ${task.leadRow ? `<span class="t-note" title="${esc(task.business || 'Linked lead')}">⛓</span>` : ''}
        </span>
      </button>
      <span class="t-avs" aria-label="Assigned to ${esc(task.assignees.join(', '))}">${task.assignees.slice(0, 3).map(avatarHtml).join('')}${task.assignees.length > 3 ? `<span class="meta">+${task.assignees.length - 3}</span>` : ''}</span>
    </div>`;
  };

  const todoSections = (open, scoped) => {
    const t = state.todo;
    const byUrgency = (a, b) => prioRank(a.priority) - prioRank(b.priority) || whenKey(a.due, a.time).localeCompare(whenKey(b.due, b.time)) || b.created - a.created;
    const byDue = (a, b) => whenKey(a.due, a.time).localeCompare(whenKey(b.due, b.time)) || prioRank(a.priority) - prioRank(b.priority) || b.created - a.created;
    if (t.view === 'priority') {
      return T_PRIORITIES.map((p) => ({ key: p, title: p, color: T_COLORS[p], tasks: open.filter((x) => x.priority === p).sort(byUrgency) })).filter((s) => s.tasks.length);
    }
    if (t.view === 'group') {
      const names = [...t.groups.map((g) => g.name), ...scoped.map((x) => x.group)].filter((n, i, all) => all.findIndex((m) => sameName(m, n)) === i);
      return names.map((name) => {
        const inGroup = scoped.filter((x) => sameName(x.group, name));
        return { key: name, title: name, color: groupColor(name), tasks: open.filter((x) => sameName(x.group, name)).sort(byUrgency), progress: { done: inGroup.filter((x) => x.status === 'Done').length, total: inGroup.length } };
      }).filter((s) => s.tasks.length);
    }
    const buckets = [
      ['Overdue', '#d92d20', (d) => d !== null && d < 0], ['Today', '#c9a227', (d) => d === 0], ['Tomorrow', '#2b5c9e', (d) => d === 1],
      ['This week', '#2b5c9e', (d) => d !== null && d > 1 && d <= 7], ['Later', '#7a6a6e', (d) => d !== null && d > 7], ['No date', '#a89a9d', (d) => d === null],
    ];
    return buckets.map(([title, color, test]) => ({ key: title, title, color, tasks: open.filter((x) => test(taskDays(x))).sort(byDue) })).filter((s) => s.tasks.length);
  };

  const renderTodoBody = () => {
    // Task changes made from the calendar redraw it too.
    if (state.section === 'calendar') { renderCalBody(); return; }
    const body = $('todo-body');
    if (!body || state.section !== 'todo') return;
    const t = state.todo;
    if (!t.loaded) {
      body.innerHTML = t.error ? emptyState("Couldn't load the to-do list.", ' ' + t.error, '<br><button class="btn btn-outline" type="button" data-retry>Try again</button>') : skeletons(3);
      const retry = body.querySelector('[data-retry]');
      if (retry) retry.onclick = () => loadTodo(true);
      return;
    }
    const q = t.q.trim().toLowerCase();
    const scoped = t.tasks.filter((x) => {
      if (t.scope === 'mine' && !assignedTo(x, t.me)) return false;
      if (t.scope !== 'mine' && t.scope !== 'all' && !assignedTo(x, t.scope)) return false;
      if (t.group && !sameName(x.group, t.group)) return false;
      if (t.prio && x.priority !== t.prio) return false;
      return !q || `${x.title} ${x.notes} ${x.group} ${x.assignees.join(' ')} ${x.business}`.toLowerCase().includes(q);
    });
    const open = scoped.filter((x) => x.status !== 'Done');
    const done = scoped.filter((x) => x.status === 'Done').sort((a, b) => b.doneAt - a.doneAt);
    const weekAgo = Date.now() - 7 * 86400000;
    const stats = {
      open: open.length,
      today: open.filter((x) => taskDays(x) === 0).length,
      over: open.filter((x) => (taskDays(x) ?? 1) < 0).length,
      week: done.filter((x) => x.doneAt >= weekAgo).length,
    };
    const pct = scoped.length ? Math.round((done.length / scoped.length) * 100) : 0;
    const sections = todoSections(open, scoped);
    const people = t.members.filter((m) => !sameName(m, t.me));
    const chip = (attrs, label, on, style) => `<button class="chip" type="button" ${attrs} aria-pressed="${on}"${style ? ` style="${style}"` : ''}>${label}</button>`;
    body.innerHTML = `
      ${t.error ? `<p class="form-error" style="color:var(--danger)">${esc(t.error)}</p>` : ''}
      <div class="stats">
        <div class="stat"><b>${stats.open}</b><span>Open</span></div>
        <div class="stat"><b>${stats.today}</b><span>Due today</span></div>
        <div class="stat${stats.over ? ' hot' : ''}"><b>${stats.over}</b><span>Overdue</span></div>
        <div class="stat"><b>${stats.week}</b><span>Done · 7 days</span></div>
      </div>
      <div class="t-progress" role="img" aria-label="${pct}% done"><i style="width:${pct}%"></i></div>
      <div class="chips" aria-label="Whose tasks">
        ${chip('data-scope="mine"', 'Mine', t.scope === 'mine')}${chip('data-scope="all"', 'Everyone', t.scope === 'all')}
        ${people.map((n) => chip(`data-scope="${esc(n)}"`, `${avatarHtml(n)} ${esc(n)}`, sameName(t.scope, n))).join('')}
      </div>
      <div class="toolbar">
        <div class="t-seg" role="tablist">${[['priority', 'Priority'], ['group', 'Groups'], ['due', 'Due']].map(([k, l]) => `<button type="button" role="tab" data-view="${k}" aria-selected="${t.view === k}">${l}</button>`).join('')}</div>
      </div>
      <div class="chips" aria-label="Filter">
        ${T_PRIORITIES.map((p) => chip(`data-prio="${p}"`, `<i class="t-dot" style="background:${T_COLORS[p]}"></i>${p}`, t.prio === p)).join('')}
        ${t.groups.map((g) => chip(`data-group="${esc(g.name)}"`, `<i class="t-dot" style="background:${esc(g.color)}"></i>${esc(g.name)}`, sameName(t.group, g.name))).join('')}
      </div>
      ${!sections.length && !done.length
        ? emptyState(scoped.length === 0 && t.tasks.length ? 'Nothing matches' : 'No tasks yet', scoped.length === 0 && t.tasks.length ? ' Try another person, group or priority.' : ' Type above or press the mic and say it, for example "call Dev tomorrow urgent for Adriel".')
        : ''}
      ${sections.map((s) => `<section class="t-section">
        <h3><i class="t-dot" style="background:${esc(s.color)}"></i>${esc(s.title)} <span class="meta">${s.tasks.length}</span>
          ${s.progress ? `<span class="t-gprog"><span class="t-gtrack"><i style="width:${s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : 0}%;background:${esc(s.color)}"></i></span><span class="meta">${s.progress.done}/${s.progress.total}</span></span>` : ''}</h3>
        <div class="t-list">${s.tasks.map((x) => taskHtml(x, t.view !== 'group')).join('')}</div>
      </section>`).join('')}
      ${done.length ? `<section class="t-section"><h3><button class="t-fold" type="button" data-showdone aria-expanded="${t.showDone}">${t.showDone ? '▾' : '▸'} Done <span class="meta">${done.length}</span></button></h3>
        ${t.showDone ? `<div class="t-list">${done.map((x) => taskHtml(x, true)).join('')}</div>` : ''}</section>` : ''}`;
    body.querySelectorAll('[data-scope]').forEach((b) => (b.onclick = () => { t.scope = b.dataset.scope; renderTodoBody(); }));
    body.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { t.view = b.dataset.view; renderTodoBody(); }));
    body.querySelectorAll('[data-prio]').forEach((b) => (b.onclick = () => { t.prio = t.prio === b.dataset.prio ? '' : b.dataset.prio; renderTodoBody(); }));
    body.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => { t.group = sameName(t.group, b.dataset.group) ? '' : b.dataset.group; renderTodoBody(); }));
    body.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => toggleTodo(b.dataset.toggle)));
    body.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openTodoEditor(b.dataset.open, null, b)));
    const fold = body.querySelector('[data-showdone]');
    if (fold) fold.onclick = () => { t.showDone = !t.showDone; renderTodoBody(); };
  };

  // Voice typing through the browser's speech recognition (Chrome, Edge, Safari). Hidden where unsupported.
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const attachMic = (button, input, onText) => {
    if (!button) return;
    if (!SpeechRec) { button.hidden = true; return; }
    let rec = null;
    const stop = () => { if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } } };
    button.onclick = () => {
      if (rec) { stop(); return; }
      rec = new SpeechRec();
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      const base = input.value ? input.value.replace(/\s+$/, '') + ' ' : '';
      button.classList.add('live');
      button.setAttribute('aria-label', 'Stop listening');
      rec.onresult = (e) => {
        const text = [...e.results].map((r) => r[0].transcript).join(' ');
        input.value = base + text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone for this page to dictate.', true);
        else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Voice typing stopped. You can type instead.', true);
      };
      rec.onend = () => {
        rec = null;
        button.classList.remove('live');
        button.setAttribute('aria-label', 'Dictate with the microphone');
        if (onText) onText();
      };
      try { rec.start(); } catch (e) { rec = null; button.classList.remove('live'); }
    };
  };

  const openTodoEditor = (id, draft, opener) => {
    const t = state.todo;
    const task = id ? t.tasks.find((x) => x.id === id) : null;
    const base = task || draft || {};
    const form = {
      title: base.title || '', notes: base.notes || '', priority: base.priority || 'Medium', status: base.status || 'To do',
      due: base.due || '', time: base.due && isTime(base.time) ? base.time : '', group: base.group || 'General', assignees: base.assignees && base.assignees.length ? [...base.assignees] : [t.me],
    };
    openDrawer(`
      <div class="drawer-head"><div class="grow"><p class="eyebrow">${task ? 'Edit task' : 'New task'}</p><h2 id="drawer-title">${task ? esc(task.title) : 'Add a task'}</h2>
        ${task ? `<span class="meta">Added by ${esc(task.createdBy || 'someone')}${task.status === 'Done' && task.doneBy ? ' · done by ' + esc(task.doneBy) : ''}</span>` : ''}</div>
        <button class="btn btn-outline icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body">
        <div class="field"><label for="te-title">Title</label>
          <div class="t-row"><input id="te-title" maxlength="200" placeholder="What needs doing?" value="${esc(form.title)}"><button class="t-mic" type="button" id="te-mic" aria-label="Dictate with the microphone" title="Dictate">🎤</button></div></div>
        <div class="field"><label>Priority</label><div class="chips" id="te-prio">${T_PRIORITIES.map((p) => `<button class="chip" type="button" data-p="${p}" aria-pressed="${form.priority === p}"><i class="t-dot" style="background:${T_COLORS[p]}"></i>${p}</button>`).join('')}</div></div>
        <div class="field"><label>Assign to</label><div class="chips" id="te-who">${[...t.members, T_EVERYONE].map((n) => `<button class="chip" type="button" data-who="${esc(n)}" aria-pressed="${form.assignees.some((a) => sameName(a, n))}">${avatarHtml(n)} ${esc(n)}${sameName(n, t.me) ? ' (me)' : ''}</button>`).join('')}</div></div>
        <div class="field"><label for="te-due">Due</label>
          <div class="t-row"><input id="te-due" type="date" value="${esc(form.due)}">
            <button class="chip" type="button" data-dq="0">Today</button><button class="chip" type="button" data-dq="1">Tomorrow</button><button class="chip" type="button" data-dq="mon">Next week</button><button class="chip" type="button" data-dq="">No date</button></div></div>
        <div class="field"><label for="te-time">Time</label>
          <div class="t-row"><input id="te-time" type="time" step="300" value="${esc(form.time)}">
            ${[['09:00', '9 am'], ['12:00', '12 pm'], ['15:00', '3 pm'], ['18:00', '6 pm']].map(([v, l]) => `<button class="chip" type="button" data-tq="${v}">${l}</button>`).join('')}<button class="chip" type="button" data-tq="">No time</button></div></div>
        <div class="field"><label>Group</label><div class="chips" id="te-group">${t.groups.map((g) => `<button class="chip" type="button" data-g="${esc(g.name)}" aria-pressed="${sameName(form.group, g.name)}"><i class="t-dot" style="background:${esc(g.color)}"></i>${esc(g.name)}</button>`).join('')}</div>
          <input id="te-newgroup" maxlength="30" placeholder="Or create a new group" aria-label="New group name"></div>
        ${task ? `<div class="field"><label>Status</label><div class="chips" id="te-status">${T_STATUSES.map((s) => `<button class="chip" type="button" data-s="${s}" aria-pressed="${form.status === s}">${s}</button>`).join('')}</div></div>` : ''}
        <div class="field"><label for="te-notes">Notes</label><textarea id="te-notes" maxlength="4000" placeholder="Details, links, what done looks like">${esc(form.notes)}</textarea></div>
        ${task && task.leadRow && task.leadTab ? `<div><button class="btn btn-outline" type="button" data-lead>Open lead${task.business ? ': ' + esc(task.business) : ''}</button></div>` : ''}
      </div>
      <div class="drawer-foot">${task ? '<button class="btn btn-danger" type="button" data-del>Delete</button>' : ''}<span class="status-text" data-err></span>
        <button class="btn btn-outline" type="button" data-close-foot>Cancel</button>
        <button class="btn btn-primary" type="button" data-save>${task ? 'Save changes' : 'Add task'}</button></div>`, opener);
    const d = $('drawer');
    const mark = (wrap, attr, val) => wrap.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset[attr] === val)));
    d.querySelector('#te-prio').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { form.priority = b.dataset.p; mark(d.querySelector('#te-prio'), 'p', form.priority); } };
    d.querySelector('#te-group').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { form.group = b.dataset.g; d.querySelector('#te-newgroup').value = ''; mark(d.querySelector('#te-group'), 'g', form.group); } };
    const st = d.querySelector('#te-status');
    if (st) st.onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { form.status = b.dataset.s; mark(st, 's', form.status); } };
    d.querySelector('#te-who').onclick = (e) => {
      const b = e.target.closest('[data-who]');
      if (!b) return;
      const n = b.dataset.who;
      if (sameName(n, T_EVERYONE)) form.assignees = form.assignees.some((a) => sameName(a, T_EVERYONE)) ? [t.me] : [T_EVERYONE];
      else {
        const rest = form.assignees.filter((a) => !sameName(a, T_EVERYONE));
        const next = rest.some((a) => sameName(a, n)) ? rest.filter((a) => !sameName(a, n)) : [...rest, n];
        form.assignees = next.length ? next : [t.me];
      }
      d.querySelectorAll('#te-who .chip').forEach((c) => c.setAttribute('aria-pressed', String(form.assignees.some((a) => sameName(a, c.dataset.who)))));
    };
    d.querySelectorAll('[data-dq]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.dq;
      d.querySelector('#te-due').value = v === '' ? '' : v === 'mon' ? nextMondayIso() : isoPlusDays(Number(v));
      if (v === '') d.querySelector('#te-time').value = '';
    }));
    // A time needs a day: with no date, it means the next time that clock comes round.
    const timeSet = (v) => {
      d.querySelector('#te-time').value = v;
      if (v && !d.querySelector('#te-due').value) d.querySelector('#te-due').value = v > nowTime() ? todayIso() : isoPlusDays(1);
    };
    d.querySelectorAll('[data-tq]').forEach((b) => (b.onclick = () => timeSet(b.dataset.tq)));
    d.querySelector('#te-time').addEventListener('change', (e) => timeSet(e.target.value));
    attachMic(d.querySelector('#te-mic'), d.querySelector('#te-title'));
    drawerDirty = () => d.querySelector('#te-title').value.trim() !== form.title.trim() && !!d.querySelector('#te-title').value.trim() && !task;
    const lead = d.querySelector('[data-lead]');
    if (lead) lead.onclick = () => { closeDrawer(true); go(task.leadTab); };
    const close = () => closeDrawer(true);
    d.querySelector('[data-close-foot]').onclick = close;
    const del = d.querySelector('[data-del]');
    if (del) del.onclick = async () => {
      if (!confirm(`Delete "${task.title}"?`)) return;
      const snapshot = t.tasks.map((x) => ({ ...x }));
      t.tasks = t.tasks.filter((x) => x.id !== task.id);
      close(); renderTabs(); renderTodoBody();
      try { await api('taskDelete', { id: task.id }); } catch (error) { t.tasks = snapshot; renderTabs(); renderTodoBody(); handleError(error); }
    };
    const save = d.querySelector('[data-save]');
    save.onclick = async () => {
      const err = d.querySelector('[data-err]');
      const title = d.querySelector('#te-title').value.trim();
      if (!title) { err.textContent = 'Write what needs doing first.'; d.querySelector('#te-title').focus(); return; }
      save.disabled = true;
      err.textContent = 'Saving…';
      let group = form.group;
      const newGroup = d.querySelector('#te-newgroup').value.trim();
      try {
        if (newGroup) { const g = await api('taskGroupSave', { groupName: newGroup }); t.groups = g.groups || t.groups; group = (t.groups.find((x) => sameName(x.name, newGroup)) || { name: newGroup }).name; }
        const fields = { title, notes: d.querySelector('#te-notes').value.trim(), priority: form.priority, status: form.status, due: d.querySelector('#te-due').value, time: d.querySelector('#te-due').value && isTime(d.querySelector('#te-time').value) ? d.querySelector('#te-time').value : '', group, assignees: form.assignees };
        const data = await api('taskSave', { task: task ? { ...fields, id: task.id } : fields });
        const i = t.tasks.findIndex((x) => x.id === data.task.id);
        if (i >= 0) t.tasks[i] = data.task; else t.tasks.unshift(data.task);
        closeDrawer(true);
        renderTabs(); renderTodoBody();
      } catch (error) {
        save.disabled = false;
        err.textContent = error.message;
        if (error instanceof SessionExpired) handleError(error);
      }
    };
  };

  const renderTodo = () => {
    const view = $('view');
    const t = state.todo;
    view.innerHTML = `<div class="view-head"><div><p class="eyebrow">Team</p><h2>To-do</h2></div>
        <div class="quick"><button class="btn btn-accent" type="button" id="todo-new">New task</button></div></div>
      <form class="t-add" id="todo-add" autocomplete="off">
        <div class="t-row">
          <button class="t-mic" type="button" id="todo-mic" aria-label="Dictate with the microphone" title="Dictate a task">🎤</button>
          <input id="todo-input" aria-label="Add a task" placeholder='Add a task…  try "call Dev tomorrow urgent for Adriel"' maxlength="200">
          <button class="btn btn-primary" type="submit">Add</button>
        </div>
        <p class="t-preview" id="todo-preview" aria-live="polite"></p>
      </form>
      <div class="toolbar"><input id="todo-search" type="search" class="t-search" aria-label="Search tasks" placeholder="Search tasks" value="${esc(t.q)}"></div>
      <div id="todo-body"></div>`;
    const input = $('todo-input');
    const preview = () => {
      const p = input.value.trim() ? parseQuickAdd(input.value, t.members, t.me) : null;
      const bits = p ? [p.priority, p.due && (daysFromToday(p.due) === 0 ? 'Today' : daysFromToday(p.due) === 1 ? 'Tomorrow' : shortDate(p.due)) + (p.time ? ' · ' + fmtTime(p.time) : ''), p.assignees.length && 'For ' + p.assignees.join(', ')].filter(Boolean) : [];
      $('todo-preview').innerHTML = bits.map((b) => `<span class="pill due-today">${esc(b)}</span>`).join(' ');
    };
    input.addEventListener('input', preview);
    attachMic($('todo-mic'), input, preview);
    $('todo-add').onsubmit = async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      const p = parseQuickAdd(input.value, t.members, t.me);
      const fields = { title: p.title, priority: p.priority || t.prio || 'Medium', due: p.due, time: p.time, assignees: p.assignees.length ? p.assignees : t.scope !== 'mine' && t.scope !== 'all' ? [t.scope] : [t.me], group: t.group || 'General' };
      input.value = ''; preview();
      const temp = { id: 'local-' + Date.now(), notes: '', status: 'To do', createdBy: t.me, created: Date.now(), doneAt: 0, doneBy: '', leadTab: '', leadRow: 0, business: '', ...fields };
      await todoSave(fields, () => t.tasks.unshift(temp));
      loadTodo(true);
    };
    $('todo-new').onclick = () => openTodoEditor(null, { assignees: t.scope !== 'mine' && t.scope !== 'all' ? [t.scope] : [t.me], group: t.group || 'General', priority: t.prio || 'Medium' }, $('todo-new'));
    $('todo-search').addEventListener('input', (e) => { t.q = e.target.value; renderTodoBody(); });
    renderTodoBody();
    loadTodo(true);
  };

  // ---------- calendar ----------
  // Meetings, tasks, follow-ups and client dates from the sheets, on one month view (same rules as the app).

  const C_KINDS = {
    meeting: { label: 'Meeting', plural: 'Meetings', color: '#2b5c9e' },
    task: { label: 'Task', plural: 'Tasks', color: '#5e1220' },
    followup: { label: 'Follow-up', plural: 'Follow-ups', color: '#8a5cc2' },
    deadline: { label: 'Client deadline', plural: 'Deadlines', color: '#b5495c' },
    start: { label: 'Project start', plural: 'Starts', color: '#2f7d4a' },
  };
  const C_FILTERS = [['all', 'All'], ['meeting', 'Meetings'], ['task', 'Tasks'], ['followup', 'Follow-ups'], ['client', 'Clients']];
  const C_TABS = ['Pipeline', 'Clients', 'Leads', 'Global', 'International'];
  const C_ORDER = ['meeting', 'deadline', 'task', 'followup', 'start'];
  state.cal = { month: todayIso().slice(0, 7), sel: todayIso(), kind: 'all', mine: false, mode: 'month', open: '' };

  // The sheet mixes "2026-10-21" and "19 Oct 2026".
  const anyIso = (raw) => {
    const v = String(raw || '').trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (iso) return iso[0];
    const w = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(v);
    if (!w) return '';
    const m = MONTHS.indexOf(w[2].toLowerCase());
    return m < 0 ? '' : `${w[3]}-${String(m + 1).padStart(2, '0')}-${String(w[1]).padStart(2, '0')}`;
  };
  // "Meeting Time" is free text: "4 PM", "16:30", "4.30pm".
  const readClock = (raw) => {
    const m = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i.exec(String(raw || ''));
    if (!m || (!m[3] && m[2] === undefined)) return '';
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const mer = (m[3] || '').toLowerCase().replace(/\./g, '');
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return h > 23 || min > 59 ? '' : `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };
  const calOpen = (row) => !CLOSED.includes(str(row, TABS[row.tab].status));

  const calEvents = () => {
    const out = [];
    const rows = (tab) => (state.tabs[tab] && state.tabs[tab].rows) || [];
    const fromRow = (row, kind, date, timeText) => {
      const cfg = TABS[row.tab];
      const clock = readClock(timeText);
      const business = str(row, 'Business Name') || 'Untitled';
      const owner = str(row, 'Contacted By') || str(row, 'Assigned To');
      const notes = (str(row, 'Remarks') || str(row, 'Notes')).split('\n').map((x) => x.trim()).filter(Boolean);
      const where = [str(row, 'Area'), str(row, 'City'), str(row, 'State'), str(row, 'Country')].filter(Boolean).join(', ');
      const details = [
        [cfg.title, str(row, cfg.status)], ['Where', where], ['Phone', str(row, cfg.phone).replace(/^'/, '')],
        ['Quoted', row.tab === 'Pipeline' && str(row, 'Quoted Value (₹)') ? rupees(str(row, 'Quoted Value (₹)').replace(/[^\d.]/g, '')) : ''],
        ['Balance due', row.tab === 'Clients' && str(row, 'Balance Due (₹)') ? rupees(str(row, 'Balance Due (₹)').replace(/[^\d.]/g, '')) : ''],
        ['Owner', owner], ['Contact', str(row, 'Contact Person')], ['Latest note', notes[notes.length - 1] || ''],
      ].filter((x) => x[1]);
      const prefix = { meeting: 'Meeting: ', followup: 'Follow up: ', deadline: 'Deadline: ', start: 'Start: ' }[kind];
      out.push({
        id: `${kind}-${row.tab}-${row.row}`, kind, date, time: clock,
        timeText: String(timeText || '').trim() ? (clock ? fmtTime(clock) : String(timeText).trim()) : '',
        title: prefix + business,
        sub: kind === 'meeting' ? [str(row, cfg.status), where].filter(Boolean).join(' · ') : [cfg.title, str(row, cfg.status)].filter(Boolean).join(' · '),
        color: C_KINDS[kind].color, people: owner ? owner.split(/[,/&]| and /).map((x) => x.trim()).filter(Boolean) : [],
        done: false, details, phone: phoneDigits(str(row, cfg.phone)), row,
      });
    };
    state.todo.tasks.forEach((t) => {
      if (!t.due) return;
      out.push({
        id: 'task-' + t.id, kind: 'task', date: t.due, time: isTime(t.time) ? t.time : '', timeText: fmtTime(t.time),
        title: t.title, sub: [t.priority, t.group, t.business].filter(Boolean).join(' · '), color: T_COLORS[t.priority] || T_COLORS.Medium,
        people: t.assignees, done: t.status === 'Done', details: [], phone: '', task: t,
      });
    });
    rows('Pipeline').forEach((r) => { const d = anyIso(str(r, 'Meeting Date')); if (d) fromRow(r, 'meeting', d, str(r, 'Meeting Time')); });
    ['Leads', 'Global', 'International', 'Pipeline'].forEach((tab) => rows(tab).forEach((r) => {
      const d = anyIso(str(r, 'Next Follow-up'));
      if (d && calOpen(r)) fromRow(r, 'followup', d);
    }));
    rows('Clients').forEach((r) => {
      const dl = anyIso(str(r, 'Deadline')); if (dl) fromRow(r, 'deadline', dl);
      const st = anyIso(str(r, 'Start Date')); if (st) fromRow(r, 'start', st);
    });
    return out;
  };
  const calByTime = (a, b) => Number(a.done) - Number(b.done) || (a.time || '99:99').localeCompare(b.time || '99:99') || C_ORDER.indexOf(a.kind) - C_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title);
  const calMine = (e, me) => {
    if (e.task) return assignedTo(e.task, me);
    if (!e.people.length) return true;
    const first = String(me || '').split(' ')[0];
    return e.people.some((p) => sameName(p, T_EVERYONE) || sameName(p, me) || sameName(p.split(' ')[0], first));
  };
  const calLongDay = (iso) => {
    const label = new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    const d = daysFromToday(iso);
    return d === 0 ? 'Today · ' + label : d === 1 ? 'Tomorrow · ' + label : d === -1 ? 'Yesterday · ' + label : label;
  };

  const calCard = (e) => {
    const c = state.cal;
    const k = C_KINDS[e.kind];
    const open = c.open === e.id;
    return `<div class="cal-ev${e.done ? ' done' : ''}" style="--pc:${esc(e.color)}">
      <div class="cal-time"><b>${esc(e.timeText || 'All day')}</b><span style="color:${k.color}">${esc(k.label)}</span></div>
      <div class="cal-main">
        <button class="cal-title" type="button" data-ev="${esc(e.id)}" aria-expanded="${open}">${esc(e.title)}</button>
        <span class="cal-sub">${esc(e.sub)}</span>
        ${open ? `<dl class="cal-details">${e.details.map(([l, v]) => `<dt>${esc(l)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
          <div class="cal-actions">
            ${e.phone ? `<a class="btn btn-outline" href="tel:+${esc(e.phone)}">Call</a><a class="btn btn-outline" href="https://wa.me/${esc(e.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            ${e.row ? `<button class="btn btn-outline" type="button" data-evrow="${esc(e.id)}">Open ${e.row.tab === 'Clients' ? 'client' : 'lead'}</button>` : ''}
          </div>` : ''}
      </div>
      ${e.task ? `<button class="t-check" type="button" data-evtoggle="${esc(e.task.id)}" role="checkbox" aria-checked="${e.done}" aria-label="${e.done ? 'Mark as not done' : 'Mark as done'}">${e.done ? '✓' : ''}</button>` : ''}
      <span class="t-avs">${e.people.slice(0, 3).map(avatarHtml).join('')}</span>
    </div>`;
  };

  const renderCalBody = () => {
    const body = $('cal-body');
    if (!body || state.section !== 'calendar') return;
    const c = state.cal;
    const t = state.todo;
    const all = calEvents();
    const shown = all.filter((e) => (c.kind === 'all' || e.kind === c.kind || (c.kind === 'client' && (e.kind === 'deadline' || e.kind === 'start'))) && (!c.mine || calMine(e, t.me || state.session.name)));
    const byDate = {};
    shown.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push(e));
    Object.values(byDate).forEach((l) => l.sort(calByTime));
    const today = todayIso();
    const [y, m] = c.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [...Array(first.getUTCDay()).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(0);
    const inMonth = shown.filter((e) => e.date.startsWith(c.month) && !e.done);
    const count = (k) => inMonth.filter((e) => e.kind === k).length;
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const loading = !t.loaded || C_TABS.some((x) => !state.tabs[x] || (!state.tabs[x].rows && !state.tabs[x].error));
    const grid = `<div class="cal-month">
        <div class="cal-head">
          <button class="btn btn-outline icon-btn" type="button" data-mshift="-1" aria-label="Previous month">‹</button>
          <div><h3>${esc(first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h3>
            <span class="meta">${plural(count('meeting'), 'meeting')} · ${plural(count('task'), 'task')} · ${plural(count('followup'), 'follow-up')}</span></div>
          <button class="btn btn-outline icon-btn" type="button" data-mshift="1" aria-label="Next month">›</button>
        </div>
        <div class="cal-grid" role="grid">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<span class="cal-dow">${d}</span>`).join('')}
          ${cells.map((day) => {
            if (!day) return '<span></span>';
            const iso = `${c.month}-${String(day).padStart(2, '0')}`;
            const list = (byDate[iso] || []).filter((e) => !e.done);
            const kinds = [...new Set(list.map((e) => e.kind))].slice(0, 4);
            const cls = ['cal-day', iso === c.sel ? 'sel' : '', iso === today ? 'today' : '', iso < today ? 'past' : ''].filter(Boolean).join(' ');
            const peek = list.slice(0, 2).map((e) => `<span class="cal-peek" style="--pc:${esc(e.color)}">${esc((e.timeText ? e.timeText + ' ' : '') + e.title.replace(/^(Meeting|Follow up|Deadline|Start): /, ''))}</span>`).join('');
            return `<button class="${cls}" type="button" data-day="${iso}" aria-pressed="${iso === c.sel}" aria-label="${esc(calLongDay(iso))}, ${list.length} items">
              <b>${day}</b><span class="cal-dots">${kinds.map((k) => `<i style="background:${C_KINDS[k].color}"></i>`).join('')}</span>${peek}${list.length > 2 ? `<span class="cal-more">+${list.length - 2} more</span>` : ''}</button>`;
          }).join('')}
        </div>
        <div class="cal-legend">${['meeting', 'task', 'followup', 'deadline'].map((k) => `<span><i style="background:${C_KINDS[k].color}"></i>${C_KINDS[k].plural}</span>`).join('')}
          ${c.sel !== today || c.month !== today.slice(0, 7) ? '<button class="chip" type="button" data-caltoday>Today</button>' : ''}</div>
      </div>`;
    const dayList = byDate[c.sel] || [];
    const day = `<div class="cal-agenda">
        <div class="cal-dayhead"><h3>${esc(calLongDay(c.sel))}</h3><button class="btn btn-primary" type="button" data-caladd>Add task</button></div>
        ${dayList.length ? dayList.map(calCard).join('') : `<p class="meta cal-empty">${loading ? 'Loading…' : 'Nothing planned.'}</p>`}
      </div>`;
    const end = isoPlusDays(30);
    const overdue = shown.filter((e) => e.date < today && !e.done && (e.kind === 'task' || e.kind === 'followup')).sort((a, b) => a.date.localeCompare(b.date) || calByTime(a, b));
    const days = Object.keys(byDate).filter((d) => d >= today && d <= end).sort();
    const upcoming = `<div class="cal-agenda wide">
        ${overdue.length ? `<h3 class="cal-over">Overdue · ${overdue.length}</h3>${overdue.map(calCard).join('')}` : ''}
        ${days.length ? days.map((d) => `<h3><button class="cal-daylink" type="button" data-goday="${d}">${esc(calLongDay(d))}</button></h3>${byDate[d].map(calCard).join('')}`).join('') : `<p class="meta cal-empty">${loading ? 'Loading…' : 'Nothing in the next 30 days.'}</p>`}
      </div>`;
    body.innerHTML = `
      <div class="toolbar">
        <div class="t-seg" role="tablist">${[['month', 'Month'], ['agenda', 'Upcoming']].map(([k, l]) => `<button type="button" role="tab" data-calmode="${k}" aria-selected="${c.mode === k}">${l}</button>`).join('')}</div>
        <div class="t-seg">${[[false, 'Everyone'], [true, 'Mine']].map(([v, l]) => `<button type="button" data-calmine="${v}" aria-selected="${c.mine === v}">${l}</button>`).join('')}</div>
      </div>
      <div class="chips">${C_FILTERS.map(([k, l]) => `<button class="chip" type="button" data-calkind="${k}" aria-pressed="${c.kind === k}">${k !== 'all' && k !== 'client' ? `<i class="t-dot" style="background:${C_KINDS[k].color}"></i>` : ''}${l}</button>`).join('')}</div>
      ${c.mode === 'month' ? `<div class="cal-layout">${grid}${day}</div>` : upcoming}`;
    const rerender = () => renderCalBody();
    body.querySelectorAll('[data-calmode]').forEach((b) => (b.onclick = () => { c.mode = b.dataset.calmode; rerender(); }));
    body.querySelectorAll('[data-calmine]').forEach((b) => (b.onclick = () => { c.mine = b.dataset.calmine === 'true'; rerender(); }));
    body.querySelectorAll('[data-calkind]').forEach((b) => (b.onclick = () => { c.kind = b.dataset.calkind; rerender(); }));
    body.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { c.sel = b.dataset.day; c.open = ''; rerender(); }));
    body.querySelectorAll('[data-goday]').forEach((b) => (b.onclick = () => { c.sel = b.dataset.goday; c.month = c.sel.slice(0, 7); c.mode = 'month'; rerender(); }));
    body.querySelectorAll('[data-mshift]').forEach((b) => (b.onclick = () => {
      const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.mshift), 1));
      c.month = d.toISOString().slice(0, 7);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      c.sel = `${c.month}-${String(Math.min(Number(c.sel.slice(8)), last)).padStart(2, '0')}`;
      rerender();
    }));
    const todayBtn = body.querySelector('[data-caltoday]');
    if (todayBtn) todayBtn.onclick = () => { c.sel = today; c.month = today.slice(0, 7); rerender(); };
    const add = body.querySelector('[data-caladd]');
    if (add) add.onclick = () => openTodoEditor(null, { due: c.sel, assignees: [t.me], group: 'General', priority: 'Medium' }, add);
    body.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => {
      const e = all.find((x) => x.id === b.dataset.ev);
      if (!e) return;
      if (e.task) openTodoEditor(e.task.id, null, b);
      else { c.open = c.open === e.id ? '' : e.id; rerender(); }
    }));
    body.querySelectorAll('[data-evrow]').forEach((b) => (b.onclick = () => {
      const e = all.find((x) => x.id === b.dataset.evrow);
      if (e && e.row) openRow(e.row.tab, e.row, b);
    }));
    body.querySelectorAll('[data-evtoggle]').forEach((b) => (b.onclick = () => { toggleTodo(b.dataset.evtoggle); }));
  };

  const renderCalendar = (force) => {
    $('view').innerHTML = `<div class="view-head"><div><p class="eyebrow">Team</p><h2>Calendar</h2></div>
        <div class="quick"><button class="btn btn-outline" type="button" id="cal-refresh">Refresh</button></div></div>
      <div id="cal-body"></div>`;
    $('cal-refresh').onclick = () => renderCalendar(true);
    renderCalBody();
    const jobs = C_TABS.map((tab) => ensureTab(tab, force).catch(() => null));
    jobs.push(loadTodo(true));
    jobs.forEach((j) => Promise.resolve(j).then(() => renderCalBody()));
  };

  // ---------- boot ----------

  state.session = loadSession();
  if (state.session) startApp();
  else showLogin();
})();

// Light/dark toggle: first tap switches away from what the device uses; the choice is remembered.
(() => {
  const btn = document.getElementById('theme');
  if (!btn) return;
  btn.onclick = () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('scout-theme', next); } catch (e) { /* not remembered */ }
  };
})();
