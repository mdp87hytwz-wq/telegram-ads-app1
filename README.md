# Telegram Ads — Mini App Clone

A working Telegram Mini App: bot + backend API + frontend, modeled on the Telegram Ads screens you shared
(empty dashboard, Create Ad form, channel targeting, budget/payment, plan selection).

## Structure

```
telegram-ads-app/
├── bot/         Telegram bot — opens the mini app from a chat button
├── backend/     Express API — ads, channels, budget, leaderboard, auth
└── frontend/    Plain HTML/CSS/JS using the official Telegram WebApp SDK
```

## 1. Create your bot

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram.
2. `/newbot` → follow the prompts → copy the **bot token**.
3. `/setmenubutton` (or rely on `bot.js`, which sets it automatically) and point it at your mini app URL once deployed.
4. Mini Apps must be served over **HTTPS**, even for testing. For local dev, use a tunnel like `ngrok http 5500` or `cloudflared tunnel`.

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: paste your BOT_TOKEN
npm start
```

This starts the API on `http://localhost:4000`. It stores data in `backend/data.json` (auto-created) —
swap this for Postgres/MySQL/SQLite once you're past prototyping (see "Going to production" below).

For local UI testing without a real Telegram session, set `SKIP_AUTH=true` in `.env` — every request is
treated as a single dev user. **Never ship with this on.**

## 3. Run the bot

```bash
cd bot
npm install
cp .env.example .env
# edit .env: BOT_TOKEN + MINI_APP_URL (your deployed/tunneled frontend URL)
npm start
```

Message your bot `/start` in Telegram — you'll get a button that opens the mini app.

## 4. Serve the frontend

Any static file server works. Quick option:

```bash
cd frontend
npx serve .
```

Then edit `frontend/config.js` so `API_BASE_URL` points at your backend's public URL (not `localhost`,
once you're testing inside real Telegram — phones can't reach your laptop's localhost).

## How auth works

Telegram signs every mini-app session with `initData` (user info + an HMAC hash). The frontend sends it
on every request via the `X-Telegram-Init-Data` header; `backend/verifyTelegram.js` recomputes the hash
with your bot token and rejects anything that doesn't match. This is the same mechanism Telegram's own
docs describe — no separate login screen needed.

## What's mocked vs real

| Feature | Status |
|---|---|
| Telegram auth (initData verification) | ✅ Real |
| Bot → mini app launch | ✅ Real |
| Ad creation, channel targeting, pricing | ✅ Real (file-based storage) |
| Channel directory | ⚠️ Seeded sample data — replace with your own list or a Telegram API lookup |
| Card-to-card / TON / USDT / Stars payments | ⚠️ Mocked — instantly "completes" the top-up. Wire each to a real provider before launch (see below) |
| AI text/image generation buttons | ⚠️ Placeholder — wire to your own AI endpoint (e.g. the Anthropic API) |

## Wiring up real payments

- **Telegram Stars**: use the [Telegram Payments API](https://core.telegram.org/bots/payments) — `sendInvoice` with `currency: "XTR"`, then handle `pre_checkout_query` and `successful_payment` in `bot.js`, and call your backend to credit the balance.
- **TON / USDT (TON)**: integrate [TON Connect](https://docs.ton.org/develop/dapps/ton-connect/overview) on the frontend to request a wallet payment, then verify the on-chain transaction from your backend before crediting balance.
- **USDT (TRC20)**: generate a deposit address per user (or per top-up) and watch the Tron chain for the matching transfer — e.g. via TronGrid's API — before crediting balance.
- **Card-to-card**: this is typically manual/semi-manual in the Iranian market (reference number submitted by the user, confirmed by an admin) — build an admin-review queue instead of auto-completing it.

In all cases: keep top-ups `pending` until a webhook/poller confirms the payment, only then credit the
user's balance — exactly like the TODO comment left in `backend/server.js`.

## Going to production

- Swap `db.js`'s JSON file for a real database (Postgres + Prisma/Drizzle is a common pairing).
- Put the backend behind HTTPS (e.g. a reverse proxy with Let's Encrypt) and set `API_BASE_URL` in `frontend/config.js` accordingly.
- Move uploaded media (`backend/uploads/`) to object storage (S3-compatible) once you're off a single server.
- Rate-limit `/api/ads` and `/api/budget/topup` to prevent abuse.
