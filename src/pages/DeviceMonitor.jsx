import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Cpu, Link2, WifiOff, Activity, RefreshCw } from 'lucide-react'

function generateVitals() {
    return {
        hr: Math.floor(Math.random() * 30 + 58),
        spo2: Math.floor(Math.random() * 5 + 95),
        temp: (Math.random() * 1.5 + 36.0).toFixed(1),
        bp: `${Math.floor(Math.random() * 20 + 108)}/${Math.floor(Math.random() * 10 + 68)}`,
        updatedAt: new Date().toLocaleTimeString()
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

    useEffect(() => {
        if (!user) return
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => {
                if (data) { setDevice(data); setVitals(generateVitals()) }
            })
    }, [user])

    // Polling for vitals
    useEffect(() => {
        if (!device) return
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                setVitals(generateVitals())
                setPulse(true)
                setTimeout(() => setPulse(false), 500)
            }
        }, 4000)
        return () => clearInterval(interval)
    }, [device])

    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        // Check if device exists or create it
        const { data: existing } = await supabase.from('devices').select('*').eq('device_id', deviceId.trim()).single()

        if (existing) {
            if (existing.patient_id && existing.patient_id !== user.id) {
                setError('This device is already linked to another patient.')
                setLinking(false); return
            }
            await supabase.from('devices').update({ patient_id: user.id, status: 'active', last_sync: new Date().toISOString() }).eq('id', existing.id)
            setDevice({ ...existing, patient_id: user.id, status: 'active' })
        } else {
            const { data } = await supabase.from('devices').insert([{
                device_id: deviceId.trim(), patient_id: user.id, status: 'active', last_sync: new Date().toISOString()
            }]).select().single()
            setDevice(data)
        }
        setVitals(generateVitals())
        setLinking(false)
    }

    async function handleUnlink() {
        if (!device) return
        await supabase.from('devices').update({ status: 'inactive', patient_id: null }).eq('id', device.id)
        setDevice(null); setVitals(null)
    }

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Cpu size={24} color="#059669" />
                        </div>
                        <div>
                            <h1 className="page-title">IoT Device Monitor</h1>
                            <p className="page-subtitle">Link your health device and view live metrics</p>
                        </div>
                    </div>
                </div>
                <div className="page-content">

                    {!device ? (
                        <div style={{ maxWidth: 480, margin: '0 auto' }}>
                            <div className="card">
                                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                        <WifiOff size={36} style={{ color: 'var(--gray-400)' }} />
                                    </div>
                                    <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.375rem' }}>No Device Linked</h3>
                                    <p style={{ color: 'var(--gray-500)', fontSize: '0.9375rem' }}>Enter your IoT Device ID to start monitoring your health metrics in real time.</p>
                                </div>
                                <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Device ID</label>
                                        <input
                                            id="device-id-input"
                                            className="form-input"
                                            placeholder="e.g., MC-2024-001"
                                            value={deviceId}
                                            onChange={e => { setDeviceId(e.target.value); setError('') }}
                                        />
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>Try any ID like MC-0001 to simulate a device</span>
                                    </div>
                                    {error && <div className="auth-error">{error}</div>}
                                    <button type="submit" className="btn btn-primary" disabled={linking} id="link-device-btn">
                                        {linking ? 'Linking...' : <><Link2 size={16} /> Link Device</>}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Device Info */}
                            <div className="card mb-6" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Cpu size={22} color="#059669" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Device ID: {device.device_id}</div>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                                                <div className="live-dot" style={{ marginRight: 6 }} />
                                                Active · Last sync: {vitals?.updatedAt || '...'}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={handleUnlink}>Unlink Device</button>
                                </div>
                            </div>

                            {/* Vitals */}
                            <h2 className="section-title">Live Health Metrics</h2>
                            <div className="vitals-grid mb-6">
                                {[
                                    { cls: 'hr', icon: '❤️', value: vitals?.hr, unit: 'bpm', label: 'Heart Rate', normal: v => v >= 60 && v <= 100 },
                                    { cls: 'spo2', icon: '💧', value: vitals?.spo2, unit: '%', label: 'Blood Oxygen (SpO₂)', normal: v => v >= 95 },
                                    { cls: 'temp', icon: '🌡️', value: vitals?.temp, unit: '°C', label: 'Temperature', normal: v => parseFloat(v) >= 36 && parseFloat(v) <= 37.5 },
                                    { cls: 'bp', icon: '🩺', value: vitals?.bp, unit: '', label: 'Blood Pressure', normal: () => true },
                                ].map(v => (
                                    <div key={v.label} className={`vital-card ${v.cls} ${pulse ? 'pulse' : ''}`}>
                                        <div className="vital-icon">{v.icon}</div>
                                        <div className="vital-value">{v.value}<span className="vital-unit">{v.unit}</span></div>
                                        <div className="vital-label">{v.label}</div>
                                        {v.value && (
                                            <div style={{ marginTop: '0.375rem' }}>
                                                <span className={`badge ${v.normal(v.value) ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.6875rem' }}>
                                                    {v.normal(v.value) ? 'Normal' : 'Abnormal'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="alert alert-info">
                                <RefreshCw size={15} style={{ flexShrink: 0 }} />
                                Vitals are refreshed every 4 seconds automatically when this tab is active.
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
