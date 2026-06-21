require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;

if (!BOT_TOKEN || !MINI_APP_URL) {
  console.error('Set BOT_TOKEN and MINI_APP_URL in bot/.env (see .env.example)');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Set the persistent menu button to open the mini app directly from the chat header.
bot.setChatMenuButton({
  menu_button: { type: 'web_app', text: 'Open Ads', web_app: { url: MINI_APP_URL } }
}).catch(console.error);

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to Telegram Ads. Tap below to create and manage your ads.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open Ads Dashboard', web_app: { url: MINI_APP_URL } }]]
    }
  });
});

console.log('Bot is running. Press Ctrl+C to stop.');
