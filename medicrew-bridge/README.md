# MediCrew Bridge Server

Runs on your **local network PC** — polls your device's JSON endpoint and pushes readings to Supabase Realtime so the web app receives live values.

```
Device ──HTTP JSON──► Bridge Server ──Supabase Insert──► Web App (Realtime)
```

---

## Quick Start

```bash
cd medicrew-bridge
npm install
cp .env.example .env     # then edit .env with your values
npm start
```

---

## What to put in `.env`

| Variable | Example | Description |
|---|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | **Service role** key (not anon) — allows inserts |
| `DEVICE_STREAM_URL` | `http://192.168.1.42/data` | URL your device serves JSON on |
| `DEVICE_ID` | `HEALTH01` | Must match what you linked in the app |
| `POLL_INTERVAL_MS` | `3000` | How often to fetch (milliseconds) |

> **Where to find the Service Role key:**  
> Supabase Dashboard → Settings → API → `service_role` (Secret) — click "Reveal"

---

## Expected Device JSON Format

Your device can output **any of these field names** — the bridge handles all variants:

```json
{
  "heart_rate": 72,
  "temperature": 36.8,
  "spo2": 98,
  "blood_pressure": "118/76"
}
```

**Also accepted key names:**

| Vital | Accepted keys |
|---|---|
| Heart Rate | `heart_rate`, `heart_rate_bpm`, `hr`, `heartRate` |
| Temperature | `temperature`, `temperature_c`, `temp`, `Temperature` |
| SpO₂ | `spo2`, `blood_oxygen`, `SpO2`, `oxygen` |
| Blood Pressure | `blood_pressure`, `bp`, `BP` |

---

## How it works

1. Bridge fetches `DEVICE_STREAM_URL` every `POLL_INTERVAL_MS` ms
2. Normalises JSON keys so any device format works
3. Inserts a row into `device_readings` table in Supabase
4. Web app has a Supabase Realtime subscription — receives the new row **instantly**
5. Vital cards update with no page refresh needed

---

## Run as background service (optional)

On Windows, install as a background service with [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start server.js --name medicrew-bridge
pm2 startup     # auto-start on boot
pm2 save
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing SUPABASE_SERVICE_KEY` | Add it to `.env` (service_role, not anon key) |
| `Device request timed out` | Check device is on same network, IP is correct |
| Values not appearing in app | Run `device_readings_schema.sql` in Supabase SQL Editor first |
| Bridge inserts but app doesn't update | Enable Realtime for `device_readings` table in Supabase |
