/* Shared by every page. Each block only runs if its section is on the page. */
const $ = id => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wa = t => 'https://wa.me/918281696632?text=' + encodeURIComponent(t);

/* menu */
const menu = $('menu');
if (menu) {
  $('menu-open').addEventListener('click', () => menu.showModal());
  $('menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('click', e => { if (e.target === menu) menu.close(); });
}

/* "What does your business need?" picker (home) */
const needs = {
  ads:{title:'Ads people stop scrolling for',lead:'Reels, product films and posters for Instagram and WhatsApp, in English, Hindi or Punjabi.',list:['A month of reels and posters','Product and launch films','Festival and offer campaigns'],time:'First ads in 5 days',cta:'Ask about ads on WhatsApp',msg:'Hi Saffron Labs, I want ads for my business.'},
  web:{title:'A website that brings enquiries',lead:'A fast site that shows what you sell and where you are, and sends customers straight to WhatsApp.',list:['Business or catalogue website','Landing page for one offer','Domain, email and Google listing'],time:'1 to 2 weeks',cta:'Ask about a website on WhatsApp',msg:'Hi Saffron Labs, I need a website for my business.'},
  soft:{title:'Software that replaces the register',lead:'Screens built around how your staff already work, so orders, stock and bookings stop living on paper.',list:['Order intake and tracking','Staff and admin dashboards','Booking or inventory system'],time:'Prototype in about a week',cta:'Ask about software on WhatsApp',msg:'Hi Saffron Labs, I want software for my business.'},
  auto:{title:'Answers that send themselves',lead:'The questions and updates you type every day, handled on WhatsApp, email or your website.',list:['WhatsApp auto-replies and order updates','Website chat that captures leads','Reports that update themselves'],time:'3 to 10 days',cta:'Ask about automation on WhatsApp',msg:'Hi Saffron Labs, I want to automate messages for my business.'}
};
const tabs = [...document.querySelectorAll('#need .tab')];
if (tabs.length) {
  const show = k => {
    const n = needs[k];
    tabs.forEach(t => { const on = t.dataset.k === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on) $('answer').setAttribute('aria-labelledby', t.id); });
    $('a-title').textContent = n.title; $('a-lead').textContent = n.lead;
    $('a-list').replaceChildren(...n.list.map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));
    $('a-time').textContent = n.time; $('a-cta').textContent = n.cta; $('a-cta').href = wa(n.msg);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.k));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); show(next.dataset.k);
    });
  });
  show('ads');
}

/* videos: work loops load and play only while on screen; one switch pauses them all */
const reelVideo = document.querySelector('#reel video');
if (reelVideo && still) { reelVideo.removeAttribute('autoplay'); reelVideo.pause(); }
let videosOff = still;
const onScreen = new Set();
const motionBtn = $('motion-toggle');
const setVideos = off => {
  videosOff = off;
  if (motionBtn) { motionBtn.textContent = off ? 'Play videos' : 'Pause videos'; motionBtn.setAttribute('aria-pressed', String(off)); }
  document.querySelectorAll('video').forEach(v => {
    if (off) v.pause();
    else if (v === reelVideo || onScreen.has(v)) v.play().catch(() => {});
  });
};
if (motionBtn) { motionBtn.addEventListener('click', () => setVideos(!videosOff)); setVideos(videosOff); }
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const v = e.target;
  if (e.isIntersecting) {
    onScreen.add(v);
    if (!v.src) v.src = v.dataset.src;
    if (!videosOff) v.play().catch(() => {});
  } else { onScreen.delete(v); v.pause(); }
}), {threshold:0.35});
document.querySelectorAll('.frame video[data-src]').forEach(v => io.observe(v));

/* the showreel settles to full size as you scroll into it (home) */
const reel = $('reel');
if (reel && !still) {
  const fit = () => {
    const r = reel.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.25) / (innerHeight * 0.6)));
    reel.style.transform = `scale(${0.9 + 0.1 * p})`;
  };
  addEventListener('scroll', fit, {passive:true}); addEventListener('resize', fit); fit();
}

/* work tabs (work page) */
const wtabs = [...document.querySelectorAll('.wtab')];
const openWork = t => wtabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
wtabs.forEach((t, i) => {
  t.addEventListener('click', () => openWork(t));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = wtabs[(i + (e.key === 'ArrowRight' ? 1 : wtabs.length - 1)) % wtabs.length];
    n.focus(); openWork(n);
  });
});

/* order board demo */
document.querySelectorAll('.mark').forEach(b => b.addEventListener('click', () => {
  const row = b.closest('.row'); const st = row.querySelector('.st');
  st.textContent = 'Ready'; st.classList.add('ready'); b.textContent = 'Done'; b.disabled = true;
  $('board-note').textContent = `Ready. ${row.dataset.name} just got an SMS to collect the order.`;
}));

/* WhatsApp demo */
document.querySelectorAll('#chips button').forEach(b => b.addEventListener('click', () => {
  const chat = $('chat');
  const add = (text, cls) => { const p = document.createElement('p'); p.className = 'msg ' + cls; p.textContent = text; chat.append(p); chat.scrollTop = chat.scrollHeight; };
  add(b.dataset.q, 'me');
  setTimeout(() => add(b.dataset.a, 'bot'), still ? 0 : 600);
}));

/* lead capture demo */
const sendLead = $('send-lead');
if (sendLead) sendLead.addEventListener('click', () => {
  const ids = ['f1','f2','f3'];
  ids.forEach(id => $(id).classList.remove('on'));
  $('flow-note').textContent = 'Sending...';
  ids.forEach((id, i) => setTimeout(() => {
    $(id).classList.add('on');
    if (i === 2) $('flow-note').textContent = 'Done in under a second. The owner already has the lead on their phone.';
  }, still ? 0 : 500 * (i + 1)));
});

/* FAQ: each chip opens its answer in a side panel (FAQ page) */
const panel = $('faq-panel');
if (panel) {
  let lastChip = null;
  document.querySelectorAll('.chip[data-faq]').forEach(chip => chip.addEventListener('click', () => {
    const src = $('faq-' + chip.dataset.faq);
    $('faq-g').textContent = src.dataset.group;
    $('faq-q').textContent = src.querySelector('h4').textContent;
    $('faq-body').replaceChildren(...[...src.querySelectorAll('p')].map(p => p.cloneNode(true)));
    lastChip = chip; chip.setAttribute('aria-expanded', 'true');
    panel.showModal();
  }));
  $('faq-close').addEventListener('click', () => panel.close());
  panel.addEventListener('click', e => { if (e.target === panel) panel.close(); });
  panel.addEventListener('close', () => { if (lastChip) lastChip.setAttribute('aria-expanded', 'false'); });
}
