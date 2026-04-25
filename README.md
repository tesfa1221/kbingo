# K Bingo 🎮

A full-stack real-time Bingo game built as a Telegram Mini App.

**Stack:** React (Vite) · Tailwind CSS · Framer Motion · Node.js · Express · Socket.io · MySQL

---

## Project Structure

```
/
├── server/          # Node.js + Express + Socket.io backend
│   ├── db/          # MySQL connection + schema
│   ├── game/        # GameEngine (180s loop)
│   ├── routes/      # auth, game, wallet
│   ├── middleware/  # JWT auth, Telegram validation
│   ├── utils/       # cardGenerator, bingoValidator, telegramAuth
│   └── cron/        # Telegram auto-post
└── client/          # React + Vite frontend
    └── src/
        ├── components/
        ├── store/       # Zustand global state
        ├── hooks/       # useSocket
        └── utils/       # api, audio
```

---

## Setup

### 1. Database

```bash
mysql -u root -p < server/db/schema.sql
```

### 2. Server

```bash
cd server
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

### 3. Client

```bash
cd client
npm install
npm run dev
```

---

## Environment Variables (server/.env)

| Variable | Description |
|---|---|
| `DB_*` | MySQL connection details |
| `JWT_SECRET` | Secret for signing JWTs |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `TELEGRAM_CHANNEL_ID` | Channel to post results (e.g. `@mychannel`) |
| `TELEGRAM_BOT_SECRET` | Used for initData validation |
| `CLOUDINARY_*` | Cloudinary credentials for deposit screenshots |
| `HOUSE_FEE_PERCENT` | Commission % (default: 20) |
| `BAN_DURATION_MINUTES` | False BINGO ban duration (default: 30) |

---

## Game Flow

```
0s ──────────── 60s ──────────────────── 180s
  REGISTRATION        ACTIVE (ball/3s)     RESET
  Pick card 1-100     Mark numbers         Archive → restart
  Cards lock live     Claim BINGO          
```

### Winning Patterns
- Horizontal line (any row)
- Vertical line (any column)  
- Diagonal (either direction)
- Four Corners

### False BINGO Penalty
- Ejected from room
- Entry fee forfeited
- 30-minute ban

---

## Telegram Mini App

Set your bot's menu button URL to `https://yourdomain.com` and the app will auto-authenticate users via `window.Telegram.WebApp.initData`.

---

## Key Features

- 🔄 Synchronized 180s server clock — all clients share the same timer
- 🔒 Real-time card locking via Socket.io
- ✅ 100% server-side BINGO validation
- 💰 Manual deposit flow with Cloudinary screenshot storage
- 👁️ Glassmorphism watcher overlay for late joiners
- 🏆 Weekly leaderboard
- 📢 Auto-post winners to Telegram channel via cron
- 🎵 Web Speech API number calling + AudioContext SFX
- 🌍 Amharic UI strings throughout
