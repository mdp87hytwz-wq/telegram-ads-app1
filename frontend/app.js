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
    // Update balance display without full re-render
    const balEl = document.querySelector('.amount');
    if (balEl && document.activeElement && document.activeElement.tagName === 'INPUT') {
      balEl.textContent = state.budget.balance.toLocaleString() + ' TON';
      return;
    }
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
            <span>${ad.price.toLocaleString()} TON</span>
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
        <div id="channel-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${[...state.selectedChannels].map(ch => '<span style="background:#0088cc;color:#fff;border-radius:20px;padding:4px 12px;font-size:13px;display:inline-flex;align-items:center;gap:6px;">' + ch + '<span onclick="removeChannel(\'' + ch + '\')" style="cursor:pointer;font-size:18px;line-height:1;">&times;</span></span>').join('')}
        </div>
        <input type="text" id="f-channel-url" placeholder="t.me/channel — Enter dabao" />
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
        <strong id="price-display">${state.price.toLocaleString()} TON</strong>
      </div>

      <button class="btn btn-primary btn-block" id="btn-submit-ad">Create Ad</button>
    </div>`;
}

// ---------- Budget ----------
function viewBudget() {
  setTimeout(() => { if (!state.budgetLoaded) { state.budgetLoaded = true; loadBudget().then(render); } }, 0);

  const methods = [
    { id: 'ton', icon: '💎', label: 'Pay with TON' }
  ];

  return `
    ${topBar(true)}
    <div class="section">
      <div class="balance-row">
        <div>Balance : <span class="amount">${state.budget.balance.toLocaleString()} TON</span></div>
        <button class="btn btn-primary" id="btn-transmit">Transmit</button>
      </div>

      <div class="field">
        <label>Add to your budget :</label>
        <input type="text" inputmode="decimal" id="f-amount" placeholder="10000" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
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
          <strong>${u.totalSpent.toLocaleString()} TON</strong>
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

  document.getElementById('f-channel-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        state.selectedChannels.add(val);
        e.target.value = '';
        render();
      }
    }
  });

  document.querySelectorAll('[data-channel]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.channel;
      if (state.selectedChannels.has(id)) state.selectedChannels.delete(id); else state.selectedChannels.add(id);
      el.classList.toggle('selected', state.selectedChannels.has(id));
    });
  });

  document.querySelectorAll('[data-daily]').forEach(el => {
    el.addEventListener('click', () => {
      state.dailyViewLimit = Number(el.dataset.daily);
      document.querySelectorAll('[data-daily]').forEach(e => e.classList.toggle('active', e.dataset.daily == el.dataset.daily));
    });
  });

  document.querySelectorAll('[data-plan]').forEach(el => {
    el.addEventListener('click', async () => {
      state.plan = el.dataset.plan;
      document.querySelectorAll('[data-plan]').forEach(e => e.classList.toggle('selected', e.dataset.plan === state.plan));
      await refreshPrice();
      const priceEl = document.getElementById('price-display');
      if (priceEl) priceEl.textContent = `${state.price.toLocaleString()} TON`;
    });
  });

  document.getElementById('f-views')?.addEventListener('input', async (e) => {
    state.viewCount = e.target.value;
    await refreshPrice();
    const priceEl = document.getElementById('price-display');
    if (priceEl) priceEl.textContent = `${state.price.toLocaleString()} TON`;
  });

  document.getElementById('btn-submit-ad')?.addEventListener('click', submitAd);

  // Budget screen
  document.getElementById('btn-transmit')?.addEventListener('click', () => toast('Transmit flow goes here (e.g. withdraw or transfer balance)'));
  document.querySelectorAll('[data-method]').forEach(el => {
    el.addEventListener('click', () => topUp(el.dataset.method));
  });

  // Friends
  document.getElementById('f-channel-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        state.selectedChannels.add(val);
        e.target.value = '';
        render();
      }
    }
  });

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

async function topUp(method) {
  const amount = Number(document.getElementById('f-amount').value);
  if (!amount || amount <= 0) { toast('Enter a valid amount first', true); return; }
  const MERCHANT = 'UQADuFF2Fy7NSrx36D9isoQ0CJx6dcX-0oxHkuRWyLxvng5N';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent('ton://transfer/' + MERCHANT + '?amount=' + Math.floor(amount * 1e9));

  // Remove existing dialog
  const existing = document.getElementById('ton-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'ton-dialog';
  dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  dialog.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;width:100%;max-width:360px;text-align:center;">' +
    '<h3 style="margin:0 0 4px;font-size:17px;">💎 TON Payment</h3>' +
    '<p style="color:#666;font-size:13px;margin:0 0 12px;">Send <b>' + amount + ' TON</b> to this address:</p>' +
    '<img src="' + qrUrl + '" style="width:160px;height:160px;border-radius:8px;margin-bottom:12px;">' +
    '<div style="background:#f5f5f5;border-radius:8px;padding:10px;margin-bottom:12px;word-break:break-all;font-size:11px;font-family:monospace;text-align:left;">' + MERCHANT + '</div>' +
    '<button id="ton-copy-btn" style="width:100%;padding:10px;background:#0088cc;color:#fff;border:none;border-radius:8px;margin-bottom:8px;font-size:14px;font-weight:600;cursor:pointer;">📋 Copy Address</button>' +
    '<p style="color:#666;font-size:12px;margin:8px 0 4px;text-align:left;">Paste TX Hash after payment:</p>' +
    '<input id="ton-tx-input" placeholder="TX Hash (optional)" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;box-sizing:border-box;font-size:12px;">' +
    '<button id="ton-confirm-btn" style="width:100%;padding:12px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;">✅ Confirm Payment</button>' +
    '<button id="ton-cancel-btn" style="width:100%;padding:9px;background:#f0f0f0;color:#333;border:none;border-radius:8px;margin-top:6px;font-size:13px;cursor:pointer;">Cancel</button>' +
    '</div>';
  document.body.appendChild(dialog);

  document.getElementById('ton-copy-btn').onclick = function() {
    navigator.clipboard.writeText(MERCHANT).then(function() {
      document.getElementById('ton-copy-btn').textContent = '✅ Copied!';
      setTimeout(function() { document.getElementById('ton-copy-btn').textContent = '📋 Copy Address'; }, 2000);
    });
  };

  document.getElementById('ton-cancel-btn').onclick = function() { dialog.remove(); };

  document.getElementById('ton-confirm-btn').onclick = async function() {
    const txHash = document.getElementById('ton-tx-input').value.trim() || 'pending_' + Date.now();
    dialog.remove();
    toast('Submitting payment...');
    try {
      await Api.post('/api/budget/ton-request', { txHash: txHash, amount: amount });
      toast('Payment submitted! Admin will confirm and add balance.');
    } catch (e) {
      toast(e.error || 'Submit failed', true);
    }
  };
}

// Fix keyboard hide on scroll
document.addEventListener('focusin', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    document.body.style.overflow = 'hidden';
    setTimeout(() => { e.target.scrollIntoView({behavior: 'smooth', block: 'center'}); }, 300);
  }
});
document.addEventListener('focusout', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    document.body.style.overflow = '';
  }
});

document.addEventListener('click', function(e) {
  if (e.target.matches('input, textarea')) {
    e.target.focus();
    setTimeout(() => { e.target.scrollIntoView({block: 'center'}); }, 100);
  }
});
bootstrap();

function removeChannel(ch) {
  state.selectedChannels.delete(ch);
  render();
}
