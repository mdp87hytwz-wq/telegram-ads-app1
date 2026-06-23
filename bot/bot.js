require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_ID = process.env.ADMIN_ID || '7606057137';
const BACKEND_URL = process.env.BACKEND_URL || '';

if (!BOT_TOKEN) { console.error('BOT_TOKEN missing'); process.exit(1); }

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function isAdmin(msg) { return String(msg.from.id) === ADMIN_ID; }

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 Welcome to *Telegram Ads*!\n\n${isAdmin(msg) ? '🔑 You are *Admin*. Use /admin' : 'Tap below to open the app.'}`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📢 Open Ads Dashboard', web_app: { url: MINI_APP_URL } }]] } }
  );
});

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  bot.sendMessage(msg.chat.id, `*🔑 Admin Panel*\n\n/orders\n/users\n/stats\n/addbalance [userId] [amount]\n/broadcast [message]`, { parse_mode: 'Markdown' });
});

bot.onText(/\/users/, async (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'x-admin-key': process.env.ADMIN_KEY || 'admin123' } });
    const data = await r.json();
    if (!data.users.length) return bot.sendMessage(msg.chat.id, '👥 No users yet.');
    let text = `*👥 Users (${data.users.length})*\n\n`;
    data.users.forEach((u, i) => { text += `*${i+1}. ${u.firstName}*\n🆔 \`${u.id}\`\n💰 ${(u.balance||0).toLocaleString()} Toman\n\n`; });
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message); }
});

bot.onText(/\/orders/, async (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/orders`, { headers: { 'x-admin-key': process.env.ADMIN_KEY || 'admin123' } });
    const data = await r.json();
    if (!data.orders.length) return bot.sendMessage(msg.chat.id, '📭 No orders yet.');
    let text = `*📋 Orders (${data.orders.length})*\n\n`;
    data.orders.slice(0,10).forEach((ad,i) => { text += `*${i+1}. ${ad.title}*\nUser: \`${ad.ownerId}\`\n💰 ${ad.price.toLocaleString()} Toman\n\n`; });
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message); }
});

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers: { 'x-admin-key': process.env.ADMIN_KEY || 'admin123' } });
    const data = await r.json();
    bot.sendMessage(msg.chat.id, `*📊 Stats*\n\n👥 Users: ${data.totalUsers}\n📢 Ads: ${data.totalAds}\n💰 Revenue: ${(data.totalRevenue||0).toLocaleString()} Toman`, { parse_mode: 'Markdown' });
  } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message); }
});

bot.onText(/\/addbalance (.+)/, async (msg, match) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  const parts = match[1].trim().split(' ');
  const userId = parts[0], amount = Number(parts[1]);
  if (!userId || !amount) return bot.sendMessage(msg.chat.id, 'Usage: /addbalance userId amount');
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/addbalance`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_KEY || 'admin123' }, body: JSON.stringify({ userId, amount }) });
    const data = await r.json();
    bot.sendMessage(msg.chat.id, `✅ Added ${amount.toLocaleString()} Toman\nNew balance: ${(data.balance||0).toLocaleString()} Toman`);
    try { bot.sendMessage(userId, `💰 *${amount.toLocaleString()} Toman* added to your account!`, { parse_mode: 'Markdown' }); } catch{}
  } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message); }
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '❌ Access denied.');
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'x-admin-key': process.env.ADMIN_KEY || 'admin123' } });
    const data = await r.json();
    let sent = 0;
    for (const u of data.users) { try { await bot.sendMessage(u.id, `📢 *Announcement*\n\n${match[1]}`, { parse_mode: 'Markdown' }); sent++; } catch{} }
    bot.sendMessage(msg.chat.id, `✅ Sent to ${sent}/${data.users.length} users.`);
  } catch(e) { bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message); }
});

console.log('Bot is running in polling mode.');
