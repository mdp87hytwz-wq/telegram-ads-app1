// ---------- Simple state ----------
const state = {
  route: 'dashboard',
  user: null,
  ads: [],
  channels: [],
  selectedChannels: new Set(),
  country: 'Iran',
  targetType: 'channels',
  plan: 'normal',
  dailyViewLimit: 1,
  viewCount: '',
  price: 0,
  budget: { balance: 0, transactions: [] },
  leaderboard: [],
  mediaFile: null
};

const app = document.getElementById('app');

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- Icons ----------
const ICON = {
  megaphone: `<svg viewBox="0 0 24 24" fill="white"><path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zm13.5 1a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12zM14 3.23v1.06A6.5 6.5 0 0118.5 12 6.5 6.5 0 0114 18.71v1.06A8 8 0 0020 12a8 8 0 00-6-8.77z"/></svg>`,
  friends: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.6"/><path d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5"/><path d="M13 19c0-2.3 1.6-4.2 3.7-4.8"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19V11"/><path d="M12 19V5"/><path d="M19 19v-7"/></svg>`
};

// ---------- API bootstrapping ----------
async function bootstrap() {
  try {
    const me = await Api.get('/api/me');
    state.user = me.user;
  } catch (e) {
    console.error('Auth failed', e);
    toast('Could not verify Telegram session — running in limited mode', true);
  }
  await loadAds();
  render();
}

async function loadAds() {
  try {
    const r = await Api.get('/api/ads');
    state.ads = r.ads;
  } catch (e) { console.error(e); }
}

async function loadChannels() {
  try {
    const r = await Api.get('/api/channels', { country: state.country });
    state.channels = r.channels;
  } catch (e) { console.error(e); }
}

async function loadBudget() {
  try {
    state.budget = await Api.get('/api/budget');
  } catch (e) { console.error(e); }
}

async function loadLeaderboard() {
  try {
    const r = await Api.get('/api/leaderboard');
    state.leaderboard = r.leaderboard;
  } catch (e) { console.error(e); }
}

// ---------- Router ----------
function go(route) {
  state.route = route;
  render();
}

function render() {
  let html = '';
  if (state.route === 'dashboard') html = viewDashboard();
  else if (state.route === 'createAd') html = viewCreateAd();
  else if (state.route === 'budget') html = viewBudget();
  else if (state.route === 'leaderboard') html = viewLeaderboard();
  else if (state.route === 'friends') html = viewFriends();

  app.innerHTML = html + bottomNav();
  attachHandlers();
}

// ---------- Top bar ----------
function topBar(showBack) {
  const photo = state.user?.photoUrl || '';
  return `
    <div class="topbar">
      ${showBack
        ? `<button class="back-btn" id="btn-back">&larr; Back</button>`
        : `<div class="brand">☰ Telegram Ads</div>`}
      <div style="display:flex;align-items:center;gap:10px;">
        ${photo ? `<img class="avatar" src="${photo}" />` : `<div class="avatar" style="background:#ffd23f;"></div>`}
      </div>
    </div>`;
}

// ---------- Dashboard ----------
function viewDashboard() {
  if (!state.ads.length) {
    return `
      ${topBar(false)}
      <div class="empty-state">
        <div class="empty-icon">${ICON.megaphone}</div>
        <h2>You have no ads yet...</h2>
        <p>Create your first ad.</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="btn-new-ad">Create a new ad</button>
          <button class="btn btn-secondary" id="btn-manage-budget">Manage budget</button>
        </div>
      </div>`;
  }
  return `
    ${topBar(false)}
    <div class="section">
      <button class="btn btn-primary btn-block" id="btn-new-ad" style="margin-bottom:16px;">+ Create a new ad</button>
      ${state.ads.map(ad => `
        <div class="card" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(ad.title)}</strong>
            <span style="color:var(--green);font-size:12px;font-weight:700;text-transform:uppercase;">${ad.status}</span>
          </div>
          <p style="color:var(--text-muted);font-size:14px;margin:8px 0;">${escapeHtml(ad.text)}</p>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);">
            <span>Views: ${ad.viewCount}</span>
            <span>Plan: ${ad.plan.replace(/_/g, ' ')}</span>
            <span>${ad.price.toLocaleString()} Toman</span>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ---------- Create Ad ----------
const PLANS = [
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
  { id: 'ultra_fast', label: 'Ultra fast' },
  { id: 'ultra_fast_pro', label: 'Ultra fast pro' },
  { id: 'ultra_fast_pro_max', label: 'Ultra fast pro max' }
];

function viewCreateAd() {
  if (!state.channels.length) loadChannels().then(render);

  return `
    ${topBar(true)}
    <div class="section">
      <h2 style="margin:6px 0 18px;">Create Your Ad</h2>

      <div class="field">
        <label>Ad Title</label>
        <input type="text" id="f-title" placeholder="Ex. My First Ad" />
      </div>

      <div class="field">
        <label>Ad Text <span>🙂</span></label>
        <textarea id="f-text" placeholder="Write something people will want to tap on"></textarea>
        <div style="text-align:right;margin-top:6px;"><a class="hint-link" href="#" id="btn-ai-text">Text generation with Ai ⚡</a></div>
      </div>

      <div class="field">
        <label>URL you want to promote</label>
        <input type="url" id="f-url" placeholder="t.me/......" />
      </div>

      <div class="field">
        <label>Ad photo or video</label>
        <input type="file" id="f-media" accept="image/*,video/*" style="display:none;" />
        <button class="upload-btn" id="btn-upload">🖼️ Upload Photo or Video</button>
        <div class="upload-row">
          <button class="btn" id="btn-edit-image">✨ Edit Image <span class="badge-new">new</span></button>
          <button class="btn" id="btn-generate-image">💬 Generate image <span class="badge-new">new</span></button>
        </div>
        <div id="media-preview"></div>
      </div>

      <div class="tabs">
        <strong>Target :</strong>
        <span data-target="search">Search</span>
        <span data-target="bots">Bots</span>
        <span class="pill" data-target="channels">Channels</span>
      </div>

      <div class="field">
        <label>Target specific channels</label>
        <input type="text" id="f-channel-url" placeholder="t.me channel URL" />
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong>Suggested channels</strong>
          <div class="country-pill">▾ ${state.country} 🇮🇷</div>
        </div>
        <div style="display:flex;gap:18px;margin-bottom:10px;font-size:14px;">
          <span style="color:var(--text-muted);">Admin suggestion</span>
          <span class="pill" style="font-size:13px;padding:6px 16px;">tech</span>
          <span style="color:var(--tg-blue);font-weight:600;">crypto</span>
        </div>
        ${state.channels.map(c => `
          <div class="channel-row">
            <div class="checkbox ${state.selectedChannels.has(c.id) ? 'checked' : ''}" data-channel="${c.id}"></div>
            <div class="channel-avatar"></div>
            <div class="channel-meta">
              <div class="name">${escapeHtml(c.name)}</div>
              <div class="sub">members: ${c.members.toLocaleString()}</div>
              <div class="sub">${c.username}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <h3 style="margin:20px 0 10px;">Preview</h3>
      <div class="preview-banner" id="preview-banner">Fill the required fields to preview your ad</div>

      <div class="notice">
        <span class="dot dot-red">!</span>
        <span>Will not be shown anywhere.</span>
      </div>
      <div class="notice">
        <span class="dot dot-red">!</span>
        <span>Will not be shown for users in the following countries: <strong>Russian Federation, Ukraine, Israel and Palestine</strong></span>
      </div>
      <div class="notice">
        <span class="dot dot-orange">!</span>
        <span><strong>Target parameters</strong> can't be changed after the ad is created.</span>
      </div>

      <div class="field" style="margin-top:14px;">
        <label>Daily views limit per user</label>
        <div style="display:flex;gap:8px;">
          ${[1, 2, 3, 4].map(n => `
            <button class="btn ${state.dailyViewLimit === n ? 'btn-primary' : 'btn-secondary'}" style="flex:1;" data-daily="${n}">${n}</button>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label>View Count</label>
        <input type="number" id="f-views" placeholder="e.g 1000" value="${state.viewCount}" />
        <p style="color:var(--text-muted);font-size:13px;margin-top:6px;">By entering the number, the price is calculated.</p>
      </div>

      <div class="field">
        <label>Plan</label>
        ${PLANS.map(p => `
          <div class="radio-row" data-plan="${p.id}">
            <div class="radio ${state.plan === p.id ? 'checked' : ''}"></div>
            <span>${p.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
        <span>Estimated price</span>
        <strong id="price-display">${state.price.toLocaleString()} Toman</strong>
      </div>

      <button class="btn btn-primary btn-block" id="btn-submit-ad">Create Ad</button>
    </div>`;
}

// ---------- Budget ----------
function viewBudget() {
  if (!state.budget.transactions.length && state.budget.balance === 0) loadBudget().then(render);

  const methods = [
    { id: 'ton', icon: '💎', label: 'Pay with TON' }
  ];

  return `
    ${topBar(true)}
    <div class="section">
      <div class="balance-row">
        <div>Balance : <span class="amount">${state.budget.balance.toLocaleString()} Toman</span></div>
        <button class="btn btn-primary" id="btn-transmit">Transmit</button>
      </div>

      <div class="field">
        <label>Add to your budget :</label>
        <input type="number" id="f-amount" placeholder="10000" />
      </div>

      <label style="font-weight:700;font-size:14px;">Payment method :</label>
      <div style="margin-top:10px;">
        ${methods.map(m => `
          <div class="pay-method" data-method="${m.id}">
            <span class="pay-icon">${m.icon}</span>
            <span>${m.label}</span>
            ${m.fee ? `<span class="fee">${m.fee}</span>` : ''}
          </div>
        `).join('')}
      </div>

      <table class="tx-table">
        <thead><tr><th>#</th><th>Amount</th><th>Type</th><th>Date</th><th>Action</th></tr></thead>
        <tbody>
          ${state.budget.transactions.map((t, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${t.amount.toLocaleString()}</td>
              <td>${t.type}</td>
              <td>${new Date(t.createdAt).toLocaleDateString()}</td>
              <td>${t.status}</td>
            </tr>
          `).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px;">No transactions yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ---------- Leaderboard ----------
function viewLeaderboard() {
  if (!state.leaderboard.length) loadLeaderboard().then(render);
  return `
    ${topBar(false)}
    <div class="section">
      <h2 style="margin:6px 0 18px;">Leaderboard</h2>
      ${state.leaderboard.length ? state.leaderboard.map((u, i) => `
        <div class="leaderboard-row">
          <div class="rank">#${i + 1}</div>
          <div class="channel-avatar"></div>
          <div class="channel-meta" style="flex:1;">
            <div class="name">${escapeHtml(u.name)}</div>
            <div class="sub">${u.adsCount} ads</div>
          </div>
          <strong>${u.totalSpent.toLocaleString()} Toman</strong>
        </div>
      `).join('') : `<div class="empty-small">No activity yet — be the first to spend on an ad!</div>`}
    </div>`;
}

// ---------- Friends ----------
function viewFriends() {
  return `
    ${topBar(false)}
    <div class="section">
      <h2 style="margin:6px 0 18px;">Friends</h2>
      <div class="card">
        <p style="margin:0 0 10px;">Invite friends and earn rewards when they create their first ad.</p>
        <button class="btn btn-primary btn-block" id="btn-copy-ref">Copy invite link</button>
      </div>
      <div class="empty-small">No friends joined yet.</div>
    </div>`;
}

// ---------- Bottom nav ----------
function bottomNav() {
  const items = [
    { id: 'friends', label: 'Friends', icon: ICON.friends },
    { id: 'dashboard', label: 'Dashboard', icon: ICON.home },
    { id: 'leaderboard', label: 'Leaderboard', icon: ICON.chart }
  ];
  return `
    <div class="bottom-nav">
      ${items.map(it => `
        <button class="nav-item ${state.route === it.id ? 'active' : ''}" data-nav="${it.id}">
          ${it.icon}
          <span>${it.label}</span>
          ${state.route === it.id ? '<div class="nav-underline"></div>' : ''}
        </button>
      `).join('')}
    </div>`;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshPrice() {
  const views = Number(state.viewCount) || 0;
  if (!views) { state.price = 0; return; }
  try {
    const r = await Api.post('/api/ads/price', { viewCount: views, plan: state.plan });
    state.price = r.price;
  } catch (e) { console.error(e); }
}

// ---------- Event wiring ----------
function attachHandlers() {
  document.getElementById('btn-back')?.addEventListener('click', () => go('dashboard'));
  document.getElementById('btn-new-ad')?.addEventListener('click', () => { state.viewCount = ''; state.price = 0; go('createAd'); });
  document.getElementById('btn-manage-budget')?.addEventListener('click', () => go('budget'));

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.nav));
  });

  // Create Ad screen
  document.getElementById('btn-upload')?.addEventListener('click', () => document.getElementById('f-media').click());
  document.getElementById('f-media')?.addEventListener('change', (e) => {
    state.mediaFile = e.target.files[0] || null;
    const prev = document.getElementById('media-preview');
    if (state.mediaFile && prev) {
      prev.innerHTML = `<p style="font-size:13px;color:var(--text-muted);margin-top:6px;">Selected: ${escapeHtml(state.mediaFile.name)}</p>`;
    }
  });
  document.getElementById('btn-ai-text')?.addEventListener('click', (e) => { e.preventDefault(); toast('Hook this up to your AI text-generation endpoint'); });
  document.getElementById('btn-edit-image')?.addEventListener('click', () => toast('Hook this up to your AI image-edit endpoint'));
  document.getElementById('btn-generate-image')?.addEventListener('click', () => toast('Hook this up to your AI image-generation endpoint'));

  document.querySelectorAll('[data-channel]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.channel;
      if (state.selectedChannels.has(id)) state.selectedChannels.delete(id); else state.selectedChannels.add(id);
      render();
    });
  });

  document.querySelectorAll('[data-daily]').forEach(el => {
    el.addEventListener('click', () => { state.dailyViewLimit = Number(el.dataset.daily); render(); });
  });

  document.querySelectorAll('[data-plan]').forEach(el => {
    el.addEventListener('click', async () => { state.plan = el.dataset.plan; await refreshPrice(); render(); });
  });

  document.getElementById('f-views')?.addEventListener('input', async (e) => {
    state.viewCount = e.target.value;
    await refreshPrice();
    const priceEl = document.getElementById('price-display');
    if (priceEl) priceEl.textContent = `${state.price.toLocaleString()} Toman`;
  });

  document.getElementById('btn-submit-ad')?.addEventListener('click', submitAd);

  // Budget screen
  document.getElementById('btn-transmit')?.addEventListener('click', () => toast('Transmit flow goes here (e.g. withdraw or transfer balance)'));
  document.querySelectorAll('[data-method]').forEach(el => {
    el.addEventListener('click', () => topUp(el.dataset.method));
  });

  // Friends
  document.getElementById('btn-copy-ref')?.addEventListener('click', async () => {
    try {
      const r = await Api.get('/api/friends');
      await navigator.clipboard.writeText(r.referralLink);
      toast('Invite link copied');
    } catch (e) { toast('Could not copy link', true); }
  });
}

async function submitAd() {
  const title = document.getElementById('f-title').value.trim();
  const text = document.getElementById('f-text').value.trim();
  const url = document.getElementById('f-url').value.trim();

  if (!title || !text || !url) {
    toast('Please fill in title, text and the promote URL', true);
    return;
  }

  const fd = new FormData();
  fd.append('title', title);
  fd.append('text', text);
  fd.append('promoteUrl', url);
  fd.append('targetType', state.targetType);
  fd.append('targetChannels', JSON.stringify([...state.selectedChannels]));
  fd.append('dailyViewLimit', state.dailyViewLimit);
  fd.append('viewCount', state.viewCount || 0);
  fd.append('plan', state.plan);
  if (state.mediaFile) fd.append('media', state.mediaFile);

  try {
    const r = await Api.postForm('/api/ads', fd);
    toast('Ad created successfully');
    state.ads.unshift(r.ad);
    state.selectedChannels = new Set();
    state.mediaFile = null;
    go('dashboard');
  } catch (e) {
    toast(e.error || 'Could not create ad', true);
  }
}

let tonConnectUI = null;

async function initTonConnect() {
  if (tonConnectUI) return;
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://mdp87hytwz-wq.github.io/telegram-ads-app1/frontend/tonconnect-manifest.json',
  });
}

async function topUp(method) {
  if (method !== 'ton') { toast('Only TON payment is supported', true); return; }
  const amount = Number(document.getElementById('f-amount').value);
  if (!amount || amount <= 0) { toast('Enter a valid amount first', true); return; }

  await initTonConnect();

  // TON amount (1 TON = 1e9 nanoTON)
  const nanoAmount = String(Math.floor(amount * 1e9));
  const MERCHANT = 'UQADuFF2Fy7NSrx36D9isoQ0CJx6dcX-0oxHkuRWyLxvng5N';

  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{ address: MERCHANT, amount: nanoAmount }]
  };

  try {
    toast('Opening TON wallet...');
    const result = await tonConnectUI.sendTransaction(tx);
    toast('Verifying payment...');
    const r = await Api.post('/api/budget/ton-verify', { amount, boc: result.boc });
    state.budget.balance = r.balance;
    toast('Payment successful! Balance updated.');
    render();
  } catch (e) {
    if (e?.message?.includes('User rejected')) {
      toast('Payment cancelled', true);
    } else {
      toast(e?.error || 'Payment failed', true);
    }
  }
}

bootstrap();
