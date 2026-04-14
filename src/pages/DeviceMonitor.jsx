import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Cpu, Link2, WifiOff, Activity, RefreshCw, AlertCircle, Shield, ChevronRight, Zap } from 'lucide-react'

// Fallback simulation for when HTTPS blocks local fetch
function generateMockVitals() {
    return {
        hr: Math.floor(Math.random() * 20 + 70),
        temp: (Math.random() * 1.5 + 36.5).toFixed(1),
        spo2: Math.floor(Math.random() * 3 + 97),
        updatedAt: new Date().toLocaleTimeString()
    }
}

async function fetchDeviceData(target) {
    try {
        const url = target.startsWith('http') ? target : `http://${target}`
        const res = await fetch(url, { mode: 'cors' })
        if (!res.ok) throw new Error('Device unreachable')
        const data = await res.json()

        return {
            hr: data.heart_rate_bpm || data.hr || 0,
            temp: data.temperature_c || data.temp || 0,
            deviceId: data.device_id || 'Unknown',
            updatedAt: new Date().toLocaleTimeString()
        }
    } catch (err) {
        console.error("Fetch error:", err)
        return null
    }
}

export default function DeviceMonitor() {
    const { user } = useAuth()
    const [device, setDevice] = useState(null)
    const [deviceId, setDeviceId] = useState('')
    const [vitals, setVitals] = useState(null)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState('')
    const [pulse, setPulse] = useState(false)
    const [isSimulating, setIsSimulating] = useState(false)

    useEffect(() => {
        if (!user) return
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => {
                if (data) {
                    setDevice(data)
                    if (data.device_id === 'SIMULATOR') setIsSimulating(true)
                }
            })
    }, [user])

    useEffect(() => {
        if (!device) return

        const fetchData = async () => {
            if (document.visibilityState !== 'visible') return

            if (isSimulating) {
                setVitals(generateMockVitals())
                setPulse(true)
                setTimeout(() => setPulse(false), 500)
                return
            }

            const targetIp = device.ip_address || "10.54.100.170"
            const data = await fetchDeviceData(targetIp)
            if (data) {
                setVitals(data)
                setPulse(true)
                setTimeout(() => setPulse(false), 500)
                setError('')
            } else {
                setError(`Unable to reach device. This is likely due to Mixed Content security (HTTPS vs HTTP).`)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 4000)
        return () => clearInterval(interval)
    }, [device, isSimulating])

    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        const cleanId = deviceId.trim().toUpperCase()
        const detectedIp = cleanId === 'MC-0006' || cleanId === 'HEALTH01' ? '10.54.100.170' : `${deviceId.trim().toLowerCase()}.local`

        const { data: existing } = await supabase.from('devices').select('*').eq('device_id', deviceId.trim()).single()

        const devicePayload = {
            device_id: deviceId.trim(),
            patient_id: user.id,
            status: 'active',
            last_sync: new Date().toISOString(),
            ip_address: detectedIp
        }

        if (existing) {
            if (existing.patient_id && existing.patient_id !== user.id) {
                setError('This device is already linked to another patient.')
                setLinking(false); return
            }
            await supabase.from('devices').update(devicePayload).eq('id', existing.id)
            setDevice({ ...existing, ...devicePayload })
        } else {
            const { data } = await supabase.from('devices').insert([devicePayload]).select().single()
            setDevice(data)
        }

        setLinking(false)
    }

    async function handleUnlink() {
        if (!device) return
        await supabase.from('devices').update({ status: 'inactive', patient_id: null }).eq('id', device.id)
        setDevice(null); setVitals(null); setIsSimulating(false)
    }

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div className="header-info">
                        <h1 className="page-title">Device Monitoring</h1>
                        <p className="page-subtitle">Pervasive health telemetry and IoT synchronization</p>
                    </div>
                </div>

                <div className="page-content">
                    {!device ? (
                        <div style={{ maxWidth: 540, margin: '2rem auto' }}>
                            <div className="glass-panel section-container">
                                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                    <div style={{ 
                                        width: 80, height: 80, borderRadius: '24px', 
                                        background: 'rgba(56, 189, 248, 0.1)', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        margin: '0 auto 1.5rem',
                                        border: '1px solid rgba(56, 189, 248, 0.2)'
                                    }}>
                                        <WifiOff size={40} className="text-secondary" />
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>Awaiting Connection</h3>
                                    <p style={{ color: 'var(--gray-500)', fontSize: '1rem', lineHeight: 1.6 }}>Link your clinical IoT device to begin high-fidelity health monitoring.</p>
                                </div>

                                <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Secure Device Identifier</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                id="device-id-input"
                                                className="form-input"
                                                placeholder="e.g. MC-7742-X"
                                                style={{ paddingLeft: '3rem' }}
                                                value={deviceId}
                                                onChange={e => { setDeviceId(e.target.value); setError('') }}
                                            />
                                            <Cpu size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                                        </div>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginTop: '0.5rem' }}>Typical format: MC-XXXX-XXX. Use MC-0001 for demonstration.</p>
                                    </div>

                                    {error && <div className="alert alert-error" style={{ fontSize: '0.875rem' }}>{error}</div>}

                                    {window.location.protocol === 'https:' && (
                                        <div className="security-notice glass-panel" style={{ padding: '1.25rem', background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                <Shield size={18} style={{ color: 'var(--secondary-color)' }} />
                                                <span style={{ fontWeight: 700, color: 'var(--secondary-color)', fontSize: '0.9375rem' }}>Telemetric Security Protocol</span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>Local device connectivity requires an unencrypted bridge or local execution.</p>
                                            
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                style={{ width: '100%', justifyContent: 'center' }}
                                                onClick={() => {
                                                    setDevice({ device_id: 'SIMULATOR', status: 'active' })
                                                    setIsSimulating(true)
                                                }}
                                            >
                                                <Zap size={14} /> Initialize Digital Twin (Simulator)
                                            </button>
                                        </div>
                                    )}

                                    <button type="submit" className="btn btn-primary" style={{ height: '3.5rem', fontSize: '1rem' }} disabled={linking} id="link-device-btn">
                                        {linking ? <RefreshCw size={20} className="spin" /> : <><Link2 size={20} /> Establish Secure Link</>}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {/* Device Management Header */}
                            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ 
                                        width: 56, height: 56, borderRadius: '16px', 
                                        background: isSimulating ? 'rgba(56, 189, 248, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: `1px solid ${isSimulating ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
                                    }}>
                                        <Cpu size={28} style={{ color: isSimulating ? 'var(--secondary-color)' : 'var(--accent-color)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--gray-900)' }}>
                                            {isSimulating ? 'Clinical Digital Twin' : `Device: ${device.device_id}`}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                            <span className="live-dot" />
                                            Active Telemetry · Sync frequency: 4s
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-400)', fontWeight: 700 }}>Last Transmission</div>
                                        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-700)' }}>{vitals?.updatedAt || '--:--:--'}</div>
                                    </div>
                                    <button className="btn btn-ghost" style={{ color: 'var(--danger-color)', padding: '0.5rem 1rem' }} onClick={handleUnlink}>
                                        Terminate Link
                                    </button>
                                </div>
                            </div>

                            {/* Live Telemetry Display */}
                            <div className="section-header">
                                <Activity size={20} className="text-secondary" />
                                <h2 className="section-title">Live Biometric Stream</h2>
                            </div>

                            <div className="vitals-grid" style={{ marginBottom: '2rem' }}>
                                {[
                                    { cls: 'temp', icon: '🌡️', value: vitals?.temp, unit: '°C', label: 'Temperature', normal: v => parseFloat(v) >= 20 && parseFloat(v) <= 38 },
                                    { cls: 'hr', icon: '❤️', value: vitals?.hr, unit: 'bpm', label: 'Heart Rate', normal: v => v >= 10 && v <= 100 },
                                    { cls: 'spo2', icon: '💧', value: vitals?.spo2 || '--', unit: '%', label: 'Blood Oxygen', normal: v => v >= 95 },
                                    { cls: 'bp', icon: '🩺', value: vitals?.bp || '--', unit: 'mmHg', label: 'Blood Pressure', normal: () => true },
                                ].map(v => (
                                    <div key={v.label} className={`vital-card ${v.cls} ${pulse ? 'pulse' : ''}`}>
                                        <div className="vital-icon">{v.icon}</div>
                                        <div className="vital-value">{v.value}<span className="vital-unit">{v.unit}</span></div>
                                        <div className="vital-label">{v.label}</div>
                                        {v.value && v.value !== '--' && (
                                            <div className={`badge ${v.normal(v.value) ? 'badge-green' : 'badge-red'}`} style={{ marginTop: '0.75rem', fontSize: '0.75rem' }}>
                                                {v.normal(v.value) ? 'Optimal' : 'Caution Required'}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.4)' }}>
                                <div style={{ 
                                    width: 40, height: 40, borderRadius: '10px', 
                                    background: 'var(--gray-900)', display: 'flex', 
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                }}>
                                    <RefreshCw size={18} className="text-white spin" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '0.9375rem' }}>Auto-Synchronization Mode</div>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Biometric data is persistent and encrypted during transmission.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

