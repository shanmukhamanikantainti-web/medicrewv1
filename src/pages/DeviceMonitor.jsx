import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    Cpu, Link2, WifiOff, Activity, RefreshCw,
    Zap, AlertTriangle, Heart, Droplet, Gauge, X,
    Thermometer, Radio, CheckCircle, Search
} from 'lucide-react'

// ── Simulator fallback ────────────────────────────────────────────────────────
function generateSimVitals() {
    return {
        heart_rate:     Math.floor(Math.random() * 20 + 68),
        temperature:    parseFloat((Math.random() * 1.5 + 36.4).toFixed(1)),
        spo2:           Math.floor(Math.random() * 3 + 96),
        blood_pressure: `${Math.floor(Math.random() * 20 + 110)}/${Math.floor(Math.random() * 10 + 72)}`,
        recorded_at:    new Date().toISOString(),
        _simulated:     true
    }
}

// ── Vitals config ─────────────────────────────────────────────────────────────
const VITALS = [
    { key:'heart_rate',     label:'Heart Rate',     unit:'bpm',  icon:Heart,       color:'#ef4444', bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)',  normal:v=>v>=50&&v<=110 },
    { key:'temperature',    label:'Temperature',    unit:'°C',   icon:Thermometer, color:'#f97316', bg:'rgba(249,115,22,0.08)', border:'rgba(249,115,22,0.2)', normal:v=>parseFloat(v)>=36&&parseFloat(v)<=37.5 },
    { key:'spo2',           label:'Blood Oxygen',   unit:'%',    icon:Droplet,     color:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)', normal:v=>v>=95 },
    { key:'blood_pressure', label:'Blood Pressure', unit:'mmHg', icon:Gauge,       color:'#8b5cf6', bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.2)', normal:()=>true },
]

export default function DeviceMonitor() {
    const { user } = useAuth()
    const [device,       setDevice]       = useState(null)
    const [deviceId,     setDeviceId]     = useState('')
    const [vitals,       setVitals]       = useState(null)
    const [linking,      setLinking]      = useState(false)
    const [error,        setError]        = useState('')
    const [pulse,        setPulse]        = useState(false)
    const [isSimulating, setIsSimulating] = useState(false)
    const [connStatus,   setConnStatus]   = useState('idle')
    const [history,      setHistory]      = useState([])
    const simRef = useRef(null)

    // ── Load linked device ───────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return
        supabase
            .from('devices').select('*')
            .eq('patient_id', user.id).eq('status', 'active')
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setDevice(data)
                    if (data.device_id === 'SIMULATOR') setIsSimulating(true)
                }
            })
    }, [user])

    // ── Supabase Realtime — live readings from bridge ────────────────────────
    useEffect(() => {
        if (!device || isSimulating) return
        setConnStatus('idle')

        const channel = supabase
            .channel(`readings-${device.device_id}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'device_readings',
                filter: `device_id=eq.${device.device_id}`
            }, (payload) => {
                const r = payload.new
                setVitals(r)
                setConnStatus('live')
                setError('')
                setPulse(true)
                setTimeout(() => setPulse(false), 600)
                setHistory(prev => [r, ...prev].slice(0, 8))
                supabase.from('devices').update({ last_sync: new Date().toISOString() }).eq('id', device.id)
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') fetchLatestReading(device.device_id)
                if (status === 'CHANNEL_ERROR') {
                    setConnStatus('error')
                    setError('Realtime connection failed.')
                }
            })

        return () => { supabase.removeChannel(channel) }
    }, [device, isSimulating])

    // ── Simulator ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isSimulating) { clearInterval(simRef.current); return }
        const tick = () => {
            const v = generateSimVitals()
            setVitals(v); setConnStatus('live')
            setPulse(true); setTimeout(() => setPulse(false), 600)
            setHistory(prev => [v, ...prev].slice(0, 8))
        }
        tick()
        simRef.current = setInterval(tick, 3000)
        return () => clearInterval(simRef.current)
    }, [isSimulating])

    // ── Fetch latest from DB ──────────────────────────────────────────────────
    const fetchLatestReading = useCallback(async (devId) => {
        const { data } = await supabase
            .from('device_readings').select('*')
            .eq('device_id', devId)
            .order('recorded_at', { ascending: false }).limit(8)
        if (data?.length) { setVitals(data[0]); setHistory(data); setConnStatus('live') }
    }, [])

    // ── Link device (only needs Device ID — no IP!) ──────────────────────────
    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        const cleanId = deviceId.trim().toUpperCase()
        const payload = {
            device_id: cleanId, patient_id: user.id,
            status: 'active', last_sync: new Date().toISOString()
        }

        const { data: existing } = await supabase
            .from('devices').select('*').eq('device_id', cleanId).maybeSingle()

        if (existing) {
            if (existing.patient_id && existing.patient_id !== user.id) {
                setError('This device is linked to another patient.')
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

    // ── Unlink ────────────────────────────────────────────────────────────────
    async function handleUnlink() {
        if (!device) return
        clearInterval(simRef.current)
        await supabase.from('devices').update({ status:'inactive', patient_id:null }).eq('id', device.id)
        setDevice(null); setVitals(null); setIsSimulating(false)
        setConnStatus('idle'); setHistory([])
    }

    // ── Status pill component ─────────────────────────────────────────────────
    function StatusPill() {
        const styles = { display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.8125rem', fontWeight:700 }
        if (isSimulating) return <span style={{ ...styles, color:'#f59e0b' }}><Zap size={13}/> Simulation</span>
        if (connStatus === 'live') return <span style={{ ...styles, color:'#22c55e' }}><span className="live-dot"/> Live Stream</span>
        if (connStatus === 'error') return <span style={{ ...styles, color:'#ef4444' }}><AlertTriangle size={13}/> Error</span>
        return <span style={{ ...styles, color:'var(--gray-400)' }}><Search size={13} className="spin"/> Awaiting Bridge...</span>
    }

    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div className="header-info">
                        <h1 className="page-title">Device Monitor</h1>
                        <p className="page-subtitle">Live biometric telemetry — auto-detected from your network</p>
                    </div>
                </div>

                <div className="page-content">
                    {!device ? (
                        /* ═══ LINK SCREEN — only asks for Device ID ═══ */
                        <div style={{ maxWidth:520, margin:'2rem auto' }}>
                            <div className="glass-panel section-container">
                                <div style={{ textAlign:'center', padding:'2rem 1.5rem 1rem' }}>
                                    <div style={{
                                        width:80, height:80, borderRadius:'24px',
                                        background:'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(139,92,246,0.12))',
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        margin:'0 auto 1.25rem',
                                        border:'1px solid rgba(56,189,248,0.2)'
                                    }}>
                                        <Radio size={36} style={{ color:'var(--secondary-color)' }} />
                                    </div>
                                    <h3 style={{ fontSize:'1.5rem', fontWeight:800, marginBottom:'0.4rem' }}>Connect Your Device</h3>
                                    <p style={{ color:'var(--gray-500)', fontSize:'0.9375rem', lineHeight:1.6 }}>
                                        Enter your device ID. The bridge server will <strong>automatically find it</strong> on your network — no IP address needed.
                                    </p>
                                </div>

                                <form onSubmit={handleLink} style={{ display:'flex', flexDirection:'column', gap:'1.25rem', padding:'0 1.5rem 1.5rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Device ID</label>
                                        <div style={{ position:'relative' }}>
                                            <input
                                                id="device-id-input"
                                                className="form-input"
                                                placeholder="e.g. HEALTH01"
                                                style={{ paddingLeft:'3rem', fontSize:'1.0625rem', fontWeight:600, letterSpacing:'0.02em' }}
                                                value={deviceId}
                                                onChange={e => { setDeviceId(e.target.value.toUpperCase()); setError('') }}
                                            />
                                            <Cpu size={17} style={{ position:'absolute', left:'1.1rem', top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }} />
                                        </div>
                                        <p style={{ fontSize:'0.8rem', color:'var(--gray-400)', marginTop:'0.4rem' }}>
                                            Found on the label printed on your device
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="alert alert-error" style={{ fontSize:'0.875rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                            <AlertTriangle size={15}/> {error}
                                        </div>
                                    )}

                                    {/* How it works */}
                                    <div style={{
                                        background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.12)',
                                        borderRadius:14, padding:'1.25rem'
                                    }}>
                                        <div style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--gray-700)', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                            <Activity size={15} style={{ color:'var(--secondary-color)' }}/> How it works
                                        </div>
                                        {[
                                            'Your device broadcasts JSON data on the local network',
                                            'The bridge server auto-scans and finds it',
                                            'Values are pushed to the cloud in real-time',
                                            'This screen updates instantly — no manual IP needed'
                                        ].map((s, i) => (
                                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem', fontSize:'0.8125rem', color:'var(--gray-600)', marginBottom:'0.35rem' }}>
                                                <CheckCircle size={13} style={{ color:'#22c55e', flexShrink:0 }}/> {s}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Bridge setup hint */}
                                    <div style={{
                                        background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.15)',
                                        borderRadius:14, padding:'1rem 1.25rem', fontSize:'0.8125rem', color:'var(--gray-600)'
                                    }}>
                                        <strong style={{ color:'#92400e' }}>Setup:</strong> Run the bridge server on the same Wi-Fi as your device:
                                        <code style={{ display:'block', marginTop:'0.5rem', background:'rgba(0,0,0,0.06)', padding:'0.4rem 0.6rem', borderRadius:8, fontSize:'0.75rem' }}>
                                            cd medicrew-bridge &amp;&amp; npm install &amp;&amp; npm start
                                        </code>
                                    </div>

                                    {/* Simulator fallback */}
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ justifyContent:'center' }}
                                        onClick={() => {
                                            setDevice({ device_id:'SIMULATOR', status:'active' })
                                            setIsSimulating(true)
                                        }}
                                    >
                                        <Zap size={15}/> Use Simulator (Demo Mode)
                                    </button>

                                    <button
                                        type="submit" id="link-device-btn"
                                        className="btn btn-primary"
                                        style={{ height:'3.25rem', fontSize:'1rem' }}
                                        disabled={linking}
                                    >
                                        {linking ? <><RefreshCw size={18} className="spin"/> Linking...</> : <><Link2 size={18}/> Connect Device</>}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        /* ═══ LIVE MONITORING VIEW ═══ */
                        <div className="animate-fade-in">
                            {/* Header */}
                            <div className="glass-panel" style={{
                                padding:'1.25rem 1.5rem', marginBottom:'1.5rem',
                                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem'
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
                                        <div style={{ fontWeight:800, fontSize:'1.0625rem' }}>
                                            {isSimulating ? 'Clinical Simulator' : `Device: ${device.device_id}`}
                                        </div>
                                        <StatusPill />
                                    </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
                                    <div style={{ textAlign:'right' }}>
                                        <div style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--gray-400)', fontWeight:700 }}>Last Reading</div>
                                        <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--gray-700)' }}>
                                            {vitals ? new Date(vitals.recorded_at).toLocaleTimeString() : '--:--:--'}
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost" style={{ color:'var(--danger-color)', gap:'0.4rem' }} onClick={handleUnlink} id="unlink-btn">
                                        <X size={15}/> Disconnect
                                    </button>
                                </div>
                            </div>

                            {/* Waiting for first reading */}
                            {!vitals && !isSimulating && (
                                <div className="glass-panel" style={{
                                    padding:'1.5rem', marginBottom:'1.5rem', textAlign:'center',
                                    background:'rgba(56,189,248,0.03)', border:'1px solid rgba(56,189,248,0.15)'
                                }}>
                                    <Search size={36} className="spin" style={{ color:'var(--secondary-color)', marginBottom:'1rem' }} />
                                    <h3 style={{ fontWeight:700, marginBottom:'0.5rem' }}>Scanning your network for device...</h3>
                                    <p style={{ color:'var(--gray-500)', fontSize:'0.875rem', maxWidth:400, margin:'0 auto' }}>
                                        Make sure the bridge server is running. It will automatically find your device and start streaming values here.
                                    </p>
                                </div>
                            )}

                            {/* Vital cards */}
                            <div style={{
                                display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))',
                                gap:'1.25rem', marginBottom:'1.5rem'
                            }}>
                                {VITALS.map(cfg => {
                                    const Icon = cfg.icon
                                    const raw = vitals?.[cfg.key]
                                    const has = raw != null && raw !== '--'
                                    const ok = has ? cfg.normal(raw) : null

                                    return (
                                        <div key={cfg.key} className={pulse ? 'pulse' : ''} style={{
                                            background: cfg.bg, border:`1px solid ${cfg.border}`,
                                            borderRadius:18, padding:'1.5rem 1.25rem',
                                            display:'flex', flexDirection:'column', gap:'0.5rem',
                                            transition:'box-shadow 0.3s, transform 0.3s'
                                        }}>
                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                                <Icon size={22} style={{ color:cfg.color }} />
                                                {has && (
                                                    <span style={{
                                                        fontSize:'0.7rem', fontWeight:700, padding:'0.2rem 0.6rem', borderRadius:99,
                                                        background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                        color: ok ? '#16a34a' : '#dc2626'
                                                    }}>
                                                        {ok ? 'Normal' : 'Alert'}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize:'2rem', fontWeight:900, letterSpacing:'-0.02em' }}>
                                                {has ? raw : <span style={{ color:'var(--gray-300)', fontSize:'1.5rem' }}>—</span>}
                                                {has && <span style={{ fontSize:'1rem', fontWeight:500, color:'var(--gray-400)', marginLeft:'0.25rem' }}>{cfg.unit}</span>}
                                            </div>
                                            <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--gray-500)' }}>{cfg.label}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* History table */}
                            {history.length > 1 && (
                                <div className="glass-panel section-container">
                                    <div className="section-header">
                                        <Activity size={18} style={{ color:'var(--secondary-color)' }} />
                                        <h2 className="section-title">Recent Readings</h2>
                                    </div>
                                    <div className="table-wrapper">
                                        <table className="ethereal-table">
                                            <thead><tr><th>Time</th><th>HR</th><th>Temp</th><th>SpO₂</th><th>BP</th></tr></thead>
                                            <tbody>
                                                {history.map((r, i) => (
                                                    <tr key={i}>
                                                        <td><span className="timestamp">{new Date(r.recorded_at).toLocaleTimeString()}</span></td>
                                                        <td>{r.heart_rate ?? '—'} <small style={{ color:'var(--gray-400)' }}>bpm</small></td>
                                                        <td>{r.temperature ?? '—'} <small style={{ color:'var(--gray-400)' }}>°C</small></td>
                                                        <td>{r.spo2 ?? '—'} <small style={{ color:'var(--gray-400)' }}>%</small></td>
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
                                display:'flex', alignItems:'center', gap:'1rem', background:'rgba(255,255,255,0.35)'
                            }}>
                                <div style={{
                                    width:38, height:38, borderRadius:10, background:'var(--gray-900)',
                                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                                }}>
                                    <RefreshCw size={16} style={{ color:'white' }} className={vitals ? 'spin' : ''} />
                                </div>
                                <div>
                                    <div style={{ fontWeight:700, fontSize:'0.9rem' }}>
                                        {isSimulating ? 'Simulation Active — 3s refresh' : 'Auto-Sync via Supabase Realtime'}
                                    </div>
                                    <p style={{ fontSize:'0.78rem', color:'var(--gray-500)' }}>
                                        {isSimulating
                                            ? 'Generating synthetic vitals. Run the bridge server for real device data.'
                                            : 'Bridge auto-discovers your device on the network and streams values here instantly.'}
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
