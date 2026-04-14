/**
 * MediCrew Device Bridge Server — Auto-Discovery Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatically scans your local network to find health devices,
 * then polls them and pushes readings to Supabase Realtime.
 *
 * NO MANUAL IP NEEDED — the bridge finds your device automatically.
 *
 * FLOW:
 *   1. Detect local subnet (e.g. 192.168.1.x)
 *   2. Scan all IPs on ports 80/8080/3000 for JSON health endpoints
 *   3. When a device is found → poll it and push to Supabase
 *   4. Web app subscribes to Supabase Realtime → instant live values
 *
 * SETUP:
 *   1. Edit .env with your Supabase credentials and Device ID
 *   2. npm install
 *   3. npm start
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { networkInterfaces } from 'os'
import net from 'net'

dotenv.config()

// ── Configuration ────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY
const DEVICE_ID         = process.env.DEVICE_ID || 'HEALTH01'
const POLL_INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_MS || '3000')
const SCAN_PORTS        = (process.env.SCAN_PORTS || '80,8080,3000,5000').split(',').map(Number)
const DEVICE_STREAM_URL = process.env.DEVICE_STREAM_URL || ''  // Optional: skip scan if you know the IP

// Known JSON path patterns that health devices commonly serve
const JSON_PATHS = ['/', '/data', '/vitals', '/json', '/api/vitals', '/health', '/readings', '/sensor']

// ── Validate ──────────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ══════════════════════════════════════════════════════════════════════════════
//  NETWORK AUTO-DISCOVERY
// ══════════════════════════════════════════════════════════════════════════════

/** Get this machine's local IP and subnet */
function getLocalSubnet() {
    const ifaces = networkInterfaces()
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            // Skip loopback and non-IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.')
                return {
                    localIp: iface.address,
                    subnet:  parts.slice(0, 3).join('.'),  // e.g. "192.168.1"
                    mask:    iface.netmask
                }
            }
        }
    }
    return null
}

/** Quick TCP connect check — is this host:port open? */
function isPortOpen(host, port, timeoutMs = 300) {
    return new Promise(resolve => {
        const socket = new net.Socket()
        socket.setTimeout(timeoutMs)
        socket.on('connect', () => { socket.destroy(); resolve(true) })
        socket.on('timeout', () => { socket.destroy(); resolve(false) })
        socket.on('error',   () => { socket.destroy(); resolve(false) })
        socket.connect(port, host)
    })
}

/** Check if a URL returns valid health JSON */
async function probeForHealthJSON(url) {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2000)

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        })
        clearTimeout(timeout)

        if (!res.ok) return null

        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch { return null }

        // Check if the JSON contains any health-related keys
        const healthKeys = [
            'heart_rate', 'hr', 'heartRate', 'heart_rate_bpm',
            'temperature', 'temp', 'temperature_c',
            'spo2', 'blood_oxygen', 'SpO2', 'oxygen',
            'blood_pressure', 'bp', 'BP',
            'device_id', 'sensor'
        ]

        const foundKeys = Object.keys(data).filter(k =>
            healthKeys.includes(k) || healthKeys.some(hk => k.toLowerCase().includes(hk.toLowerCase()))
        )

        if (foundKeys.length >= 1) {
            return { url, data, matchedKeys: foundKeys }
        }
        return null
    } catch {
        return null
    }
}

/** Scan entire subnet for health devices */
async function scanNetwork() {
    const netInfo = getLocalSubnet()
    if (!netInfo) {
        console.error('❌ Could not detect local network. Check your Wi-Fi/Ethernet connection.')
        return null
    }

    console.log(`\n🔍 Scanning network: ${netInfo.subnet}.0/24`)
    console.log(`   Local IP: ${netInfo.localIp}`)
    console.log(`   Checking ports: ${SCAN_PORTS.join(', ')}`)
    console.log(`   Scanning 254 hosts...\n`)

    // Phase 1: Quick port scan to find hosts with open ports
    const openHosts = []
    const scanBatch = 30  // scan 30 IPs at a time to avoid overload

    for (let batch = 1; batch <= 254; batch += scanBatch) {
        const promises = []
        for (let i = batch; i < Math.min(batch + scanBatch, 255); i++) {
            const ip = `${netInfo.subnet}.${i}`
            if (ip === netInfo.localIp) continue  // skip self

            for (const port of SCAN_PORTS) {
                promises.push(
                    isPortOpen(ip, port).then(open => {
                        if (open) {
                            openHosts.push({ ip, port })
                            process.stdout.write(`   ✓ Found open port: ${ip}:${port}\n`)
                        }
                    })
                )
            }
        }
        await Promise.all(promises)
    }

    if (openHosts.length === 0) {
        console.log('\n⚠️  No hosts with open ports found on the network.')
        return null
    }

    console.log(`\n📡 Found ${openHosts.length} open host(s). Probing for health JSON...\n`)

    // Phase 2: Probe each open host for health JSON
    for (const { ip, port } of openHosts) {
        for (const path of JSON_PATHS) {
            const url = `http://${ip}:${port}${path}`
            const result = await probeForHealthJSON(url)
            if (result) {
                console.log(`\n🎯 DEVICE FOUND!`)
                console.log(`   URL: ${result.url}`)
                console.log(`   Keys: ${result.matchedKeys.join(', ')}`)
                console.log(`   Sample data:`, JSON.stringify(result.data, null, 2))
                return result
            }
        }
    }

    console.log('\n⚠️  No health devices found on the network.')
    return null
}

// ══════════════════════════════════════════════════════════════════════════════
//  DATA NORMALISATION & PUSH
// ══════════════════════════════════════════════════════════════════════════════

function normaliseReading(raw) {
    return {
        device_id:      DEVICE_ID,
        heart_rate:     raw.heart_rate    ?? raw.heart_rate_bpm ?? raw.hr       ?? raw.heartRate    ?? null,
        temperature:    raw.temperature   ?? raw.temperature_c  ?? raw.temp     ?? raw.Temperature  ?? null,
        spo2:           raw.spo2          ?? raw.blood_oxygen   ?? raw.SpO2     ?? raw.oxygen       ?? null,
        blood_pressure: raw.blood_pressure?? raw.bp             ?? raw.BP       ?? null,
        extra:          raw,
        recorded_at:    new Date().toISOString()
    }
}

async function pushReading(reading) {
    const { error } = await supabase.from('device_readings').insert([reading])
    if (error) {
        console.error('❌ Supabase insert error:', error.message)
    } else {
        const ts = new Date().toLocaleTimeString()
        console.log(`✅ ${ts} | HR: ${reading.heart_rate ?? '-'} | Temp: ${reading.temperature ?? '-'} | SpO2: ${reading.spo2 ?? '-'} | BP: ${reading.blood_pressure ?? '-'}`)
    }
}

async function pollDevice(deviceUrl) {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(deviceUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        })
        clearTimeout(timeout)

        if (!res.ok) {
            console.warn(`⚠️  Device returned HTTP ${res.status}`)
            return
        }

        const raw = await res.json()
        await pushReading(normaliseReading(raw))
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn('⚠️  Device request timed out')
        } else {
            console.warn('⚠️  Fetch error:', err.message)
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  MediCrew Bridge Server v2.0 — Auto-Discovery')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Device ID   : ${DEVICE_ID}`)
    console.log(`  Poll every  : ${POLL_INTERVAL_MS}ms`)
    console.log(`  Supabase    : ${SUPABASE_URL}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let deviceUrl = DEVICE_STREAM_URL

    // If no manual URL is set, auto-discover
    if (!deviceUrl) {
        console.log('\n  No DEVICE_STREAM_URL set — starting auto-discovery...')
        const found = await scanNetwork()

        if (!found) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('  Could not find a device. Options:')
            console.log('    1. Make sure your device is on and connected to Wi-Fi')
            console.log('    2. Set DEVICE_STREAM_URL manually in .env')
            console.log('    3. Re-run this script to scan again')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            // Retry scan every 30 seconds
            console.log('\n⏳ Will retry scan in 30 seconds...\n')
            setTimeout(main, 30000)
            return
        }

        deviceUrl = found.url
    }

    // Also update the device record in Supabase with the discovered IP
    const urlObj = new URL(deviceUrl)
    await supabase.from('devices')
        .update({ ip_address: urlObj.hostname, last_sync: new Date().toISOString() })
        .eq('device_id', DEVICE_ID)

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  ✅ Locked onto: ${deviceUrl}`)
    console.log(`  Polling every ${POLL_INTERVAL_MS}ms. Press Ctrl+C to stop.`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    // Start polling
    pollDevice(deviceUrl)
    setInterval(() => pollDevice(deviceUrl), POLL_INTERVAL_MS)
}

main().catch(console.error)
