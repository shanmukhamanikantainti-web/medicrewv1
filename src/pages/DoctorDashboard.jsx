import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Users, Calendar, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react'
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
                <div className="page-header">
                    <h1 className="page-title">Dr. {name}'s Dashboard</h1>
                    <p className="page-subtitle">Monitor your patients and manage appointments</p>
                </div>
                <div className="page-content">

                    {/* Stats */}
                    <div className="stats-grid mb-6">
                        {[
                            { icon: Users, label: 'My Patients', value: patients.length, color: '#2563eb' },
                            { icon: Calendar, label: 'Upcoming Appointments', value: appointments.filter(a => a.status !== 'cancelled').length, color: '#059669' },
                            { icon: AlertCircle, label: 'Pending Requests', value: pendingAppts, color: '#ea580c' },
                            { icon: Activity, label: 'Abnormal Vitals', value: alertPatients.length, color: '#dc2626' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <div className="stat-icon" style={{ background: `${s.color}15` }}>
                                    <s.icon size={22} color={s.color} />
                                </div>
                                <div>
                                    <div className="stat-value">{s.value}</div>
                                    <div className="stat-label">{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Alerts */}
                    {alertPatients.length > 0 && (
                        <div className="alert alert-error mb-6" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem', backdropFilter: 'blur(10px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                                <AlertCircle size={16} /> Abnormal Vitals Detected
                            </div>
                            {alertPatients.map(p => (
                                <div key={p.id} style={{ fontSize: '0.875rem' }}>
                                    {p.full_name || p.email} — HR: {patientVitals[p.id]?.hr}bpm | SpO₂: {patientVitals[p.id]?.spo2}% | Temp: {patientVitals[p.id]?.temp}°C
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid-2">
                        {/* Patients */}
                        <div>
                            <h2 className="section-title">Assigned Patients</h2>
                            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem' }}>Loading...</div> :
                                patients.length === 0 ? (
                                    <div className="card empty-state">
                                        <Users size={40} style={{ color: 'var(--gray-300)' }} />
                                        <h3>No Patients Yet</h3>
                                        <p>Patients will appear when they book appointments with you</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {patients.map(p => {
                                            const v = patientVitals[p.id]
                                            const alert = v && isAbnormal(v)
                                            return (
                                                <div key={p.id} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${alert ? '#ef4444' : '#22c55e'}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{p.full_name || p.email}</div>
                                                            {v && (
                                                                <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                                                    HR: {v.hr}bpm · SpO₂: {v.spo2}% · Temp: {v.temp}°C
                                                                </div>
                                                            )}
                                                        </div>
                                                        {alert
                                                            ? <span className="badge badge-red"><AlertCircle size={11} /> Alert</span>
                                                            : <span className="badge badge-green"><CheckCircle size={11} /> Normal</span>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            }
                        </div>

                        {/* Appointments */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <h2 className="section-title" style={{ margin: 0 }}>Upcoming Appointments</h2>
                                <Link to="/doctor/appointments" style={{ fontSize: '0.875rem', color: 'var(--blue-600)' }}>Manage all →</Link>
                            </div>
                            {appointments.length === 0 ? (
                                <div className="card empty-state">
                                    <Calendar size={40} style={{ color: 'var(--gray-300)' }} />
                                    <h3>No Appointments</h3>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {appointments.slice(0, 5).map(a => (
                                        <div key={a.id} className="card" style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{a.patient?.full_name || a.patient?.email}</div>
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                                                        <Clock size={12} /> {a.date} {a.time && `at ${a.time}`}
                                                    </div>
                                                    {a.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>{a.notes}</div>}
                                                </div>
                                                <span className={`badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>{a.status}</span>
                                            </div>
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
