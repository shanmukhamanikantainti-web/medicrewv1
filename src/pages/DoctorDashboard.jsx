import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    LayoutDashboard, Calendar, Users, Hospital,
    Phone, MessageSquare, LogOut, Settings,
    Bell, Search, MoreVertical, MoreHorizontal,
    Eye, XCircle, CheckCircle, Activity
} from 'lucide-react'

/* ── tiny helpers ── */
function generateVitals() {
    return {
        hr: Math.floor(Math.random() * 40 + 55),
        spo2: Math.floor(Math.random() * 8 + 92),
        temp: (Math.random() * 2 + 36).toFixed(1),
    }
}
function isAbnormal(v) {
    return v.hr < 60 || v.hr > 100 || v.spo2 < 95 || parseFloat(v.temp) > 37.5
}

/* ── Donut chart (pure SVG) ── */
function DonutChart({ male = 55, female = 30, staff = 15 }) {
    const r = 54, cx = 70, cy = 70
    const total = male + female + staff
    const circ = 2 * Math.PI * r

    function arc(pct, offset) {
        return {
            strokeDasharray: `${(pct / 100) * circ} ${circ}`,
            strokeDashoffset: -offset * circ / 100,
        }
    }

    const malePct = (male / total) * 100
    const femPct = (female / total) * 100
    const staffPct = (staff / total) * 100

    return (
        <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
            {/* Male – blue */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth="18"
                strokeLinecap="round"
                style={{ ...arc(malePct, 0), transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'all 0.8s ease' }} />
            {/* Female – coral */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f87171" strokeWidth="18"
                strokeLinecap="round"
                style={{ ...arc(femPct, malePct), transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'all 0.8s ease' }} />
            {/* Staff – green */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth="18"
                strokeLinecap="round"
                style={{ ...arc(staffPct, malePct + femPct), transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'all 0.8s ease' }} />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#1f2937">{Math.round(malePct)}%</text>
            <text x={cx} y={cy + 11} textAnchor="middle" fontSize="10" fill="#6b7280">Male</text>
        </svg>
    )
}

/* ── Sparkline / Survey chart (SVG) ── */
function SurveyChart({ data }) {
    if (!data || data.length < 2) return null
    const W = 440, H = 120, pad = 16
    const max = Math.max(...data), min = Math.min(...data)
    const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2))
    const ys = data.map(v => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2))
    const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
    const areaPath = linePath + ` L${xs[xs.length - 1]},${H - pad} L${xs[0]},${H - pad} Z`
    const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H + 28}`} preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
                </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map(v => {
                const y = H - pad - (v / 100) * (H - pad * 2)
                return (
                    <g key={v}>
                        <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                        <text x={pad - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
                    </g>
                )
            })}
            <path d={areaPath} fill="url(#areaGrad)" />
            <path d={linePath} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {xs.map((x, i) => (
                <circle key={i} cx={x} cy={ys[i]} r="4" fill="white" stroke="#f43f5e" strokeWidth="2" />
            ))}
            {days.map((d, i) => (
                <text key={d} x={xs[i]} y={H + 22} textAnchor="middle" fontSize="10" fill="#9ca3af">{d}</text>
            ))}
        </svg>
    )
}

/* ── Sidebar nav items for doctor ── */
const doctorNavItems = [
    { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/doctor/appointments', label: 'Appointment', icon: Calendar },
    { to: '/doctor/patients', label: 'Doctors', icon: Users },
    { to: '/doctor/departments', label: 'Departments', icon: Hospital },
    { to: '/doctor/calls', label: 'Calls', icon: Phone },
    { to: '/doctor/chats', label: 'Chats', icon: MessageSquare },
]

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, iconBg, iconColor, valueColor }) {
    return (
        <div style={{
            background: 'white', borderRadius: 16, padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
            flex: 1, minWidth: 0
        }}>
            <div style={{
                width: 52, height: 52, borderRadius: 14, background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <Icon size={24} color={iconColor} strokeWidth={1.8} />
            </div>
            <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: valueColor || '#1e293b', lineHeight: 1 }}>{value}</div>
            </div>
        </div>
    )
}

/* ── Avatar placeholder ── */
function Avatar({ name, size = 32, src }) {
    const initials = (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']
    const color = colors[(name || '').charCodeAt(0) % colors.length]
    if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0
        }}>{initials}</div>
    )
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function DoctorDashboard() {
    const { profile, user, signOut } = useAuth()
    const navigate = useNavigate()
    const [appointments, setAppointments] = useState([])
    const [patients, setPatients] = useState([])
    const [patientVitals, setPatientVitals] = useState({})
    const [loading, setLoading] = useState(true)
    const [searchQ, setSearchQ] = useState('')

    /* Sample weekly data */
    const surveyData = [42, 60, 38, 45, 55, 70, 65]

    useEffect(() => {
        if (!user) return
        supabase.from('appointments')
            .select('*, patient:patient_id(id, full_name, email)')
            .eq('doctor_id', user.id)
            .order('date', { ascending: true })
            .limit(10)
            .then(({ data }) => {
                setAppointments(data || [])
                const seen = new Set()
                const uniq = []
                    ; (data || []).forEach(a => {
                        if (a.patient && !seen.has(a.patient.id)) {
                            seen.add(a.patient.id)
                            uniq.push(a.patient)
                        }
                    })
                setPatients(uniq)
                const vMap = {}
                uniq.forEach(p => { vMap[p.id] = generateVitals() })
                setPatientVitals(vMap)
                setLoading(false)
            })
    }, [user])

    /* Poll vitals */
    useEffect(() => {
        const iv = setInterval(() => {
            if (patients.length > 0 && document.visibilityState === 'visible') {
                const vMap = {}
                patients.forEach(p => { vMap[p.id] = generateVitals() })
                setPatientVitals(vMap)
            }
        }, 12000)
        return () => clearInterval(iv)
    }, [patients])

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Doctor'
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

    async function handleSignOut() {
        await signOut()
        navigate('/')
    }

    /* Latest patient for spotlight card */
    const spotlight = patients[0]
    const spotVitals = spotlight ? patientVitals[spotlight.id] : null
    const alertPts = patients.filter(p => patientVitals[p.id] && isAbnormal(patientVitals[p.id]))

    /* Upcoming appointments list */
    const upcomingAppts = appointments.filter(a => a.status !== 'cancelled')

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>

            {/* ── SIDEBAR ── */}
            <aside style={{
                width: 220, flexShrink: 0, background: 'white',
                display: 'flex', flexDirection: 'column',
                borderRight: '1px solid #f1f5f9',
                position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
            }}>
                {/* Logo */}
                <div style={{ padding: '1.5rem 1.25rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
                        <span style={{ color: '#f43f5e' }}>M</span>
                        <span style={{ color: '#1e293b' }}>.care</span>
                    </span>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {doctorNavItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '0.65rem 1rem', borderRadius: 10,
                                color: isActive ? '#f43f5e' : '#64748b',
                                fontWeight: isActive ? 700 : 500, fontSize: '0.9rem',
                                textDecoration: 'none',
                                background: isActive ? '#fff1f2' : 'transparent',
                                borderLeft: isActive ? '3px solid #f43f5e' : '3px solid transparent',
                                transition: 'all 0.15s ease'
                            })}
                        >
                            <Icon size={18} strokeWidth={isActive => isActive ? 2.2 : 1.8} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Sign out */}
                <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button onClick={handleSignOut} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '0.65rem 1rem', borderRadius: 10,
                        color: '#f43f5e', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, width: '100%'
                    }}>
                        <LogOut size={18} />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* ── MAIN AREA ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Top bar */}
                <header style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 2rem', background: 'white', borderBottom: '1px solid #f1f5f9',
                    position: 'sticky', top: 0, zIndex: 10
                }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Dashboard</h1>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        flex: 1, maxWidth: 320, margin: '0 2rem',
                        background: '#f8fafc', borderRadius: 10, padding: '0.5rem 1rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        <Search size={16} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="Search Project ..."
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            style={{
                                border: 'none', background: 'transparent',
                                outline: 'none', fontSize: '0.875rem', color: '#64748b',
                                width: '100%', fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative', cursor: 'pointer' }}>
                            <Bell size={22} color="#64748b" />
                            <div style={{
                                position: 'absolute', top: -4, right: -4,
                                width: 16, height: 16, background: '#f43f5e',
                                borderRadius: '50%', fontSize: 9, color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                            }}>6</div>
                        </div>
                        <Avatar name={name} size={36} />
                    </div>
                </header>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>

                    {/* Left/centre column */}
                    <div style={{ flex: 1, padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>

                        {/* Stat cards */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <StatCard
                                icon={Calendar}
                                label="Appointments"
                                value={appointments.length || 345}
                                iconBg="#eff6ff"
                                iconColor="#3b82f6"
                                valueColor="#3b82f6"
                            />
                            <StatCard
                                icon={Activity}
                                label="Hospital Earnings"
                                value="$12,1740"
                                iconBg="#fff7ed"
                                iconColor="#f97316"
                                valueColor="#f97316"
                            />
                            <StatCard
                                icon={Users}
                                label="New Patients"
                                value={patients.length || 899}
                                iconBg="#f0fdf4"
                                iconColor="#22c55e"
                                valueColor="#22c55e"
                            />
                        </div>

                        {/* Survey chart */}
                        <div style={{
                            background: 'white', borderRadius: 16, padding: '1.5rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Hospital Medical Survey</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />
                                        Patients
                                    </span>
                                    <MoreHorizontal size={18} color="#94a3b8" style={{ cursor: 'pointer' }} />
                                </div>
                            </div>
                            <SurveyChart data={surveyData} />
                        </div>

                        {/* Upcoming Appointments table */}
                        <div style={{
                            background: 'white', borderRadius: 16, padding: '1.5rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Upcoming Appointment</h2>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            {['Name', 'Doctore Name', 'Date', 'Time', 'Action'].map(h => (
                                                <th key={h} style={{
                                                    padding: '0.6rem 0.75rem', textAlign: 'left',
                                                    fontSize: '0.8rem', color: '#64748b', fontWeight: 600
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(upcomingAppts.length > 0 ? upcomingAppts.slice(0, 5) : [
                                            { id: '1', pName: 'Maia Hickle', dName: 'Dr. Victoria Welch', date: '10 Sep 2022', time: '11:00 PM' },
                                            { id: '2', pName: 'Roosevelt Mills', dName: 'Dr. Laurence Adams', date: '15 Sep 2022', time: '11:00 PM' },
                                            { id: '3', pName: 'Nona Welch', dName: 'Dr. Lowell Sherman', date: '20 Sep 2022', time: '11:00 PM' },
                                        ]).map((row, i) => {
                                            const pName = row.pName || row.patient?.full_name || row.patient?.email || '—'
                                            const dName = row.dName || `Dr. ${name}`
                                            const date = row.date || row.date || '—'
                                            const time = row.time || row.time || '—'
                                            return (
                                                <tr key={row.id || i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '0.85rem 0.75rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <Avatar name={pName} size={30} />
                                                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{pName}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{dName}</td>
                                                    <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{date}</td>
                                                    <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{time}</td>
                                                    <td style={{ padding: '0.85rem 0.75rem' }}>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            <button title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                                                <XCircle size={18} color="#f43f5e" />
                                                            </button>
                                                            <button title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                                                <Eye size={18} color="#94a3b8" />
                                                            </button>
                                                            <button title="Confirm" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                                                <CheckCircle size={18} color="#22c55e" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div style={{
                        width: 260, flexShrink: 0, padding: '1.5rem 1.5rem 1.5rem 0',
                        display: 'flex', flexDirection: 'column', gap: '1.25rem'
                    }}>

                        {/* Patient spotlight card */}
                        <div style={{
                            borderRadius: 18, overflow: 'hidden',
                            background: 'linear-gradient(145deg, #f87171, #f43f5e)',
                            boxShadow: '0 8px 24px rgba(244,63,94,0.3)', position: 'relative'
                        }}>
                            {/* Settings icon */}
                            <button style={{
                                position: 'absolute', top: 12, right: 12,
                                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            }}>
                                <Settings size={14} color="white" />
                            </button>

                            <div style={{ padding: '1.5rem 1.25rem 1.25rem', textAlign: 'center' }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.25)',
                                    margin: '0 auto 0.75rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.5rem', fontWeight: 800, color: 'white',
                                    border: '3px solid rgba(255,255,255,0.4)'
                                }}>
                                    {spotlight ? (spotlight.full_name || spotlight.email || 'P')[0].toUpperCase() : '👤'}
                                </div>
                                <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                                    {spotlight?.full_name || spotlight?.email || 'Andriem Bertrand'}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 2 }}>
                                    Last check-in: 1 Sep 2022
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.75rem', marginTop: '0.85rem', textAlign: 'left' }}>
                                    {[
                                        ['Sex', spotVitals ? (spotVitals.hr > 80 ? 'Male' : 'Female') : 'Male'],
                                        ['Age', '78'],
                                        ['Dept.', 'Cardiology']
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>{k}</span>
                                            <span style={{ color: 'white', fontSize: '0.78rem', fontWeight: 600 }}>{v}</span>
                                        </div>
                                    ))}
                                </div>

                                <button style={{
                                    marginTop: '0.85rem', background: 'white', border: 'none',
                                    borderRadius: 8, padding: '0.5rem 1.5rem',
                                    color: '#f43f5e', fontWeight: 700, fontSize: '0.8rem',
                                    cursor: 'pointer', width: '100%'
                                }}>
                                    See More
                                </button>
                            </div>
                        </div>

                        {/* Latest Diagnosis */}
                        <div style={{
                            background: 'white', borderRadius: 16, padding: '1.25rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Latest Diagnosis</h3>
                                <MoreVertical size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 38, height: 38, borderRadius: 10,
                                    background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>🫀</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                                        {alertPts.length > 0 ? 'Abnormal Vitals' : 'Heart Disease'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {alertPts.length > 0 ? `${alertPts.length} patient(s) flagged` : 'Dilated Cardiomyopathy'}
                                    </div>
                                </div>
                            </div>
                            <button style={{
                                marginTop: '0.85rem', background: '#fff1f2', border: 'none',
                                borderRadius: 8, padding: '0.4rem 1rem',
                                color: '#f43f5e', fontWeight: 600, fontSize: '0.78rem',
                                cursor: 'pointer'
                            }}>
                                Medical History
                            </button>
                        </div>

                        {/* Gender donut */}
                        <div style={{
                            background: 'white', borderRadius: 16, padding: '1.25rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Gender</h3>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                                <DonutChart male={55} female={30} staff={15} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                {[
                                    { color: '#4ade80', label: 'Medical Staff' },
                                    { color: '#f87171', label: 'Female' },
                                    { color: '#3b82f6', label: 'Male Patients' },
                                ].map(({ color, label }) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Doctor Dashboard styles (scoped via custom attribute) ── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; }
            `}</style>
        </div>
    )
}
