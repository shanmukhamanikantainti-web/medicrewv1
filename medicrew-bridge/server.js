/**
 * MediCrew Device Bridge Server
 * ─────────────────────────────────────────────────────────────────────────────
 * This runs on your LOCAL NETWORK (same Wi-Fi as the device).
 * It polls the device's JSON endpoint and pushes readings to Supabase
 * so the web app can subscribe via Realtime — no HTTPS/HTTP conflict.
 *
 * HOW IT WORKS:
 *   Device ──JSON──► Bridge Server ──Supabase Insert──► Web App (Realtime)
 *
 * SETUP:
 *   1. Edit .env with your device IP, device ID, and Supabase credentials
 *   2. npm install
 *   3. npm start
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// ── Configuration ────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY  // Use SERVICE KEY (not anon) for server-side writes
const DEVICE_STREAM_URL = process.env.DEVICE_STREAM_URL     // e.g. http://192.168.1.42/data or http://10.54.100.170/vitals
const DEVICE_ID         = process.env.DEVICE_ID             // e.g. HEALTH01
const POLL_INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_MS || '3000') // default 3 seconds

// ── Validate config ───────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Bridge] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
    process.exit(1)
}
if (!DEVICE_STREAM_URL) {
    console.error('[Bridge] ❌ Missing DEVICE_STREAM_URL in .env - set this to your device\'s HTTP endpoint')
    process.exit(1)
}
if (!DEVICE_ID) {
    console.error('[Bridge] ❌ Missing DEVICE_ID in .env')
    process.exit(1)
}

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Normalise raw device JSON into standard reading format ───────────────────
// Accepts many common key names so it works with most DIY devices (Arduino, ESP32, etc.)
function normaliseReading(raw) {
    return {
        device_id:      DEVICE_ID,
        heart_rate:     raw.heart_rate    ?? raw.heart_rate_bpm ?? raw.hr       ?? raw.heartRate    ?? null,
        temperature:    raw.temperature   ?? raw.temperature_c  ?? raw.temp     ?? raw.Temperature  ?? null,
        spo2:           raw.spo2          ?? raw.blood_oxygen   ?? raw.SpO2     ?? raw.oxygen       ?? null,
        blood_pressure: raw.blood_pressure?? raw.bp             ?? raw.BP       ?? null,
        extra:          raw,   // store full raw payload for audit / AI analysis
        recorded_at:    new Date().toISOString()
    }
}

// ── Push one reading to Supabase ─────────────────────────────────────────────
async function pushReading(reading) {
    const { error } = await supabase
        .from('device_readings')
        .insert([reading])

    if (error) {
        console.error('[Bridge] ❌ Supabase insert error:', error.message)
    } else {
        console.log(`[Bridge] ✅ ${new Date().toLocaleTimeString()} — Pushed:`, {
            hr:   reading.heart_rate,
            temp: reading.temperature,
            spo2: reading.spo2,
            bp:   reading.blood_pressure
        })
    }
}

// ── Fetch from device & push ──────────────────────────────────────────────────
async function poll() {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const res = await fetch(DEVICE_STREAM_URL, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        })
        clearTimeout(timeout)

        if (!res.ok) {
            console.warn(`[Bridge] ⚠️  Device returned HTTP ${res.status}`)
            return
        }

        const raw = await res.json()
        const reading = normaliseReading(raw)
        await pushReading(reading)

    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn('[Bridge] ⚠️  Device request timed out — is the device on?')
        } else {
            console.warn('[Bridge] ⚠️  Fetch error:', err.message)
        }
    }
}

// ── Startup banner ────────────────────────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  MediCrew Device Bridge Server v1.0')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  Device ID   : ${DEVICE_ID}`)
console.log(`  Device URL  : ${DEVICE_STREAM_URL}`)
console.log(`  Poll every  : ${POLL_INTERVAL_MS}ms`)
console.log(`  Supabase    : ${SUPABASE_URL}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Bridge is running. Press Ctrl+C to stop.')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ── Main loop ─────────────────────────────────────────────────────────────────
poll()                                   // first poll immediately
setInterval(poll, POLL_INTERVAL_MS)      // then every N seconds
