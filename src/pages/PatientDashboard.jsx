import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import { Activity, Heart, Cpu, Calendar, Brain, TrendingUp, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Link } from 'react-router-dom'

function generateVitals() {
    return {
        hr: Math.floor(Math.random() * 30 + 60),
        spo2: Math.floor(Math.random() * 5 + 95),
        temp: (Math.random() * 1.5 + 36.2).toFixed(1),
        bp: `${Math.floor(Math.random() * 20 + 110)}/${Math.floor(Math.random() * 10 + 70)}`
    }
}

export default function PatientDashboard() {
    const { profile, user } = useAuth()
    const [vitals, setVitals] = useState(generateVitals())
    const [device, setDevice] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [aiHistory, setAiHistory] = useState([])

    // Polling for vitals (simulate IoT)
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') setVitals(generateVitals())
        }, 4000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!user) return
        // Fetch device
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => data && setDevice(data))
        // Fetch appointments
        supabase.from('appointments').select('*, profiles!doctor_id(full_name)').eq('patient_id', user.id).order('date', { ascending: true }).limit(5)
            .then(({ data }) => data && setAppointments(data))
        // Fetch AI history
        supabase.from('ai_results').select('*').eq('patient_id', user.id).order('created_at', { ascending: false }).limit(3)
            .then(({ data }) => data && setAiHistory(data))
    }, [user])

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Patient'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header">
                    <h1 className="page-title">{greeting}, {name} 👋</h1>
                    <p className="page-subtitle">Here's your health summary for today</p>
                </div>
                <div className="page-content">

                    {/* Vitals */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>Live Vitals</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                            <div className="live-dot" />
                            {device ? `Device: ${device.device_id}` : 'Simulated • No device linked'}
                        </div>
                    </div>
                    <div className="vitals-grid mb-6">
                        <div className="vital-card hr">
                            <div className="vital-icon">❤️</div>
                            <div className="vital-value">{vitals.hr}<span className="vital-unit">bpm</span></div>
                            <div className="vital-label">Heart Rate</div>
                        </div>
                        <div className="vital-card spo2">
                            <div className="vital-icon">💧</div>
                            <div className="vital-value">{vitals.spo2}<span className="vital-unit">%</span></div>
                            <div className="vital-label">SpO2</div>
                        </div>
                        <div className="vital-card temp">
                            <div className="vital-icon">🌡️</div>
                            <div className="vital-value">{vitals.temp}<span className="vital-unit">°C</span></div>
                            <div className="vital-label">Temperature</div>
                        </div>
                        <div className="vital-card bp">
                            <div className="vital-icon">🩺</div>
                            <div className="vital-value" style={{ fontSize: '1.25rem' }}>{vitals.bp}</div>
                            <div className="vital-label">Blood Pressure</div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <h2 className="section-title">Quick Actions</h2>
                    <div className="grid-3 mb-6">
                        {[
                            { to: '/patient/ai', icon: Brain, label: 'AI Health Check', desc: 'Analyze symptoms with AI', color: '#7c3aed', bg: '#f3e8ff' },
                            { to: '/patient/devices', icon: Cpu, label: 'My Device', desc: device ? 'Device connected ✓' : 'Connect IoT device', color: '#059669', bg: '#ecfdf5' },
                            { to: '/patient/appointments', icon: Calendar, label: 'Appointments', desc: `${appointments.length} upcoming`, color: '#2563eb', bg: '#eff6ff' },
                        ].map(a => (
                            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
                                <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.875rem' }}>
                                        <a.icon size={22} color={a.color} />
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>{a.label}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{a.desc}</div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Appointments */}
                    <div className="grid-2">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <h2 className="section-title" style={{ margin: 0 }}>Upcoming Appointments</h2>
                                <Link to="/patient/appointments" style={{ fontSize: '0.875rem', color: 'var(--blue-600)' }}>View all →</Link>
                            </div>
                            {appointments.length === 0 ? (
                                <div className="card empty-state">
                                    <Calendar size={36} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
                                    <h3>No appointments</h3>
                                    <p>Book your first appointment</p>
                                    <Link to="/patient/appointments" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Book Now</Link>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {appointments.map(a => (
                                        <div key={a.id} className="card" style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>Dr. {a.profiles?.full_name || 'TBD'}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{a.date} {a.time && `at ${a.time}`}</div>
                                            <span className={`badge badge-${a.status === 'confirmed' ? 'green' : 'yellow'}`} style={{ marginTop: '0.375rem' }}>{a.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <h2 className="section-title" style={{ margin: 0 }}>Recent AI Results</h2>
                                <Link to="/patient/ai" style={{ fontSize: '0.875rem', color: 'var(--blue-600)' }}>New check →</Link>
                            </div>
                            {aiHistory.length === 0 ? (
                                <div className="card empty-state">
                                    <Brain size={36} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
                                    <h3>No AI checks yet</h3>
                                    <p>Try the AI Health Assistant</p>
                                    <Link to="/patient/ai" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Try Now</Link>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {aiHistory.map(r => (
                                        <div key={r.id} className="card" style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{r.condition}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                                            <span className={`badge urgency-${r.urgency?.toLowerCase()}`} style={{ marginTop: '0.375rem' }}>{r.urgency}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}
