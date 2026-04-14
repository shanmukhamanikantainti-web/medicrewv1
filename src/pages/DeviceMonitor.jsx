import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    Cpu, Link2, WifiOff, Activity, RefreshCw,
    Shield, Zap, CheckCircle, AlertTriangle,
    Thermometer, Heart, Droplet, Gauge, Wifi, X
} from 'lucide-react'

// ── Fallback simulator for demo / offline mode ────────────────────────────────
function generateSimVitals() {
    const now = new Date()
    return {
        heart_rate:     Math.floor(Math.random() * 20 + 68),
        temperature:    parseFloat((Math.random() * 1.5 + 36.4).toFixed(1)),
        spo2:           Math.floor(Math.random() * 3 + 96),
        blood_pressure: `${Math.floor(Math.random() * 20 + 110)}/${Math.floor(Math.random() * 10 + 72)}`,
        recorded_at:    now.toISOString(),
        _simulated:     true
    }
}

// ── Vital card definition ─────────────────────────────────────────────────────
const VITALS_CONFIG = [
    {
        key:    'heart_rate',
        label:  'Heart Rate',
        unit:   'bpm',
        icon:   Heart,
        color:  '#ef4444',
        bg:     'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.2)',
        normal: v => v >= 50 && v <= 110
    },
    {
        key:    'temperature',
        label:  'Temperature',
        unit:   '°C',
        icon:   Thermometer,
        color:  '#f97316',
        bg:     'rgba(249,115,22,0.08)',
        border: 'rgba(249,115,22,0.2)',
        normal: v => parseFloat(v) >= 36.0 && parseFloat(v) <= 37.5
    },
    {
        key:    'spo2',
        label:  'Blood Oxygen',
        unit:   '%',
        icon:   Droplet,
        color:  '#3b82f6',
        bg:     'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.2)',
        normal: v => v >= 95
    },
    {
        key:    'blood_pressure',
        label:  'Blood Pressure',
        unit:   'mmHg',
        icon:   Gauge,
        color:  '#8b5cf6',
        bg:     'rgba(139,92,246,0.08)',
        border: 'rgba(139,92,246,0.2)',
        normal: () => true
    }
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function DeviceMonitor() {
    const { user } = useAuth()
    const [device,      setDevice]      = useState(null)
    const [deviceId,    setDeviceId]    = useState('')
    const [streamUrl,   setStreamUrl]   = useState('http://10.54.100.170/')
    const [vitals,      setVitals]      = useState(null)
    const [linking,     setLinking]     = useState(false)
    const [error,       setError]       = useState('')
    const [pulse,       setPulse]       = useState(false)
    const [isSimulating,setIsSimulating]= useState(false)
    const [connStatus,  setConnStatus]  = useState('idle')   // idle | live | error
    const [history,     setHistory]     = useState([])       // last 5 readings
    const simRef = useRef(null)

    // ── Load linked device from Supabase ────────────────────────────────────
    useEffect(() => {
        if (!user) return
        supabase
            .from('devices')
            .select('*')
            .eq('patient_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setDevice(data)
                    if (data.device_id === 'SIMULATOR') setIsSimulating(true)
                    if (data.ip_address) setStreamUrl(data.ip_address)
                }
            })
    }, [user])

    // ── Supabase Realtime subscription ───────────────────────────────────────
    // Listens for new rows in device_readings pushed by the bridge server
    useEffect(() => {
        if (!device || isSimulating) return

        setConnStatus('idle')

        const channel = supabase
            .channel(`device-readings-${device.device_id}`)
            .on(
                'postgres_changes',
                {
                    event:  'INSERT',
                    schema: 'public',
                    table:  'device_readings',
                    filter: `device_id=eq.${device.device_id}`
                },
                (payload) => {
                    const reading = payload.new
                    setVitals(reading)
                    setConnStatus('live')
                    setError('')
                    setPulse(true)
                    setTimeout(() => setPulse(false), 600)
                    setHistory(prev => [reading, ...prev].slice(0, 5))

                    // Update last_sync in devices table
                    supabase.from('devices')
                        .update({ last_sync: new Date().toISOString() })
                        .eq('id', device.id)
                        .then(() => {})
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[DeviceMonitor] Realtime subscribed for', device.device_id)
                    // Fetch the last known reading immediately
                    fetchLatestReading(device.device_id)
                } else if (status === 'CHANNEL_ERROR') {
                    setConnStatus('error')
                    setError('Realtime connection failed. Check Supabase settings.')
                }
            })

        return () => { supabase.removeChannel(channel) }
    }, [device, isSimulating])

    // ── Simulator mode ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isSimulating) { clearInterval(simRef.current); return }

        const tick = () => {
            const v = generateSimVitals()
            setVitals(v)
            setConnStatus('live')
            setPulse(true)
            setTimeout(() => setPulse(false), 600)
            setHistory(prev => [v, ...prev].slice(0, 5))
        }
        tick()
        simRef.current = setInterval(tick, 3000)
        return () => clearInterval(simRef.current)
    }, [isSimulating])

    // ── Fetch most recent reading from DB on mount ───────────────────────────
    const fetchLatestReading = useCallback(async (devId) => {
        const { data } = await supabase
            .from('device_readings')
            .select('*')
            .eq('device_id', devId)
            .order('recorded_at', { ascending: false })
            .limit(5)

        if (data && data.length > 0) {
            setVitals(data[0])
            setHistory(data)
            setConnStatus('live')
        }
    }, [])

    // ── Link device ───────────────────────────────────────────────────────────
    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        const cleanId = deviceId.trim().toUpperCase()
        const payload = {
            device_id:   cleanId,
            patient_id:  user.id,
            status:      'active',
            last_sync:   new Date().toISOString(),
            ip_address:  streamUrl.trim() || null
        }

        const { data: existing } = await supabase
            .from('devices').select('*').eq('device_id', cleanId).maybeSingle()

        if (existing) {
            if (existing.patient_id && existing.patient_id !== user.id) {
                setError('This device is already linked to another patient.')
                setLinking(false); return
            }
            await supabase.from('devices').update(payload).eq('id', existing.id)
            setDevice({ ...existing, ...payload })
        } else {
            const { data } = await supabase.from('devices').insert([payload]).select().maybeSingle()
            setDevice(data)
        }
        setLinking(false)
    }

    // ── Unlink device ─────────────────────────────────────────────────────────
    async function handleUnlink() {
        if (!device) return
        clearInterval(simRef.current)
        await supabase.from('devices')
            .update({ status: 'inactive', patient_id: null })
            .eq('id', device.id)
        setDevice(null); setVitals(null)
        setIsSimulating(false); setConnStatus('idle')
        setHistory([])
    }

    // ── Status pill ───────────────────────────────────────────────────────────
    function StatusPill() {
        if (isSimulating) return (
            <span style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#f59e0b', fontSize:'0.8125rem', fontWeight:700 }}>
                <Zap size={13} /> Simulation Mode
            </span>
        )
        if (connStatus === 'live') return (
            <span style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#22c55e', fontSize:'0.8125rem', fontWeight:700 }}>
                <span className="live-dot" /> Live Stream
            </span>
        )
        if (connStatus === 'error') return (
            <span style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#ef4444', fontSize:'0.8125rem', fontWeight:700 }}>
                <AlertTriangle size={13} /> Connection Error
            </span>
        )
        return (
            <span style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'var(--gray-400)', fontSize:'0.8125rem', fontWeight:700 }}>
                <RefreshCw size={13} className="spin" /> Awaiting Bridge...
            </span>
        )
    }

    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div className="header-info">
                        <h1 className="page-title">Device Monitor</h1>
                        <p className="page-subtitle">Live biometric telemetry via network stream</p>
                    </div>
                </div>

                <div className="page-content">
                    {!device ? (
                        /* ── Link device ────────────────────────────────── */
                        <div style={{ maxWidth: 560, margin: '2rem auto' }}>
                            <div className="glass-panel section-container">
                                {/* Icon */}
                                <div style={{ textAlign:'center', padding:'2rem 1rem 1rem' }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '24px',
                                        background: 'rgba(56,189,248,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 1.25rem',
                                        border: '1px solid rgba(56,189,248,0.2)'
                                    }}>
                                        <WifiOff size={36} style={{ color:'var(--secondary-color)' }} />
                                    </div>
                                    <h3 style={{ fontSize:'1.4rem', fontWeight:800, marginBottom:'0.4rem' }}>
                                        Connect Your Device
                                    </h3>
                                    <p style={{ color:'var(--gray-500)', fontSize:'0.9375rem', lineHeight:1.6 }}>
                                        Enter your device ID and the IP address where it broadcasts JSON data on your local network.
                                    </p>
                                </div>

                                <form onSubmit={handleLink} style={{ display:'flex', flexDirection:'column', gap:'1.25rem', padding:'1.25rem' }}>
                                    {/* Device ID */}
                                    <div className="form-group">
                                        <label className="form-label">Device ID</label>
                                        <div style={{ position:'relative' }}>
                                            <input
                                                id="device-id-input"
                                                className="form-input"
                                                placeholder="e.g. HEALTH01, MC-0006"
                                                style={{ paddingLeft:'3rem' }}
                                                value={deviceId}
                                                onChange={e => { setDeviceId(e.target.value); setError('') }}
                                            />
                                            <Cpu size={17} style={{ position:'absolute', left:'1.1rem', top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }} />
                                        </div>
                                        <p style={{ fontSize:'0.8rem', color:'var(--gray-400)', marginTop:'0.4rem' }}>
                                            Printed on the device label (e.g. HEALTH01)
                                        </p>
                                    </div>

                                    {/* Stream URL */}
                                    <div className="form-group">
                                        <label className="form-label">Device Network Address (IP / URL)</label>
                                        <div style={{ position:'relative' }}>
                                            <input
                                                id="device-stream-url-input"
                                                className="form-input"
                                                placeholder="e.g. http://192.168.1.42/data"
                                                style={{ paddingLeft:'3rem' }}
                                                value={streamUrl}
                                                onChange={e => setStreamUrl(e.target.value)}
                                            />
                                            <Wifi size={17} style={{ position:'absolute', left:'1.1rem', top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }} />
                                        </div>
                                        <p style={{ fontSize:'0.8rem', color:'var(--gray-400)', marginTop:'0.4rem' }}>
                                            The URL where your device serves JSON (same Wi-Fi network)
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="alert alert-error" style={{ fontSize:'0.875rem' }}>
                                            <AlertTriangle size={15} /> {error}
                                        </div>
                                    )}

                                    {/* HTTPS warning */}
                                    {window.location.protocol === 'https:' && (
                                        <div className="glass-panel" style={{
                                            padding:'1.25rem', background:'rgba(251,191,36,0.04)',
                                            border:'1px solid rgba(251,191,36,0.2)', borderRadius:12
                                        }}>
                                            <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem' }}>
                                                <Shield size={18} style={{ color:'#f59e0b', flexShrink:0, marginTop:2 }} />
                                                <div>
                                                    <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#92400e', marginBottom:'0.4rem' }}>
                                                        Bridge Server Required
                                                    </div>
                                                    <p style={{ fontSize:'0.8125rem', color:'var(--gray-600)', lineHeight:1.55, marginBottom:'0.75rem' }}>
                                                        Because this site uses HTTPS, browsers block direct HTTP requests to local devices.
                                                        Run the <strong>medicrew-bridge</strong> server on your computer to relay data via Supabase Realtime.
                                                    </p>
                                                    <code style={{ fontSize:'0.75rem', background:'rgba(0,0,0,0.06)', padding:'0.25rem 0.5rem', borderRadius:6, display:'block' }}>
                                                        cd medicrew-bridge &amp;&amp; npm install &amp;&amp; npm start
                                                    </code>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                style={{ width:'100%', justifyContent:'center', marginTop:'1rem' }}
                                                onClick={() => {
                                                    setDevice({ device_id:'SIMULATOR', status:'active' })
                                                    setIsSimulating(true)
                                                }}
                                            >
                                                <Zap size={14} /> Use Simulator Instead
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        id="link-device-btn"
                                        className="btn btn-primary"
                                        style={{ height:'3.25rem', fontSize:'1rem' }}
                                        disabled={linking}
                                    >
                                        {linking
                                            ? <><RefreshCw size={18} className="spin" /> Linking...</>
                                            : <><Link2 size={18} /> Establish Link</>}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        /* ── Device connected — live view ───────────────── */
                        <div className="animate-fade-in">
                            {/* Header bar */}
                            <div className="glass-panel" style={{
                                padding:'1.25rem 1.5rem', marginBottom:'1.75rem',
                                display:'flex', alignItems:'center', justifyContent:'space-between',
                                flexWrap:'wrap', gap:'1rem'
                            }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
                                    <div style={{
                                        width:52, height:52, borderRadius:'14px',
                                        background: connStatus === 'live' ? 'rgba(34,197,94,0.1)' : 'rgba(56,189,248,0.1)',
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        border:`1px solid ${connStatus === 'live' ? 'rgba(34,197,94,0.25)' : 'rgba(56,189,248,0.2)'}`
                                    }}>
                                        <Cpu size={26} style={{ color: connStatus === 'live' ? '#22c55e' : 'var(--secondary-color)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight:800, fontSize:'1.0625rem', color:'var(--gray-900)' }}>
                                            {isSimulating ? 'Clinical Simulator' : `Device: ${device.device_id}`}
                                        </div>
                                        <StatusPill />
                                    </div>
                                </div>

                                <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
                                    <div style={{ textAlign:'right' }}>
                                        <div style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--gray-400)', fontWeight:700 }}>
                                            Last Reading
                                        </div>
                                        <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--gray-700)' }}>
                                            {vitals ? new Date(vitals.recorded_at).toLocaleTimeString() : '--:--:--'}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ color:'var(--danger-color)', gap:'0.4rem' }}
                                        onClick={handleUnlink}
                                        id="unlink-device-btn"
                                    >
                                        <X size={15} /> Disconnect
                                    </button>
                                </div>
                            </div>

                            {/* How data flows – shown when awaiting first reading */}
                            {!vitals && !isSimulating && (
                                <div className="glass-panel" style={{
                                    padding:'1.5rem', marginBottom:'1.75rem',
                                    background:'rgba(56,189,248,0.03)', border:'1px solid rgba(56,189,248,0.15)'
                                }}>
                                    <h3 style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1rem', color:'var(--secondary-color)' }}>
                                        ⚡ Waiting for bridge server to send data...
                                    </h3>
                                    <p style={{ color:'var(--gray-600)', fontSize:'0.875rem', marginBottom:'1rem' }}>
                                        Make sure the bridge is running on the same network as your device:
                                    </p>
                                    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                                        {[
                                            '1. Open medicrew-bridge/ folder',
                                            '2. Copy .env.example → .env and fill in your device IP',
                                            '3. Run: npm install && npm start',
                                            `4. The bridge will push JSON from ${streamUrl || 'your device'} to this screen every 3s`
                                        ].map((step, i) => (
                                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', fontSize:'0.875rem' }}>
                                                <CheckCircle size={15} style={{ color:'var(--secondary-color)', flexShrink:0 }} />
                                                <span style={{ color:'var(--gray-700)' }}>{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Vital cards */}
                            <div style={{
                                display:'grid',
                                gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',
                                gap:'1.25rem',
                                marginBottom:'1.75rem'
                            }}>
                                {VITALS_CONFIG.map(cfg => {
                                    const Icon = cfg.icon
                                    const raw  = vitals?.[cfg.key]
                                    const hasValue = raw !== null && raw !== undefined && raw !== '--'
                                    const isOk = hasValue ? cfg.normal(raw) : null

                                    return (
                                        <div
                                            key={cfg.key}
                                            className={pulse ? 'pulse' : ''}
                                            style={{
                                                background: cfg.bg,
                                                border: `1px solid ${cfg.border}`,
                                                borderRadius: 18,
                                                padding: '1.5rem 1.25rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.5rem',
                                                transition: 'box-shadow 0.3s'
                                            }}
                                        >
                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                                <Icon size={22} style={{ color: cfg.color }} />
                                                {hasValue && (
                                                    <span style={{
                                                        fontSize:'0.7rem', fontWeight:700, padding:'0.2rem 0.6rem',
                                                        borderRadius:99, background: isOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                        color: isOk ? '#16a34a' : '#dc2626'
                                                    }}>
                                                        {isOk ? 'Normal' : 'Alert'}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--gray-900)', letterSpacing:'-0.02em' }}>
                                                {hasValue ? raw : <span style={{ color:'var(--gray-300)', fontSize:'1.5rem' }}>—</span>}
                                                {hasValue && <span style={{ fontSize:'1rem', fontWeight:500, color:'var(--gray-400)', marginLeft:'0.25rem' }}>{cfg.unit}</span>}
                                            </div>
                                            <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--gray-500)' }}>
                                                {cfg.label}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Recent readings history */}
                            {history.length > 1 && (
                                <div className="glass-panel section-container">
                                    <div className="section-header">
                                        <Activity size={18} style={{ color:'var(--secondary-color)' }} />
                                        <h2 className="section-title">Recent Readings</h2>
                                    </div>
                                    <div className="table-wrapper">
                                        <table className="ethereal-table">
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>Heart Rate</th>
                                                    <th>Temp</th>
                                                    <th>SpO₂</th>
                                                    <th>BP</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map((r, i) => (
                                                    <tr key={i}>
                                                        <td><span className="timestamp">{new Date(r.recorded_at).toLocaleTimeString()}</span></td>
                                                        <td>{r.heart_rate ?? '—'} <span style={{ color:'var(--gray-400)', fontSize:'0.75rem' }}>bpm</span></td>
                                                        <td>{r.temperature ?? '—'} <span style={{ color:'var(--gray-400)', fontSize:'0.75rem' }}>°C</span></td>
                                                        <td>{r.spo2 ?? '—'} <span style={{ color:'var(--gray-400)', fontSize:'0.75rem' }}>%</span></td>
                                                        <td>{r.blood_pressure ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="glass-panel" style={{
                                padding:'1rem 1.25rem', marginTop:'1rem',
                                display:'flex', alignItems:'center', gap:'1rem',
                                background:'rgba(255,255,255,0.35)'
                            }}>
                                <div style={{
                                    width:38, height:38, borderRadius:10,
                                    background:'var(--gray-900)',
                                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                                }}>
                                    <RefreshCw size={16} style={{ color:'white' }} className={vitals ? 'spin' : ''} />
                                </div>
                                <div>
                                    <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--gray-900)' }}>
                                        {isSimulating ? 'Simulation Active — 3s refresh' : 'Realtime Sync via Supabase'}
                                    </div>
                                    <p style={{ fontSize:'0.78rem', color:'var(--gray-500)' }}>
                                        {isSimulating
                                            ? 'Generating synthetic vital signs. Connect the bridge to use real device data.'
                                            : `Bridge server pushes JSON readings from ${device.ip_address || 'your device'} to this screen instantly.`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
