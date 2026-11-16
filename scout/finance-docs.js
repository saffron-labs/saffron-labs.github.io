/* Printable finance documents for Scout on the web: receipts, proposals, invoices and client statements.
   A port of the app's src/finance/pdf.ts, so a PDF made here looks the same as one made on the phone.
   Each function returns a complete A4 HTML page; Scout shows it in a frame and prints it ("Save as PDF"). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof qrcode !== 'undefined' ? qrcode : require('qrcode-generator'));
  else root.ScoutDocs = factory(root.qrcode);
})(typeof self !== 'undefined' ? self : this, function (qrcode) {
  'use strict';

  const CONTACT = { whatsapp: '+91 82816 96632', email: 'hello@saffronlabs.in', website: 'saffronlabs.in' };
  const DEFAULT_TAGLINE = 'Websites, apps and creative for growing businesses';

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const multiline = (value) => esc(value).replace(/\r?\n/g, '<br>');
  const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);

  const group = (whole) => {
    if (whole.length <= 3) return whole;
    return whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + whole.slice(-3);
  };
  // ₹1,23,456 — paise only appear when there are some.
  const inr = (paise) => {
    const abs = Math.abs(Math.round(paise));
    const rem = abs % 100;
    const text = '₹' + group(String(Math.floor(abs / 100))) + (rem ? '.' + String(rem).padStart(2, '0') : '');
    return paise < 0 ? '−' + text : text;
  };

  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
  const below1000 = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '') : below100(n));
  const amountInWords = (paise) => {
    const abs = Math.abs(Math.round(paise));
    let whole = Math.floor(abs / 100);
    const ps = abs % 100;
    if (whole === 0 && ps === 0) return 'Rupees Zero Only';
    const parts = [];
    const crore = Math.floor(whole / 1e7); whole %= 1e7;
    const lakh = Math.floor(whole / 1e5); whole %= 1e5;
    const thousand = Math.floor(whole / 1e3); whole %= 1e3;
    if (crore) parts.push(below1000(crore) + ' Crore');
    if (lakh) parts.push(below100(lakh) + ' Lakh');
    if (thousand) parts.push(below100(thousand) + ' Thousand');
    if (whole) parts.push(below1000(whole));
    return 'Rupees ' + (parts.join(' ') || 'Zero') + (ps ? ' and ' + below100(ps) + ' Paise' : '') + ' Only';
  };

  const longDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const shortDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : iso || '';
  };

  const LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#C9A227" stroke-width="3.4" stroke-linecap="round">
    <path d="M50 86 Q41.5 47.5 21.5 22.1"/><path d="M50 86 Q50 47.5 50 16"/><path d="M50 86 Q58.5 47.5 78.5 22.1"/>
  </g>
  <g fill="#C9A227"><circle cx="21.5" cy="22.1" r="5.6"/><circle cx="50" cy="16" r="5.6"/><circle cx="78.5" cy="22.1" r="5.6"/><circle cx="50" cy="86" r="3.8"/></g>
</svg>`;

  const qrSvg = (data) => {
    const code = qrcode(0, 'M');
    code.addData(data);
    code.make();
    return code.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  };

  const company = (s) => ({
    name: s.companyName || 'Saffron Labs',
    tagline: s.tagline || DEFAULT_TAGLINE,
    address: s.address,
    phone: s.phone || CONTACT.whatsapp,
    email: s.email || CONTACT.email,
    website: s.website || CONTACT.website,
    gstin: s.gstin,
    pan: s.pan,
    signatory: s.signatory,
  });

  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #141414; font-size: 12.5px; line-height: 1.5; font-feature-settings: 'tnum' 1, 'lnum' 1; -webkit-font-smoothing: antialiased; }
.page { position: relative; width: 794px; min-height: 1123px; padding: 50px 58px 44px; overflow: hidden; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.brand { display: flex; gap: 18px; align-items: center; }
.logo { width: 62px; height: 62px; background: #35120E; border-radius: 3px; padding: 9px; flex: none; }
.logo svg { width: 100%; height: 100%; display: block; }
.co-name { font-size: 24px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.15; }
.co-tag { font-size: 12px; color: #6B6B6B; margin-top: 5px; max-width: 300px; }
.meta { display: table; }
.meta .row { display: table-row; }
.meta .k, .meta .v { display: table-cell; padding: 2.5px 0; vertical-align: baseline; }
.meta .k { font-size: 10px; letter-spacing: 1.3px; text-transform: uppercase; color: #777; padding-right: 22px; text-align: right; }
.meta .v { font-size: 12.5px; font-weight: 600; }
.rule { height: 1px; background: #E4E2DE; margin: 26px 0 30px; }
.titlerow { display: flex; align-items: center; gap: 14px; }
h1 { margin: 0; font-size: 35px; line-height: 1.1; font-weight: 700; letter-spacing: -1px; }
.subtitle { margin-top: 8px; font-size: 15.5px; color: #6B6B6B; }
.tag { font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; margin-top: 4px; }
.tag.paid { color: #1F6B3A; background: #E3F1E8; }
.tag.void { color: #A4261E; background: #FAE4E1; }
.cards { display: flex; gap: 16px; margin-top: 26px; }
.card { flex: 1; background: #F4F3F0; padding: 17px 20px 18px; }
.label { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #6B6B6B; margin-bottom: 8px; }
.card .name { font-size: 15px; font-weight: 600; }
.card .line { font-size: 12.5px; color: #3A3A3A; margin-top: 1px; }
.banner { margin-top: 18px; background: #141414; border-top: 4px solid #C9731C; padding: 22px 26px 24px; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.banner .bl { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #B9B9B9; }
.banner .bh { margin-top: 6px; font-size: 19px; font-weight: 700; color: #fff; }
.banner .bp { margin-top: 6px; font-size: 12.5px; color: #CFCFCF; max-width: 380px; line-height: 1.5; }
.banner .amt { font-size: 44px; font-weight: 700; letter-spacing: -1.2px; color: #F0A23B; white-space: nowrap; }
.banner.off { border-top-color: #8A8A8A; background: #3C3C3C; }
.banner.off .amt { color: #BDBDBD; text-decoration: line-through; }
.words { margin-top: 10px; font-size: 12px; font-style: italic; color: #6B6B6B; }
h2 { margin: 32px 0 12px; font-size: 19px; line-height: 1.2; font-weight: 700; letter-spacing: -0.3px; }
.kv { background: #F4F3F0; padding: 8px 20px; }
.kv .r { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid #E4E2DE; }
.kv .r:first-child { border-top: none; }
.kv .k { width: 34%; color: #6B6B6B; }
.kv .v { flex: 1; font-weight: 600; }
.pay { display: flex; gap: 16px; align-items: stretch; }
.pay .opt { flex: 1; background: #F4F3F0; padding: 17px 20px; }
.pay .row { display: flex; gap: 14px; padding: 3px 0; }
.pay .row .k { width: 40%; color: #6B6B6B; }
.pay .row .v { flex: 1; font-weight: 600; word-break: break-all; }
.pay .hint { margin-top: 8px; font-size: 11.5px; color: #6B6B6B; }
.qrbox { flex: none; width: 138px; background: #fff; border: 1px solid #E4E2DE; padding: 12px 12px 8px; text-align: center; }
.qrbox svg { width: 100%; height: auto; display: block; }
.qrbox .cap { margin-top: 6px; font-size: 8.5px; color: #777; word-break: break-all; }
.para { margin-top: 16px; font-size: 12.5px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 10px; letter-spacing: 1.3px; text-transform: uppercase; color: #6B6B6B; font-weight: 400; padding: 0 0 9px; border-bottom: 1px solid #141414; }
td { padding: 12px 0; border-bottom: 1px solid #E4E2DE; vertical-align: top; }
tr { page-break-inside: avoid; }
td.r, th.r { text-align: right; }
td.b { font-weight: 600; }
td .sub { color: #6B6B6B; font-size: 11.5px; margin-top: 2px; font-weight: 400; }
tr.sum td { background: #F4F3F0; color: #555; font-weight: 600; padding: 12px 10px; border-bottom: none; }
tr.plain td { padding: 7px 0; border-bottom: none; color: #3A3A3A; }
tr.grand td { padding: 13px 10px; background: #F4F3F0; font-size: 14px; font-weight: 700; color: #141414; border-bottom: none; }
tr.grand td:first-child, tr.sum td:first-child { padding-left: 10px; }
.small td, .small th { font-size: 11.5px; }
.small td { padding: 9px 6px 9px 0; }
.kpis { display: flex; gap: 12px; margin-top: 24px; }
.kpis .card { padding: 14px 16px; }
.kpis .card .label { margin-bottom: 5px; }
.kpis .v { font-size: 18px; font-weight: 700; letter-spacing: -0.4px; }
.in { color: #1F6B3A; } .out { color: #A4261E; }
.pill { display: inline-block; padding: 0 7px; border-radius: 3px; font-size: 10px; font-weight: 600; background: #EDE9DF; color: #5B4A1F; }
.accept { display: flex; gap: 40px; margin-top: 46px; }
.accept div { flex: 1; border-top: 1px solid #141414; padding-top: 7px; font-size: 11.5px; color: #6B6B6B; }
.foot { margin-top: 44px; padding-top: 12px; border-top: 1px solid #E4E2DE; display: flex; justify-content: space-between; gap: 16px; font-size: 10.5px; color: #777; }
.watermark { position: absolute; top: 440px; left: 0; right: 0; text-align: center; font-size: 120px; font-weight: 700; color: rgba(164,38,30,0.07); transform: rotate(-24deg); letter-spacing: 10px; pointer-events: none; }
`;

  const shell = (s, o) => {
    const c = company(s);
    const meta = (o.meta || [])
      .filter(([, value]) => value)
      .map(([k, v]) => `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794"><title>${esc(o.docTitle || o.title)}</title><style>${CSS}</style></head><body><div class="page">
${o.watermark ? `<div class="watermark">${esc(o.watermark)}</div>` : ''}
<div class="head">
  <div class="brand"><div class="logo">${LOGO_SVG}</div><div><div class="co-name">${esc(c.name)}</div><div class="co-tag">${esc(c.tagline)}</div></div></div>
  <div class="meta">${meta}</div>
</div>
<div class="rule"></div>
<div class="titlerow"><h1>${esc(o.title)}</h1>${o.tag ? `<span class="tag ${o.tag.tone}">${esc(o.tag.text)}</span>` : ''}</div>
${o.subtitle ? `<div class="subtitle">${esc(o.subtitle)}</div>` : ''}
${o.body}
<div class="foot"><span>${esc(o.footLeft)}</span><span>${esc(o.footRight || '')}</span></div>
</div></body></html>`;
  };

  const fromCard = (s) => {
    const c = company(s);
    const lines = [
      c.signatory,
      c.address,
      [c.phone, c.email].filter(Boolean).join(' · '),
      c.website,
      [c.gstin && 'GSTIN ' + c.gstin, c.pan && 'PAN ' + c.pan].filter(Boolean).join(' · '),
    ].filter(Boolean);
    return `<div class="card"><div class="label">From</div><div class="name">${esc(c.name)}</div>${lines.map((l) => `<div class="line">${multiline(l)}</div>`).join('')}</div>`;
  };

  const clientCard = (doc, label) => {
    const m = doc.meta || {};
    const lines = [m.clientAddress, [m.clientPhone, m.clientEmail].filter(Boolean).join(' · '), m.clientGstin && 'GSTIN ' + m.clientGstin].filter(Boolean);
    return `<div class="card"><div class="label">${esc(label)}</div><div class="name">${esc(doc.client)}</div>${lines.map((l) => `<div class="line">${multiline(l)}</div>`).join('')}</div>`;
  };

  const banner = (label, heading, text, amount, off) => `
<div class="banner${off ? ' off' : ''}">
  <div><div class="bl">${esc(label)}</div><div class="bh">${esc(heading)}</div>${text ? `<div class="bp">${multiline(text)}</div>` : ''}</div>
  <div class="amt">${esc(inr(amount))}</div>
</div>`;

  const itemsTable = (doc) => `
<table>
  <thead><tr><th>Item</th><th class="r" style="width:8%">Qty</th><th class="r" style="width:18%">Rate</th><th class="r" style="width:20%">Amount</th></tr></thead>
  <tbody>
    ${doc.items
      .map(
        (it) => `<tr>
      <td class="b">${esc(it.description)}${it.detail ? `<div class="sub">${multiline(it.detail)}</div>` : ''}</td>
      <td class="r">${esc(it.qty)}</td>
      <td class="r">${esc(inr(toPaise(it.rate)))}</td>
      <td class="r b">${esc(inr(toPaise(it.amount)))}</td></tr>`,
      )
      .join('')}
    <tr class="plain"><td></td><td></td><td class="r">Subtotal</td><td class="r">${esc(inr(toPaise(doc.subtotal)))}</td></tr>
    ${doc.discount > 0 ? `<tr class="plain"><td></td><td></td><td class="r">Discount</td><td class="r">−${esc(inr(toPaise(doc.discount)))}</td></tr>` : ''}
    ${doc.taxPercent > 0 ? `<tr class="plain"><td></td><td></td><td class="r">GST (${esc(doc.taxPercent)}%)</td><td class="r">${esc(inr(toPaise(doc.tax)))}</td></tr>` : ''}
    <tr class="grand"><td colspan="3">Total</td><td class="r">${esc(inr(toPaise(doc.total)))}</td></tr>
  </tbody>
</table>`;

  const textBlock = (heading, value) => (value ? `<h2>${esc(heading)}</h2><div class="para" style="margin-top:0">${multiline(value)}</div>` : '');

  const kvRows = (rows) => `<div class="kv">${rows.filter((r) => r[1]).map(([k, v]) => `<div class="r"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;

  const docStatusTag = (doc) => (doc.status === 'Cancelled' ? { text: 'Cancelled', tone: 'void' } : doc.status === 'Paid' ? { text: 'Paid', tone: 'paid' } : undefined);
  const cancelled = (doc) => (doc.status === 'Cancelled' ? 'CANCELLED' : '');

  const receiptHtml = (doc, s) => {
    const total = toPaise(doc.total);
    const m = doc.meta || {};
    const c = company(s);
    const off = doc.status === 'Cancelled';
    const against = m.against || (doc.items[0] && doc.items[0].description) || doc.title;
    const summary =
      m.dealValue && m.dealValue > 0
        ? `<h2>Account summary</h2>
         <table>
           <thead><tr><th>Item</th><th class="r">Amount</th></tr></thead>
           <tbody>
             <tr><td class="b">Agreed project value</td><td class="r b">${esc(inr(toPaise(m.dealValue)))}</td></tr>
             <tr><td class="b">Received to date, including this payment</td><td class="r b">${esc(inr(toPaise(m.receivedTotal || 0)))}</td></tr>
             <tr class="sum"><td>Balance remaining</td><td class="r">${esc(inr(toPaise(m.balanceAfter || 0)))}</td></tr>
           </tbody>
         </table>`
        : '';
    return shell(s, {
      docTitle: `Receipt ${doc.number}`,
      title: 'Payment receipt',
      subtitle: `Received with thanks from ${doc.client}`,
      meta: [['Receipt no.', doc.number], ['Date', longDate(doc.date)], ['Reference', m.reference || '']],
      tag: docStatusTag(doc),
      body: `
    <div class="cards">${fromCard(s)}${clientCard(doc, 'Received from')}</div>
    ${banner('Amount received', doc.title || 'Payment received', [against, m.method ? `Paid by ${m.method}` : ''].filter(Boolean).join('\n'), total, off)}
    <div class="words">${esc(amountInWords(total))}</div>
    <h2>Payment details</h2>
    ${kvRows([['Payment for', against], ['Payment method', m.method || ''], ['Reference / UTR', m.reference || ''], ['Date received', longDate(doc.date)]])}
    ${summary}
    ${textBlock('Note', doc.notes)}`,
      footLeft: `${c.name} · Receipt ${doc.number} · ${doc.client}`,
      footRight: 'Computer-generated receipt',
      watermark: cancelled(doc),
    });
  };

  const proposalHtml = (doc, s) => {
    const m = doc.meta || {};
    const c = company(s);
    const lead = [m.timeline ? `Timeline: ${m.timeline}` : '', !s.gstin && doc.taxPercent === 0 ? 'No GST is added.' : ''].filter(Boolean).join('\n');
    const plan = m.paymentPlan
      ? `<h2>Payment schedule</h2><div class="kv">${m.paymentPlan
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => `<div class="r"><div class="v" style="font-weight:400">${esc(l.trim())}</div></div>`)
          .join('')}</div>`
      : '';
    return shell(s, {
      docTitle: `Proposal ${doc.number}`,
      title: 'Proposal',
      subtitle: doc.title,
      meta: [['Proposal no.', doc.number], ['Date', longDate(doc.date)], ['Valid until', longDate(doc.validUntil)]],
      tag: docStatusTag(doc),
      body: `
    <div class="cards">${fromCard(s)}${clientCard(doc, 'Prepared for')}</div>
    ${banner('Project total', doc.title, lead, toPaise(doc.total), doc.status === 'Cancelled')}
    <div class="words">${esc(amountInWords(toPaise(doc.total)))}</div>
    ${textBlock('Scope of work', m.scope || '')}
    <h2>What is included</h2>
    ${itemsTable(doc)}
    ${plan}
    ${textBlock('Terms', doc.terms)}
    ${textBlock('Notes', doc.notes)}
    <div class="accept"><div>Accepted by (client) · Date</div><div>For ${esc(c.name)}${c.signatory ? ` · ${esc(c.signatory)}` : ''}</div></div>`,
      footLeft: `${c.name} · Proposal ${doc.number} · ${doc.client}`,
      footRight: s.footer || '',
      watermark: cancelled(doc),
    });
  };

  const upiLink = (s, amount, note) =>
    `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.bankHolder || s.companyName || 'Saffron Labs')}&am=${(amount / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

  const howToPay = (s, amount, reference) => {
    const payee = s.bankHolder || company(s).name;
    const hasBank = Boolean(s.bankAccount || s.bankIfsc || s.bankName);
    if (!s.upiId && !hasBank) return '';
    const row = (k, v) => (v ? `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '');
    return `<h2>How to pay</h2>
  <div class="pay">
    ${s.upiId ? `<div class="opt"><div class="label">Option 1 · UPI</div>${row('UPI ID', s.upiId)}${row('Payee name', payee)}<div class="hint">Scan the QR code with any UPI app, or enter the UPI ID.</div></div>` : ''}
    ${hasBank ? `<div class="opt"><div class="label">${s.upiId ? 'Option 2 · ' : ''}Bank transfer</div>${row('Name', payee)}${row('Account no.', s.bankAccount)}${row('Bank', s.bankName)}${row('IFSC', s.bankIfsc)}</div>` : ''}
    ${s.upiId ? `<div class="qrbox">${qrSvg(upiLink(s, amount, reference))}<div class="cap">UPI ID: ${esc(s.upiId)}</div></div>` : ''}
  </div>
  <div class="para">Please add <b>${esc(reference)}</b> as the payment note or reference, check the payee name shows <b>${esc(payee)}</b>, and share the transaction ID or a screenshot with us. We will send a receipt the same day.</div>`;
  };

  const invoiceHtml = (doc, s) => {
    const total = toPaise(doc.total);
    const c = company(s);
    const settled = doc.status === 'Paid';
    const off = doc.status === 'Cancelled';
    return shell(s, {
      docTitle: `Invoice ${doc.number}`,
      title: 'Invoice',
      subtitle: doc.title,
      meta: [['Invoice no.', doc.number], ['Date', longDate(doc.date)], ['Due', longDate(doc.validUntil)]],
      tag: docStatusTag(doc),
      body: `
    <div class="cards">${fromCard(s)}${clientCard(doc, 'Billed to')}</div>
    ${banner(settled ? 'Amount paid' : 'Amount due now', doc.title, [doc.validUntil && !settled ? `Due by ${longDate(doc.validUntil)}.` : '', !s.gstin && doc.taxPercent === 0 ? 'No GST is added.' : ''].filter(Boolean).join('\n'), total, off)}
    <div class="words">${esc(amountInWords(total))}</div>
    <h2>Invoice details</h2>
    ${itemsTable(doc)}
    ${settled || off ? '' : howToPay(s, total, doc.number)}
    ${textBlock('Terms', doc.terms)}
    ${textBlock('Notes', doc.notes)}`,
      footLeft: `${c.name} · Invoice ${doc.number} · ${doc.client}`,
      footRight: s.footer || '',
      watermark: cancelled(doc),
    });
  };

  const docHtml = (doc, s) => (doc.type === 'Receipt' ? receiptHtml(doc, s) : doc.type === 'Proposal' ? proposalHtml(doc, s) : invoiceHtml(doc, s));

  const IN_TYPES = ['Advance', 'Payment', 'Other income', 'Capital in'];

  const entryRows = (entries, balances) =>
    entries
      .map((e) => {
        const inflow = IN_TYPES.includes(e.type);
        const value = inr(toPaise(e.amount));
        return `<tr style="${e.voided ? 'opacity:.45;text-decoration:line-through' : ''}">
        <td>${esc(shortDate(e.date))}</td>
        <td>${esc(e.type)}${e.status === 'Pending' ? ' <span class="pill">pending</span>' : ''}${e.voided ? ' <span class="pill">void</span>' : ''}</td>
        <td>${esc([e.client, e.description || e.category].filter(Boolean).join(' · '))}${e.reference ? `<div class="sub">${esc(e.reference)}</div>` : ''}</td>
        <td>${esc(e.method)}</td>
        <td class="r b ${inflow ? 'in' : 'out'}">${inflow ? '' : '−'}${esc(value)}</td>
        ${balances ? `<td class="r">${balances.has(e.id) ? esc(inr(balances.get(e.id))) : ''}</td>` : ''}
      </tr>`;
      })
      .join('');

  // book: { name, deal, advance, received, balance } in paise, plus entries (the client's ledger rows).
  const statementHtml = (book, s, today) => {
    const c = company(s);
    const ordered = [...book.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0)));
    const balances = new Map();
    let running = 0;
    ordered.forEach((e) => {
      if (e.voided || e.status === 'Pending') return;
      if (e.type === 'Advance' || e.type === 'Payment') running += toPaise(e.amount);
      else if (e.type === 'Refund') running -= toPaise(e.amount);
      balances.set(e.id, running);
    });
    const kpi = (label, value, tone) => `<div class="card"><div class="label">${esc(label)}</div><div class="v ${tone || ''}">${esc(value)}</div></div>`;
    return shell(s, {
      docTitle: `Statement ${book.name}`,
      title: 'Account statement',
      subtitle: book.name,
      meta: [['Date', longDate(today)]],
      body: `
    <div class="kpis">
      ${kpi('Agreed value', book.deal ? inr(book.deal) : '—')}
      ${kpi('Advance received', inr(book.advance))}
      ${kpi('Total received', inr(book.received), 'in')}
      ${kpi('Balance due', book.deal ? inr(book.balance) : '—', book.balance > 0 ? 'out' : 'in')}
    </div>
    <h2>Transactions</h2>
    <table class="small">
      <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Method</th><th class="r">Amount</th><th class="r">Received so far</th></tr></thead>
      <tbody>${entryRows(ordered, balances)}</tbody>
    </table>`,
      footLeft: `${c.name} · Statement of account · ${book.name}`,
      footRight: 'Pending entries are not counted',
    });
  };

  return { docHtml, receiptHtml, proposalHtml, invoiceHtml, statementHtml, amountInWords, inr, toPaise };
});
