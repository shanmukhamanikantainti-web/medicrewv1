import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    Cpu, Link2, WifiOff, Activity, RefreshCw,
    Zap, AlertTriangle, Heart, Droplet, Gauge, X,
    Thermometer, Radio, CheckCircle, Search, Shield,
    Terminal, Globe, Lock
} from 'lucide-react'

// ── Vitals Configuration ──────────────────────────────────────────────────────
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
    const [connStatus,   setConnStatus]   = useState('idle') // idle | scanning | live | blocked
    const [history,      setHistory]      = useState([])
    const [scanProgress, setScanProgress] = useState(0)
    const [foundIp,      setFoundIp]      = useState(null)
    
    const simRef = useRef(null)
    const scanRef = useRef(false)

    // ── Load Linked Device ───────────────────────────────────────────────────
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

    // ── Supabase Realtime (Live Data listener) ───────────────────────────────
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
                setHistory(prev => [r, ...prev].slice(0, 10))
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') fetchLatestReading(device.device_id)
            })

        return () => { supabase.removeChannel(channel) }
    }, [device, isSimulating])

    // ── Network Scanner Logic (Frontend Discovery) ───────────────────────────
    const scanLocalNetwork = async () => {
        if (scanRef.current) return
        scanRef.current = true
        setConnStatus('scanning')
        setScanProgress(0)
        setError('')

        // Common subnets
        const subnets = ['192.168.1', '192.168.0', '10.54.100', '10.0.0']
        let detected = false

        for (const subnet of subnets) {
            if (detected) break
            for (let i = 1; i < 255; i++) {
                if (!scanRef.current) break
                const ip = `${subnet}.${i}`
                setScanProgress(Math.floor((i / 255) * 100))

                try {
                    // We use image probing to bypass CORS/Fetch restrictions for discovery
                    const probe = new Image()
                    const probePromise = new Promise((resolve, reject) => {
                        probe.onload = () => resolve(true)
                        probe.onerror = () => reject(false)
                        // Most devices serve an icon or empty response at root
                        probe.src = `http://${ip}/favicon.ico?t=${Date.now()}` 
                        setTimeout(() => reject(false), 200) // Fast timeout for discovery
                    })

                    await probePromise
                    console.log(`📡 Device signal detected at ${ip}`)
                    setFoundIp(ip)
                    
                    // Attempt to fetch actual JSON
                    const res = await fetch(`http://${ip}/data`, { mode: 'no-cors' })
                    // Note: 'no-cors' allows the request but hides the body. 
                    // This is enough to know a device exists there.
                    detected = true
                    setConnStatus('live')
                    break
                } catch (e) {
                    // Continue scanning
                }
            }
        }

        if (!detected) {
            setConnStatus('blocked')
            setError('No device auto-detected. Browser security policy (HTTPS) might be blocking local network access.')
        }
        scanRef.current = false
    }

    // ── Actions ──────────────────────────────────────────────────────────────
    const fetchLatestReading = useCallback(async (devId) => {
        const { data } = await supabase
            .from('device_readings').select('*')
            .eq('device_id', devId)
            .order('recorded_at', { ascending: false }).limit(10)
        if (data?.length) { setVitals(data[0]); setHistory(data); setConnStatus('live') }
    }, [])

    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        const cleanId = deviceId.trim().toUpperCase()
        const { data: existing } = await supabase.from('devices').select('*').eq('device_id', cleanId).maybeSingle()

        const payload = { device_id: cleanId, patient_id: user.id, status: 'active', last_sync: new Date().toISOString() }

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
        scanLocalNetwork() // Start scanning immediately after linking
    }

    async function handleUnlink() {
        await supabase.from('devices').update({ status:'inactive', patient_id:null }).eq('id', device.id)
        setDevice(null); setVitals(null); setConnStatus('idle'); setHistory([])
    }

    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div className="header-info">
                        <h1 className="page-title">Direct Device Stream</h1>
                        <p className="page-subtitle">Automatic hardware discovery & real-time biometric mapping</p>
                    </div>
                </div>

                <div className="page-content">
                    {!device ? (
                        /* ── LINKING VIEW ── */
                        <div style={{ maxWidth: 640, margin: '2rem auto' }}>
                            <div className="glass-panel section-container">
                                <div style={{ textAlign:'center', padding:'2.5rem 2rem 1.5rem' }}>
                                    <div className="pulse-icon-container">
                                        <div className="pulse-ring"></div>
                                        <div className="pulse-ring" style={{ animationDelay: '1s' }}></div>
                                        <Radio size={40} className="pulse-icon" />
                                    </div>
                                    <h3 style={{ fontSize:'1.8rem', fontWeight:800, marginBottom:'0.5rem', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        Zero-Setup Connectivity
                                    </h3>
                                    <p style={{ color:'var(--gray-500)', fontSize:'1rem', lineHeight:1.6, maxWidth: 450, margin: '0 auto' }}>
                                        MediCrew now scans your local network automatically. Simply enter your Device ID to begin secure telemetry mapping.
                                    </p>
                                </div>

                                <form onSubmit={handleLink} style={{ padding:'0 2rem 2.5rem' }}>
                                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>Device ID (Health Badge Code)</label>
                                        <div style={{ position:'relative' }}>
                                            <input
                                                className="form-input"
                                                placeholder="e.g. MEDICREW-X1"
                                                style={{ height:'4rem', fontSize:'1.25rem', fontWeight:800, paddingLeft:'4rem', borderRadius: 16, border: '2px solid rgba(0,0,0,0.05)' }}
                                                value={deviceId}
                                                onChange={e => setDeviceId(e.target.value.toUpperCase())}
                                            />
                                            <Cpu size={24} style={{ position:'absolute', left:'1.25rem', top:'50%', transform:'translateY(-50%)', color:'var(--secondary-color)' }} />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="alert alert-error" style={{ marginBottom: '1.5rem', borderRadius: 12 }}>
                                            <AlertTriangle size={18} /> {error}
                                        </div>
                                    )}

                                    <button type="submit" className="btn btn-primary" style={{ height:'4rem', fontSize:'1.1rem', width: '100%', borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)' }} disabled={linking}>
                                        {linking ? <><RefreshCw className="spin" /> Syncing Cloud Registry...</> : <><Shield size={20} /> Establish Secure Connection</>}
                                    </button>

                                    <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                            <Globe size={18} style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }} />
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Network Scanning</div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>Auto-detects device IP on your subnet.</p>
                                        </div>
                                        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                            <Lock size={18} style={{ color: '#8b5cf6', marginBottom: '0.5rem' }} />
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>P2P Retrieval</div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>Direct browser-to-hardware retrieval.</p>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        /* ── LIVE AUTO-DETECT VIEW ── */
                        <div className="animate-fade-in">
                            {/* Connection Radar Overlay */}
                            {connStatus === 'scanning' && (
                                <div className="glass-panel section-container" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--secondary-color)', background: 'rgba(56, 189, 248, 0.02)' }}>
                                    <div className="radar-container">
                                        <div className="radar-sweep"></div>
                                        <div className="radar-dot" style={{ top: '30%', left: '70%', animationDelay: '0.5s' }}></div>
                                        <div className="radar-dot" style={{ top: '60%', left: '20%', animationDelay: '1.2s' }}></div>
                                        <Search size={40} className="radar-icon" />
                                    </div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2rem' }}>Scanning Local Network...</h2>
                                    <p style={{ color: 'var(--gray-500)', maxWidth: 400, margin: '1rem auto' }}>
                                        System is automatically probing your network for device <strong>{device.device_id}</strong>.
                                    </p>
                                    <div className="progress-bar-container" style={{ maxWidth: 300, margin: '2rem auto' }}>
                                        <div className="progress-bar-fill" style={{ width: `${scanProgress}%` }}></div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', fontWeight: 600 }}>PROBING SUBNET: 10.54.100.X ({scanProgress}%)</div>
                                </div>
                            )}

                            {/* Blocked / Troubleshooting View */}
                            {connStatus === 'blocked' && (
                                <div className="glass-panel section-container" style={{ padding: '2rem' }}>
                                    <div style={{ display:'flex', gap:'2rem', alignItems:'flex-start' }}>
                                        <div style={{ background:'rgba(239, 68, 68, 0.1)', padding:'1.5rem', borderRadius:20, color:'#ef4444' }}>
                                            <Shield size={48} />
                                        </div>
                                        <div style={{ flex:1 }}>
                                            <h2 style={{ fontSize:'1.5rem', fontWeight:800, marginBottom:'0.5rem' }}>Browser Security Blocked Device Access</h2>
                                            <p style={{ color:'var(--gray-500)', marginBottom:'1.5rem' }}>
                                                Because MediCrew uses a secure HTTPS connection, the browser blocks direct retrieval from your local network device (HTTP) for privacy.
                                            </p>
                                            
                                            <div style={{ background:'var(--gray-50)', padding:'1.5rem', borderRadius:16, border:'1px solid var(--gray-200)', marginBottom:'1.5rem' }}>
                                                <h4 style={{ fontWeight:800, marginBottom:'1rem', fontSize:'0.9rem', textTransform:'uppercase', color:'var(--gray-700)' }}>Choose your solution:</h4>
                                                
                                                <div style={{ display:'grid', gap:'1rem' }}>
                                                    {/* Solution 1: Chrome Allow */}
                                                    <div className="troubleshoot-step">
                                                        <div className="step-badge">1</div>
                                                        <div className="step-content">
                                                            <strong>Browser Level: Allow Insecure Content</strong>
                                                            <p>Click the <strong>Shield/Lock</strong> icon in the address bar → <strong>Site Settings</strong> → Set <strong>Insecure Content</strong> to <strong>Allow</strong>.</p>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()} style={{ marginTop:'0.5rem' }}>
                                                                <RefreshCw size={14} /> Refresh to Apply
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Solution 2: Arduino Direct Cloud */}
                                                    <div className="troubleshoot-step">
                                                        <div className="step-badge">2</div>
                                                        <div className="step-content">
                                                            <strong>Hardware Level: Direct-to-Cloud (Best)</strong>
                                                            <p>Update your device code to push directly to our cloud. No browser settings needed.</p>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                                                const code = `#include <HTTPClient.h>\nvoid pushVitals(int hr, float temp) {\n  HTTPClient http;\n  http.begin("https://raroozindajlweijpxnw.supabase.co/rest/v1/device_readings");\n  http.addHeader("apikey", "YOUR_ANON_KEY");\n  http.POST("{\\"device_id\\":\\"HEALTH01\\",\\"heart_rate\\":72}");\n}`;
                                                                navigator.clipboard.writeText(code);
                                                                alert('Arduino C++ snippet copied to clipboard!');
                                                            }}>
                                                                <Terminal size={14} /> Copy Arduino Snippet
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button className="btn btn-primary" onClick={scanLocalNetwork}>
                                                <RefreshCw size={18} /> Retry Discovery
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live Data Dashboard */}
                            {(connStatus === 'live' || vitals) && (
                                <div className="animate-fade-in">
                                    {/* Header Status Bar */}
                                    <div className="glass-panel" style={{ padding:'1.25rem 2rem', marginBottom:'1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:20 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
                                            <div className="status-orb-container">
                                                <div className="status-orb" style={{ background: '#22c55e' }}></div>
                                                <div className="status-orb-ping" style={{ background: '#22c55e' }}></div>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight:900, fontSize:'1.1rem' }}>{device.device_id}</div>
                                                <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--gray-400)', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                                                    <Globe size={12} /> Active at {foundIp || 'Linked Registry'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display:'flex', gap:'1rem' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={scanLocalNetwork}>
                                                <Search size={14} /> Re-Scan Network
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={handleUnlink} style={{ color:'var(--danger-color)' }}>
                                                <X size={14} /> Disconnect
                                            </button>
                                        </div>
                                    </div>

                                    {/* Vital Cards Grid */}
                                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'1.5rem', marginBottom:'2rem' }}>
                                        {VITALS.map(cfg => {
                                            const Icon = cfg.icon;
                                            const val = vitals?.[cfg.key];
                                            const isNormal = val ? cfg.normal(val) : true;
                                            return (
                                                <div key={cfg.key} className={`vital-card-premium ${pulse ? 'pulse-heavy' : ''}`} style={{ 
                                                    background: cfg.bg, 
                                                    border: `1px solid ${cfg.border}`,
                                                    borderRadius: 24,
                                                    padding: '2rem',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div className="card-bg-icon">
                                                        <Icon size={120} style={{ opacity: 0.03, color: cfg.color }} />
                                                    </div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: '1.5rem' }}>
                                                        <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                                            <Icon size={24} style={{ color: cfg.color }} />
                                                        </div>
                                                        <div style={{ 
                                                            fontSize: '0.75rem', fontWeight: 800, padding: '4px 12px', borderRadius: 20,
                                                            background: isNormal ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: isNormal ? '#16a34a' : '#ef4444'
                                                        }}>
                                                            {isNormal ? 'OPTIMAL' : 'ATTENTION'}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--gray-900)', letterSpacing: '-0.05em', lineHeight: 1 }}>
                                                        {val || '--'}
                                                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)', marginLeft: '4px' }}>{cfg.unit}</span>
                                                    </div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-500)', marginTop: '0.5rem' }}>{cfg.label}</div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Real-time Telemetry Log */}
                                    <div className="glass-panel section-container">
                                        <div className="section-header">
                                            <Terminal size={18} style={{ color: 'var(--secondary-color)' }} />
                                            <h2 className="section-title">Telemetry Stream Log</h2>
                                        </div>
                                        <div className="table-wrapper">
                                            <table className="ethereal-table">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>Heart Rate</th>
                                                        <th>SpO₂</th>
                                                        <th>Temp</th>
                                                        <th>Signal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {history.map((r, i) => (
                                                        <tr key={i} className="log-row">
                                                            <td><span className="timestamp-mono">{new Date(r.recorded_at).toLocaleTimeString()}</span></td>
                                                            <td><span style={{ fontWeight:700 }}>{r.heart_rate}</span> <small>bpm</small></td>
                                                            <td><span style={{ fontWeight:700 }}>{r.spo2}%</span></td>
                                                            <td><span style={{ fontWeight:700 }}>{r.temperature}°C</span></td>
                                                            <td><div className="signal-bars"><div className="bar active"></div><div className="bar active"></div><div className="bar active"></div><div className="bar"></div></div></td>
                                                        </tr>
                                                    ))}
                                                    {history.length === 0 && (
                                                        <tr><td colSpan="5" style={{ textAlign:'center', color:'var(--gray-400)', padding:'3rem' }}>No data packets captured yet...</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <style>{`
                .pulse-icon-container { position: relative; width: 100px; height: 100px; margin: 0 auto 2rem; display: flex; alignItems: center; justifyContent: center; }
                .pulse-icon { color: var(--secondary-color); z-index: 2; }
                .pulse-ring { position: absolute; width: 100%; height: 100%; border: 3px solid var(--secondary-color); border-radius: 50%; opacity: 0; animation: ping-circle 2s cubic-bezier(0,0,0.2,1) infinite; }
                @keyframes ping-circle { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
                
                .radar-container { position: relative; width: 120px; height: 120px; margin: 0 auto; border: 2px solid rgba(56, 189, 248, 0.2); border-radius: 50%; display: flex; alignItems: center; justifyContent: center; overflow: hidden; }
                .radar-sweep { position: absolute; width: 50%; height: 50%; background: linear-gradient(45deg, var(--secondary-color), transparent); top: 0; left: 50%; transform-origin: left bottom; animation: sweep 2s linear infinite; }
                @keyframes sweep { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .radar-dot { position: absolute; width: 6px; height: 6px; background: var(--secondary-color); border-radius: 50%; box-shadow: 0 0 10px var(--secondary-color); animation: blink 1s infinite alternate; }
                @keyframes blink { from { opacity: 0; } to { opacity: 1; } }
                .radar-icon { color: var(--secondary-color); z-index: 5; }

                .troubleshoot-step { display: flex; gap: 1rem; padding: 1rem; border-radius: 12px; transition: background 0.2s; }
                .troubleshoot-step:hover { background: rgba(0,0,0,0.02); }
                .step-badge { width: 28px; height: 28px; borderRadius: 50%; background: var(--gray-900); color: white; display: flex; alignItems: center; justifyContent: center; fontSize: 0.8rem; fontWeight: 800; flexShrink: 0; }
                .step-content p { font-size: 0.8rem; color: var(--gray-500); margin-top: 0.25rem; line-height: 1.4; }

                .vital-card-premium { transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s; }
                .vital-card-premium:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
                .card-bg-icon { position: absolute; bottom: -20px; right: -20px; transform: rotate(-15deg); pointer-events: none; }
                
                .pulse-heavy { animation: pulse-container 0.6s ease-in-out; }
                @keyframes pulse-container { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }

                .status-orb-container { position: relative; width: 12px; height: 12px; }
                .status-orb { width: 100%; height: 100%; border-radius: 50%; }
                .status-orb-ping { position: absolute; top:0; left:0; width: 100%; height: 100%; border-radius: 50%; animation: ping-orb 1.5s infinite; }
                @keyframes ping-orb { from { transform: scale(1); opacity: 0.8; } to { transform: scale(3); opacity: 0; } }

                .signal-bars { display: flex; gap: 3px; align-items: flex-end; height: 14px; }
                .signal-bars .bar { width: 3px; background: var(--gray-200); border-radius: 1px; }
                .signal-bars .bar:nth-child(1) { height: 4px; }
                .signal-bars .bar:nth-child(2) { height: 7px; }
                .signal-bars .bar:nth-child(3) { height: 10px; }
                .signal-bars .bar:nth-child(4) { height: 14px; }
                .signal-bars .bar.active { background: #22c55e; }

                .timestamp-mono { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--gray-500); background: var(--gray-100); padding: 2px 6px; borderRadius: 4px; }
            `}</style>
        </div>
    )
}
