import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import { Activity, Heart, Cpu, Calendar, Brain, TrendingUp, AlertCircle, ChevronRight, Bell, Search, Thermometer, Droplets } from 'lucide-react'
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

    useEffect(() => {
        if (!user) return
        
        // Fetch active device
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => {
                if (data) {
                    setDevice(data)
                    // Subscribe to real-time updates for this device
                    const channel = supabase
                        .channel(`vitals-${data.device_id}`)
                        .on('postgres_changes', { 
                            event: 'INSERT', 
                            schema: 'public', 
                            table: 'device_readings',
                            filter: `device_id=eq.${data.device_id}`
                        }, (payload) => {
                            console.log('💓 Live Telemetry:', payload.new)
                            const d = payload.new
                            setVitals({
                                hr: d.heart_rate || 0,
                                spo2: d.spo2 || 98,
                                temp: d.temperature || 36.5,
                                bp: d.blood_pressure || '120/80',
                                last_seen: d.recorded_at
                            })
                        })
                        .subscribe()
                    
                    return () => supabase.removeChannel(channel)
                }
            })

        // Fetch last reading for initial state
        supabase.from('device_readings')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .then(({ data }) => {
                if (data && data[0]) {
                    const d = data[0]
                    setVitals({
                        hr: d.heart_rate || 0,
                        spo2: d.spo2 || 98,
                        temp: d.temperature || 36.5,
                        bp: d.blood_pressure || '120/80'
                    })
                }
            })

        // Fetch appointments & AI history
        supabase.from('appointments').select('*, profiles!doctor_id(full_name)').eq('patient_id', user.id).order('date', { ascending: true }).limit(5)
            .then(({ data }) => data && setAppointments(data))
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
                {/* Dashboard Utility Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div className="search-pill glass-panel" style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '320px', borderRadius: '99px' }}>
                        <Search size={16} opacity={0.3} />
                        <span style={{ fontSize: '0.85rem', opacity: 0.3, fontWeight: 500 }}>Global diagnostics search...</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button className="btn-ethereal" style={{ width: 42, height: 42, borderRadius: '12px', padding: 0 }}>
                            <Bell size={18} />
                        </button>
                        <div className="glass-panel" style={{ padding: '0.4rem 1.25rem 0.4rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.6)' }}>
                            <div className="sidebar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none' }}>{name.slice(0,1)}</div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--on-surface)' }}>{name}</span>
                        </div>
                    </div>
                </div>

                <div className="page-header animate-fade" style={{ border: 'none', padding: 0, marginBottom: '2.5rem' }}>
                    <h1 className="page-title" style={{ fontSize: '2.75rem', letterSpacing: '-0.04em' }}>
                        {greeting}, <span className="text-gradient">{name}</span>
                    </h1>
                    <p className="page-subtitle">Your clinical dashboard is synchronized and active.</p>
                </div>

                <div className="page-content animate-fade" style={{ padding: 0 }}>
                    {/* Vitals Summary */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Live Telemetry</h2>
                        <div className="glass-panel" style={{ padding: '0.375rem 0.875rem', borderRadius: 99, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                            <span style={{ opacity: 0.6 }}>{device ? `CONNECTED: ${device.device_id}` : 'STABLE MODE • SIMULATED'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                        <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03 }}><Heart size={120} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ width: 42, height: 42, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Heart size={20} style={{ margin: 'auto' }} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>STABLE</div>
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{vitals.hr}<span style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.4, marginLeft: '0.25rem' }}>bpm</span></div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, opacity: 0.5, marginTop: '0.5rem' }}>HEART RATE</div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03 }}><Droplets size={120} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ width: 42, height: 42, background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Droplets size={20} style={{ margin: 'auto' }} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>OPTIMAL</div>
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{vitals.spo2}<span style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.4, marginLeft: '0.25rem' }}>%</span></div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, opacity: 0.5, marginTop: '0.5rem' }}>SPO2 (OXYGEN)</div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03 }}><Thermometer size={120} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ width: 42, height: 42, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Thermometer size={20} style={{ margin: 'auto' }} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>NORMAL</div>
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{vitals.temp}<span style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.4, marginLeft: '0.25rem' }}>°C</span></div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, opacity: 0.5, marginTop: '0.5rem' }}>TEMPERATURE</div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.03 }}><Activity size={120} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ width: 42, height: 42, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={20} style={{ margin: 'auto' }} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>REGULAR</div>
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{vitals.bp}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, opacity: 0.5, marginTop: '0.5rem' }}>BLOOD PRESSURE</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }}>
                        {/* Quick Actions and Main Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                            <section>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Quick Actions</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                    <Link to="/patient/ai" style={{ textDecoration: 'none' }}>
                                        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(124, 58, 237, 0.2)', background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(124, 58, 237, 0.1) 100%)' }}>
                                            <Brain size={24} color="#7c3aed" style={{ marginBottom: '1rem' }} />
                                            <div style={{ fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>AI Health Assistant</div>
                                            <p style={{ fontSize: '0.8125rem', opacity: 0.6 }}>Real-time symptom analysis</p>
                                        </div>
                                    </Link>
                                    <Link to="/patient/devices" style={{ textDecoration: 'none' }}>
                                        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(37, 99, 235, 0.2)', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.1) 100%)' }}>
                                            <Cpu size={24} color="#2563eb" style={{ marginBottom: '1rem' }} />
                                            <div style={{ fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>IoT Monitoring</div>
                                            <p style={{ fontSize: '0.8125rem', opacity: 0.6 }}>Configure clinical devices</p>
                                        </div>
                                    </Link>
                                </div>
                            </section>

                            <section>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Clinical Appointments</h2>
                                    <Link to="/patient/appointments" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>Open Calendar</Link>
                                </div>
                                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                    {appointments.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <Calendar size={40} opacity={0.1} style={{ marginBottom: '1rem' }} />
                                            <p style={{ fontSize: '0.875rem', opacity: 0.5 }}>No upcoming clinical sessions scheduled.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {appointments.map(a => (
                                                <div key={a.id} className="surface-lowest" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Calendar size={20} color="var(--primary)" />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>Consultation with Dr. {a.profiles?.full_name || 'TBD'}</div>
                                                        <div style={{ fontSize: '0.8125rem', opacity: 0.5 }}>{a.date} at {a.time || 'TBD'}</div>
                                                    </div>
                                                    <div style={{ padding: '0.375rem 0.75rem', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 800, background: a.status === 'confirmed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: a.status === 'confirmed' ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>
                                                        {a.status}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Side Panel: AI Insights and Status */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <section>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Neural Insights</h2>
                                <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(25, 28, 30, 0.02) 0%, rgba(25, 28, 30, 0.05) 100%)' }}>
                                    {aiHistory.length === 0 ? (
                                        <p style={{ fontSize: '0.8125rem', opacity: 0.5, textAlign: 'center' }}>Launch an AI Health Check to generate insights.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            {aiHistory.map(r => (
                                                <div key={r.id} style={{ position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid rgba(0,0,0,0.05)' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{r.condition}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.urgency === 'High' ? '#ef4444' : '#10b981' }} />
                                                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.6 }}>{r.urgency.toUpperCase()} URGENCY</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <Link to="/patient/ai" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.625rem' }}>
                                        <Brain size={18} />
                                        <span>New Check</span>
                                    </Link>
                                </div>
                            </section>

                            <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '0.5rem' }}>Premium Health+</div>
                                <p style={{ fontSize: '0.8125rem', opacity: 0.8, marginBottom: '1.25rem' }}>Unlock 24/7 dedicated physician access and advanced genomic analysis.</p>
                                <button className="btn btn-ethereal" style={{ width: '100%', color: 'white', background: 'rgba(255,255,255,0.1)' }}>Upgrade Now</button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
