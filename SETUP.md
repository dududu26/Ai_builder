# 🎀 AI Web Builder — Termux Setup Guide

## Prasyarat (Termux Android)

```bash
# 1. Update Termux
pkg update && pkg upgrade -y

# 2. Install Node.js & tools
pkg install nodejs git python3 -y

# 3. Cek versi
node -v   # minimal v18
npm -v
```

## Install & Run

```bash
# 1. Pindahkan folder ai-web-builder ke Termux
#    (pakai git clone, atau copy file manual ke /sdcard/)

# 2. Masuk ke folder
cd ai-web-builder

# 3. Install dependencies
npm install

# 4. Edit .env — isi AI_API_KEY dengan key asli
nano .env

# 5. Jalankan server
npm start
```

Server akan jalan di `http://0.0.0.0:3000`

Buka browser di Android → `http://localhost:3000`

## Catatan

- **better-sqlite3** mungkin perlu compile native. Kalau error, pastikan `python3` terinstall.
- AI API key didapat dari konfigurasi OpenClaw (`openclaw.runtime.json` → `models.providers.zai.apiKey`)
- Database disimpan di `data/webuilder.db`
- Website hasil generate disimpan di `sites/{username}/{slug}/`

## Akses dari HP Lain / Jaringan Lokal

Kalau mau diakses dari perangkat lain dalam WiFi yang sama:
- Buka `http://[IP-TERMUX]:3000` (cek IP pakai `ip addr show wlan0`)
- Registrasi & login dari browser manapun di jaringan lokal

## Struktur File

```
ai-web-builder/
├── server.js           # Main server
├── .env                # Konfigurasi (API key, port, JWT secret)
├── lib/
│   ├── db.js           # SQLite database
│   ├── auth.js         # JWT auth
│   └── ai.js           # AI API client
├── routes/
│   ├── auth.js         # Login/register
│   ├── projects.js     # Project CRUD
│   ├── ai.js           # Generate & edit via AI
│   └── files.js        # File read/write
├── public/
│   ├── index.html      # SPA entry
│   ├── css/style.css   # Dark theme UI
│   └── js/app.js       # Frontend logic
├── sites/              # Hosted websites
└── data/               # SQLite database
```
