import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Users, Calendar, Activity, AlertCircle, CheckCircle, Clock, Search, Bell, ChevronRight, Sliders, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function generateVitals() {
    return {
        hr: Math.floor(Math.random() * 40 + 55),
        spo2: Math.floor(Math.random() * 8 + 92),
        temp: (Math.random() * 2 + 36).toFixed(1),
    }
}

function isAbnormal(vitals) {
    return vitals.hr < 60 || vitals.hr > 100 || vitals.spo2 < 95 || parseFloat(vitals.temp) > 37.5
}

export default function DoctorDashboard() {
    const { profile, user } = useAuth()
    const [patients, setPatients] = useState([])
    const [appointments, setAppointments] = useState([])
    const [patientVitals, setPatientVitals] = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) return
        // Fetch appointments for this doctor
        supabase.from('appointments').select('*, patient:patient_id(id, full_name, email)').eq('doctor_id', user.id).order('date', { ascending: true }).limit(10)
            .then(({ data }) => {
                setAppointments(data || [])
                // Get unique patients
                const uniquePatients = []
                const seen = new Set()
                    ; (data || []).forEach(a => {
                        if (a.patient && !seen.has(a.patient.id)) {
                            seen.add(a.patient.id)
                            uniquePatients.push(a.patient)
                        }
                    })
                setPatients(uniquePatients)
                // Generate vitals per patient
                const vitalsMap = {}
                uniquePatients.forEach(p => { vitalsMap[p.id] = generateVitals() })
                setPatientVitals(vitalsMap)
                setLoading(false)
            })
    }, [user])

    // Poll vitals (medium priority ~12s)
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && patients.length > 0) {
                const vitalsMap = {}
                patients.forEach(p => { vitalsMap[p.id] = generateVitals() })
                setPatientVitals(vitalsMap)
            }
        }, 12000)
        return () => clearInterval(interval)
    }, [patients])

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Doctor'
    const pendingAppts = appointments.filter(a => a.status === 'pending').length
    const alertPatients = patients.filter(p => patientVitals[p.id] && isAbnormal(patientVitals[p.id]))

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                {/* Header Utility Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <div className="search-pill glass-panel" style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '300px' }}>
                        <Search size={16} opacity={0.4} />
                        <span style={{ fontSize: '0.875rem', opacity: 0.4 }}>Search patient roster...</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn-ethereal" style={{ width: 44, height: 44, borderRadius: 12, padding: 0 }}>
                            <Sliders size={20} />
                        </button>
                        <button className="btn-ethereal" style={{ width: 44, height: 44, borderRadius: 12, padding: 0 }}>
                            <Bell size={20} />
                        </button>
                        <div className="surface-lowest" style={{ padding: '0.25rem 1rem 0.25rem 0.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div className="sidebar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', background: 'var(--primary)', color: 'white' }}>DR</div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 800 }}>Dr. {name}</span>
                        </div>
                    </div>
                </div>

                <div className="page-header animate-fade" style={{ border: 'none', padding: 0, marginBottom: '2.5rem' }}>
                    <h1 className="page-title" style={{ fontSize: '2.5rem', letterSpacing: '-0.04em' }}>Clinical <span className="text-gradient">Operations</span> Center</h1>
                    <p className="page-subtitle">Standard protocol active. Synchronized with {patients.length} active monitors.</p>
                </div>

                <div className="page-content animate-fade" style={{ padding: 0 }}>
                    {/* High Precision Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                        {[
                            { icon: Users, label: 'Active Roster', value: patients.length, color: 'var(--primary)' },
                            { icon: Calendar, label: 'Today\'s Sessions', value: appointments.filter(a => a.status === 'confirmed').length, color: '#2563eb' },
                            { icon: AlertCircle, label: 'Unchecked Tasks', value: pendingAppts, color: '#f59e0b' },
                            { icon: Activity, label: 'Telemetry Alerts', value: alertPatients.length, color: '#ef4444' },
                        ].map(s => (
                            <div key={s.label} className="glass-panel" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: 44, height: 44, background: `${s.color}10`, color: s.color, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase' }}>{s.label}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Critical Telemetry Alert Block */}
                    {alertPatients.length > 0 && (
                        <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444', marginBottom: '1.25rem' }}>
                                <AlertCircle size={20} />
                                <h3 style={{ fontWeight: 800, margin: 0 }}>CRITICAL TELEMETRY DETECTED</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                                {alertPatients.map(p => (
                                    <div key={p.id} className="surface-lowest" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{p.full_name || p.email}</div>
                                        <div style={{ fontSize: '0.8125rem', opacity: 0.6, display: 'flex', gap: '0.75rem' }}>
                                            <span>HR: <strong style={{ color: '#ef4444' }}>{patientVitals[p.id]?.hr}</strong></span>
                                            <span>SpO2: <strong style={{ color: '#ef4444' }}>{patientVitals[p.id]?.spo2}%</strong></span>
                                            <span>Temp: <strong>{patientVitals[p.id]?.temp}°C</strong></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                        {/* Patient Roster */}
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Assigned Patient Roster</h2>
                                <button className="btn-ethereal" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Sort by: Priority</button>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem' }}>
                                {loading ? <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Syncing monitor nodes...</div> :
                                    patients.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                                            <Users size={40} opacity={0.1} style={{ marginBottom: '1rem' }} />
                                            <p style={{ opacity: 0.5 }}>No synchronized clinical nodes detected.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {patients.map(p => {
                                                const v = patientVitals[p.id]
                                                const alert = v && isAbnormal(v)
                                                return (
                                                    <div key={p.id} className="surface-lowest" style={{ padding: '1rem 1.25rem', transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                                            <div className="sidebar-avatar" style={{ width: 44, height: 44, borderRadius: 12, background: alert ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: alert ? '#ef4444' : '#10b981' }}>
                                                                {alert ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p.full_name || p.email}</div>
                                                                <div style={{ fontSize: '0.8125rem', opacity: 0.5, display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                                    <span>HR: {v?.hr}bpm</span>
                                                                    <span>SpO2: {v?.spo2}%</span>
                                                                    <span>Normal Temp: {v?.temp}°C</span>
                                                                </div>
                                                            </div>
                                                            <ArrowUpRight size={20} opacity={0.2} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                }
                            </div>
                        </section>

                        {/* Appointments Scroll */}
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Clinical Schedule</h2>
                                <Link to="/doctor/appointments" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>Full Log</Link>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem' }}>
                                {appointments.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                                        <Calendar size={40} opacity={0.1} style={{ marginBottom: '1rem' }} />
                                        <p style={{ opacity: 0.5 }}>No sessions booked.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {appointments.slice(0, 6).map(a => (
                                            <div key={a.id} className="surface-lowest" style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: 40, height: 40, background: 'white', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Clock size={18} color="rgba(0,0,0,0.3)" />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{a.patient?.full_name || a.patient?.email}</div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{a.date} at {a.time || '09:00 AM'}</div>
                                                    </div>
                                                    <div style={{ padding: '0.25rem 0.625rem', borderRadius: 99, fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', background: a.status === 'confirmed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: a.status === 'confirmed' ? '#10b981' : '#f59e0b' }}>
                                                        {a.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    )
}
