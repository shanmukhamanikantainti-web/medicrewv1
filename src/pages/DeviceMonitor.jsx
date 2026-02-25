import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Cpu, Link2, WifiOff, Activity, RefreshCw } from 'lucide-react'

// No longer using generateVitals simulation
async function fetchDeviceData(ip) {
    try {
        const res = await fetch(`http://${ip}`, { mode: 'cors' })
        if (!res.ok) throw new Error('Device unreachable')
        const data = await res.json()
        return {
            hr: data.heart_rate_bpm,
            temp: data.temperature_c,
            deviceId: data.device_id,
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

    useEffect(() => {
        if (!user) return
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => {
                if (data) { setDevice(data); setVitals(generateVitals()) }
            })
    }, [user])

    // Polling for real device data
    useEffect(() => {
        if (!device) return

        const fetchData = async () => {
            if (document.visibilityState !== 'visible') return

            // Try to resolve IP if not already known, or use the provided example IP
            // In a real scenario, we might use mdns (device_id.local) or a stored IP
            const targetIp = device.ip_address || "10.54.100.170"

            const data = await fetchDeviceData(targetIp)
            if (data) {
                setVitals(data)
                setPulse(true)
                setTimeout(() => setPulse(false), 500)
                setError('')
            } else {
                setError(`Unable to reach device at ${targetIp}. Ensure it's on the same network & CORS is enabled.`)
            }
        }

        fetchData() // Initial fetch
        const interval = setInterval(fetchData, 4000)
        return () => clearInterval(interval)
    }, [device])

    async function handleLink(e) {
        e.preventDefault()
        if (!deviceId.trim()) return setError('Please enter a Device ID.')
        setLinking(true); setError('')

        // In this new flow, we use the Device ID to "detect" the device on the local network.
        // For demonstration, if ID is HEALTH01, we use the IP from your image.
        const detectedIp = deviceId.trim().toUpperCase() === 'HEALTH01' ? '10.54.100.170' : `${deviceId.trim().toLowerCase()}.local`

        const { data: existing } = await supabase.from('devices').select('*').eq('device_id', deviceId.trim()).single()

        const devicePayload = {
            device_id: deviceId.trim(),
            patient_id: user.id,
            status: 'active',
            last_sync: new Date().toISOString(),
            ip_address: detectedIp // Fallback IP for monitoring
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
                                    { cls: 'temp', icon: '🌡️', value: vitals?.temp, unit: '°C', label: 'Temperature', normal: v => parseFloat(v) >= 20 && parseFloat(v) <= 38 },
                                    { cls: 'hr', icon: '❤️', value: vitals?.hr, unit: 'bpm', label: 'Heart Rate', normal: v => v >= 10 && v <= 100 },
                                    { cls: 'spo2', icon: '💧', value: vitals?.spo2 || '--', unit: '%', label: 'Blood Oxygen (SpO₂)', normal: v => v >= 95 },
                                    { cls: 'bp', icon: '🩺', value: vitals?.bp || '--', unit: '', label: 'Blood Pressure', normal: () => true },
                                ].map(v => (
                                    <div key={v.label} className={`vital-card ${v.cls} ${pulse ? 'pulse' : ''}`}>
                                        <div className="vital-icon">{v.icon}</div>
                                        <div className="vital-value">{v.value}<span className="vital-unit">{v.unit}</span></div>
                                        <div className="vital-label">{v.label}</div>
                                        {v.value && v.value !== '--' && (
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
