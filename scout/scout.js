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
  };

  const renderTabs = () => {
    $('tabs').innerHTML = SECTIONS.map((s) => {
      const t = state.tabs[s.id];
      const open = t && t.rows ? t.rows.filter((r) => !CLOSED.includes(str(r, TABS[s.id].status))).length : null;
      const unread = s.id === 'inbox' ? totalUnread() : 0;
      return `<button class="tab" type="button" data-section="${s.id}" ${s.id === state.section ? 'aria-current="page"' : ''}>${esc(s.title)}${
        unread ? `<span class="tab-badge" aria-label="${unread} unread">${unread > 9 ? '9+' : unread}</span>` : open !== null ? `<span class="count">${open}</span>` : ''
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
    if (!fromHash) history.replaceState(null, '', '#' + section);
    renderTabs();
    const active = $('tabs').querySelector('[aria-current="page"]');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    if (section === 'today') renderToday();
    else if (section === 'scout') renderScout();
    else if (section === 'social') renderSocial();
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
          ${tab !== 'Clients' ? '<button class="btn btn-accent" type="button" data-pitch>Pitch deck</button>' : ''}
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

  let aiLoading = null;
  const loadAi = () => {
    if (window.ScoutAI) return Promise.resolve(window.ScoutAI);
    if (!aiLoading) {
      aiLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'scout-ai.js?v=1';
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

  const openPitch = (tab, row, opener) => {
    const name = str(row, 'Business Name');
    const p = { stage: 'gathering', content: null, error: '', pptx: null, savedKey: '', drive: '' };

    const shell = (body, foot) => `
      <div class="drawer-head"><div class="grow"><p class="eyebrow">Pitch deck · ${esc(TABS[tab].title)}</p>
        <h2 id="drawer-title">${esc(name)}</h2></div>
        <button class="btn btn-outline icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;

    const paint = () => {
      if ($('drawer').hidden || !$('drawer').querySelector('[data-pitch-drawer]')) return;
      const drawer = $('drawer');
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
        </div>`, `<span class="status-text" data-drive>${esc(p.drive)}</span><button class="btn btn-outline" type="button" data-regen>Regenerate</button>`);
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
      if (regen) regen.onclick = generate;
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
      paint();
      try {
        const [AI, settings] = await Promise.all([loadAi(), aiSettings()]);
        const facts = AI.gatherFacts(row);
        p.stage = 'competitors'; paint();
        const enriched = await AI.withCompetitors(settings, facts);
        p.stage = 'writing'; paint();
        let offers = [];
        try {
          const social = await loadSocial();
          offers = (social.offers || []).filter((o) => isTrue(o.values.Active)).map((o) => String(o.values.Offer || '').trim()).filter(Boolean);
        } catch (e) { /* default offers are used */ }
        p.content = await AI.writePitch(settings, enriched, offers);
      } catch (error) {
        if (error instanceof SessionExpired) { handleError(error); return; }
        p.error = error.message;
      }
      paint();
    };

    openDrawer(shell('<div data-pitch-drawer></div>'), opener);
    $('drawer').classList.add('drawer-wide');
    generate();
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
      if (c && Array.isArray(c.messages)) return c;
    } catch (e) { /* fall back to a fresh sync */ }
    return { me: state.session.name, members: [], chats: [], messages: [], cursor: 0 };
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
      const data = await api('teamSync', { since: Math.max(0, state.chat.cursor - 2000), appVersion: 'web' });
      state.chat = { ...state.chat, me: data.me, members: data.members, chats: data.chats, cursor: data.cursor, messages: mergeMsgs(state.chat.messages, data.messages) };
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
    const summaries = chatSummaries();
    const open = state.openChat && summaries.find((c) => c.id === state.openChat);
    view.innerHTML = `<div class="chat-app${open ? ' has-open' : ''}">
      <aside class="chat-list" aria-label="Chats">
        <div class="chat-list-head"><h2>Chats</h2><button class="btn btn-accent btn-sm" type="button" data-new-group>New group</button></div>
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
      <div class="thread" role="log" aria-live="polite">${rows || '<div class="chat-empty"><p>No messages yet. Say hi, or type / for Scout.</p></div>'}${state.scoutThinking === open.id ? '<div class="bubble scout thinking">Scout is thinking…</div>' : ''}</div>
      <form class="composer" data-composer>
        <div class="cmd-menu" data-cmds hidden></div>
        ${lead ? `<div class="lead-chip">Sharing <b>${esc(lead.business)}</b> <button type="button" class="chip-x" data-unlink aria-label="Don't share the lead">✕</button></div>` : ''}
        <div class="composer-row"><button class="slash" type="button" data-slash aria-label="Commands">/</button>
        <textarea id="chat-input" rows="1" placeholder="Message · / for Scout" aria-label="Message">${esc(draft)}</textarea>
        <button class="btn btn-primary send" type="submit" aria-label="Send">➤</button></div>
      </form>`;
  };

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
    return `<div class="bubble-row ${mine ? 'mine' : 'theirs'}"><div class="bubble ${mine ? 'mine' : scout ? 'scout' : 'theirs'}">
      ${scout ? `<span class="who scout-who">✦ Scout${meta.for ? ' · for ' + esc(meta.for) : ''}</span>` : !mine && open.kind !== 'dm' ? `<span class="who" style="color:${avColor(m.from)}">${esc(m.from)}</span>` : ''}
      <p>${esc(m.message)}</p>
      ${m.leadTab && m.leadRow > 1 ? `<button class="lead-card" type="button" data-lead="${esc(m.leadTab)}|${m.leadRow}|${esc(m.business)}"><b>${esc(m.business)}</b><span>${esc((TABS[m.leadTab] || {}).title || m.leadTab)} · open</span></button>` : ''}
      ${actionHtml ? `<div class="actions-box">${actionHtml}</div>` : ''}
      <span class="stamp">${esc(new Date(m.sent).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))} ${mine ? ticks(m, open.members) : ''}</span>
    </div>${m.local === 'failed' ? `<button class="retry" type="button" data-retry-msg="${esc(m.id)}">Not sent · retry</button>` : ''}</div>`;
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
    input.oninput = () => { state.chatDraft = input.value; grow(); if (input.value.startsWith('/')) loadAi().then(showMenu).catch(() => {}); else menu.hidden = true; };
    input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); view.querySelector('[data-composer]').requestSubmit(); } };
    if (focused || state.openFresh) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    state.openFresh = false;
    if (input.value.startsWith('/')) loadAi().then(showMenu).catch(() => {});
    view.querySelector('[data-slash]').onclick = () => { input.value = input.value.startsWith('/') ? '' : '/'; state.chatDraft = input.value; input.focus(); loadAi().then(showMenu).catch(() => {}); };
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

  const submitChat = async (open, raw) => {
    const text = raw.trim();
    if (!text || state.scoutThinking) return;
    state.chatDraft = '';
    $('chat-input').value = '';
    const lead = state.shareLead;
    state.shareLead = null;
    const AI = await loadAi().catch(() => null);
    const parsed = AI ? AI.parseInput(text) : { kind: 'text' };
    postMessage(open.id, text, { lead }).catch(() => {});
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
          const answer = await AI.askAgent(settings, { me: state.chat.me, members: state.chat.members.filter((x) => normName(x) !== normName(state.chat.me)), tabs, social: state.social }, history, question, 'chat', recent);
          let msg = answer.say || 'Sorry, I did not get that.';
          if (answer.rejected.length && !answer.actions.length) msg = `Sorry: ${answer.rejected[0]}`;
          else if (answer.rejected.length) msg += `\n(I couldn't do one part: ${answer.rejected[0]})`;
          saved = await reply(msg, answer.actions, null, question);
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
      default:
        return;
    }
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

  // ---------- boot ----------

  state.session = loadSession();
  if (state.session) startApp();
  else showLogin();
})();
