require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const { load, save } = require('./db');
const { verifyInitData } = require('./verifyTelegram');

const app = express();
const PORT = process.env.PORT || 4000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const SKIP_AUTH = process.env.SKIP_AUTH === 'true'; // set true only for local dev without a real Telegram session

app.use(cors());
app.use(express.json());

// --- File uploads (ad photo/video) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// --- Auth middleware: verifies the Telegram WebApp initData sent by the frontend ---
function auth(req, res, next) {
  if (SKIP_AUTH) {
    req.telegramUser = { id: 'dev-user', first_name: 'Dev', username: 'dev_user' };
    return next();
  }
  const initData = req.headers['x-telegram-init-data'];
  const result = verifyInitData(initData, BOT_TOKEN);
  if (!result.ok) return res.status(401).json({ error: 'Unauthorized', reason: result.reason });
  req.telegramUser = result.user;
  next();
}

function getOrCreateUser(data, tgUser) {
  const id = String(tgUser.id);
  if (!data.users[id]) {
    data.users[id] = {
      id,
      firstName: tgUser.first_name || 'User',
      username: tgUser.username || '',
      photoUrl: tgUser.photo_url || '',
      balance: 7000, // starter Toman balance, matches the "no ads yet" mock state
      joinedAt: Date.now()
    };
  }
  return data.users[id];
}

// ---------- AUTH ----------
app.post('/api/auth/verify', (req, res) => {
  const { initData } = req.body;
  const result = verifyInitData(initData, BOT_TOKEN);
  if (!result.ok) return res.status(401).json({ error: 'Unauthorized', reason: result.reason });
  const data = load();
  const user = getOrCreateUser(data, result.user);
  save(data);
  res.json({ user });
});

// ---------- ME / DASHBOARD ----------
app.get('/api/me', auth, (req, res) => {
  const data = load();
  const user = getOrCreateUser(data, req.telegramUser);
  save(data);
  const myAds = Object.values(data.ads).filter(a => a.ownerId === user.id);
  res.json({ user, adsCount: myAds.length });
});

// ---------- CHANNELS (targeting) ----------
app.get('/api/channels', auth, (req, res) => {
  const data = load();
  const { country, tag, search } = req.query;
  let list = data.channels;
  if (country) list = list.filter(c => c.country.toLowerCase() === String(country).toLowerCase());
  if (tag) list = list.filter(c => c.tags.includes(tag));
  if (search) list = list.filter(c =>
    c.name.toLowerCase().includes(String(search).toLowerCase()) ||
    c.username.toLowerCase().includes(String(search).toLowerCase())
  );
  res.json({ channels: list });
});

// ---------- ADS ----------
app.get('/api/ads', auth, (req, res) => {
  const data = load();
  const mine = Object.values(data.ads).filter(a => a.ownerId === req.telegramUser.id || a.ownerId === String(req.telegramUser.id));
  res.json({ ads: mine });
});

const PLAN_MULTIPLIER = {
  normal: 1,
  fast: 1.3,
  ultra_fast: 1.6,
  ultra_fast_pro: 2,
  ultra_fast_pro_max: 2.5
};
const PRICE_PER_VIEW_TOMAN = 5; // base price per view, adjust as needed

function calcPrice(viewCount, plan) {
  const mult = PLAN_MULTIPLIER[plan] || 1;
  return Math.round(viewCount * PRICE_PER_VIEW_TOMAN * mult);
}

app.post('/api/ads/price', auth, (req, res) => {
  const { viewCount = 0, plan = 'normal' } = req.body;
  res.json({ price: calcPrice(Number(viewCount), plan) });
});

app.post('/api/ads', auth, upload.single('media'), (req, res) => {
  const data = load();
  const user = getOrCreateUser(data, req.telegramUser);

  const {
    title, text, promoteUrl, targetType = 'channels',
    targetChannels = '[]', dailyViewLimit = 1, viewCount = 0, plan = 'normal'
  } = req.body;

  if (!title || !text || !promoteUrl) {
    return res.status(400).json({ error: 'title, text and promoteUrl are required' });
  }

  const price = calcPrice(Number(viewCount), plan);
  if (price > user.balance) {
    return res.status(402).json({ error: 'Insufficient balance', price, balance: user.balance });
  }

  const id = nanoid();
  const ad = {
    id,
    ownerId: user.id,
    title,
    text,
    promoteUrl,
    mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
    targetType,
    targetChannels: JSON.parse(targetChannels || '[]'),
    dailyViewLimit: Number(dailyViewLimit),
    viewCount: Number(viewCount),
    plan,
    price,
    status: 'active',
    createdAt: Date.now()
  };

  data.ads[id] = ad;
  user.balance -= price;
  save(data);

  res.status(201).json({ ad, balance: user.balance });
});

app.delete('/api/ads/:id', auth, (req, res) => {
  const data = load();
  const ad = data.ads[req.params.id];
  if (!ad || ad.ownerId !== String(req.telegramUser.id)) return res.status(404).json({ error: 'Not found' });
  delete data.ads[req.params.id];
  save(data);
  res.json({ ok: true });
});

// ---------- BUDGET / PAYMENTS ----------
// NOTE: these are mock handlers. Card-to-card, TON, USDT and Telegram Stars
// all need a real payment provider / Telegram Payments API hookup in production.
app.get('/api/budget', auth, (req, res) => {
  const data = load();
  const user = getOrCreateUser(data, req.telegramUser);
  save(data);
  const myTx = Object.values(data.transactions)
    .filter(t => t.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ balance: user.balance, transactions: myTx });
});

app.post('/api/budget/topup', auth, (req, res) => {
  const { amount, method } = req.body; // method: card | ton | usdt_ton | usdt_trc20 | stars
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const data = load();
  const user = getOrCreateUser(data, req.telegramUser);

  const txId = nanoid();
  const tx = {
    id: txId,
    userId: user.id,
    amount: Number(amount),
    type: 'topup',
    method,
    // Real integration: status should start 'pending' until the payment
    // provider / blockchain confirms, then move to 'completed' via webhook.
    status: 'completed',
    createdAt: Date.now()
  };
  data.transactions[txId] = tx;
  user.balance += Number(amount);
  save(data);

  res.json({ transaction: tx, balance: user.balance });
});

// ---------- FRIENDS / LEADERBOARD ----------
app.get('/api/leaderboard', auth, (req, res) => {
  const data = load();
  const board = Object.values(data.users)
    .map(u => ({
      id: u.id,
      name: u.firstName,
      username: u.username,
      adsCount: Object.values(data.ads).filter(a => a.ownerId === u.id).length,
      totalSpent: Object.values(data.ads).filter(a => a.ownerId === u.id).reduce((s, a) => s + a.price, 0)
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
  res.json({ leaderboard: board });
});

app.get('/api/friends', auth, (req, res) => {
  // Placeholder: wire this to your own referral system.
  res.json({ friends: [], referralLink: `https://t.me/YourBot?start=ref_${req.telegramUser.id}` });
});

app.listen(PORT, () => console.log(`Telegram Ads backend running on http://localhost:${PORT}`));

// ========== ADMIN ROUTES ==========
// Simple admin key check (set ADMIN_KEY env variable on Railway)
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== (process.env.ADMIN_KEY || 'admin123')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/admin/orders', adminAuth, (req, res) => {
  const data = load();
  const orders = Object.values(data.ads).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ orders });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const data = load();
  const users = Object.values(data.users);
  res.json({ users });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const data = load();
  const users = Object.values(data.users);
  const ads = Object.values(data.ads);
  const txs = Object.values(data.transactions || {});
  res.json({
    totalUsers: users.length,
    totalAds: ads.length,
    totalRevenue: ads.reduce((s, a) => s + (a.price || 0), 0),
    pendingPayments: txs.filter(t => t.status === 'pending').length
  });
});

app.post('/api/admin/addbalance', adminAuth, (req, res) => {
  const { userId, amount, method = 'admin' } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'userId and amount required' });
  const data = load();
  if (!data.users[String(userId)]) return res.status(404).json({ error: 'User not found' });
  data.users[String(userId)].balance = (data.users[String(userId)].balance || 0) + Number(amount);
  const txId = String(Date.now());
  data.transactions = data.transactions || {};
  data.transactions[txId] = { id: txId, userId: String(userId), amount: Number(amount), type: 'topup', method, status: 'completed', createdAt: Date.now() };
  save(data);
  res.json({ balance: data.users[String(userId)].balance });
});

// TON payment endpoint — user submits tx hash, admin verifies
app.post('/api/budget/ton-request', auth, (req, res) => {
  const { txHash, amount } = req.body;
  const data = load();
  const user = getOrCreateUser(data, req.telegramUser);
  const txId = String(Date.now());
  data.transactions = data.transactions || {};
  data.transactions[txId] = {
    id: txId,
    userId: user.id,
    amount: Number(amount),
    type: 'topup',
    method: 'ton',
    txHash,
    status: 'pending',
    createdAt: Date.now()
  };
  save(data);
  // Notify admin via Telegram
  const adminMsg = `💸 *New TON Payment Request*\n\n👤 User: ${user.firstName} (ID: \`${user.id}\`)\n💰 Amount: ${amount} Toman\n🔗 TX Hash: \`${txHash || 'not provided'}\`\n\nTo confirm: /confirmpay ${user.id} ${amount}`;
  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_ID || '7606057137';
  if (token && adminId) {
    const https = require('https');
    const body = JSON.stringify({ chat_id: adminId, text: adminMsg, parse_mode: 'Markdown' });
    const opts = { hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    https.request(opts, () => {}).end(body);
  }
  res.json({ ok: true, txId, status: 'pending', message: 'Payment request submitted. Admin will confirm shortly.' });
});
