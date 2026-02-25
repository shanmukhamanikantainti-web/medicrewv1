import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    LayoutDashboard, Users, Calendar, Settings,
    HelpCircle, LogOut, Mail, ChevronDown,
    Search, Heart, Activity
} from 'lucide-react'

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function generateVitals() {
    return {
        sys: Math.floor(Math.random() * 20 + 115),
        dia: Math.floor(Math.random() * 12 + 72),
        pulse: Math.floor(Math.random() * 30 + 108),
        weight: (Math.random() * 3 + 78.5).toFixed(1),
        spo2: Math.floor(Math.random() * 5 + 95),
    }
}

/* ─────────────────────────────────────────
   Mini Sparkline (SVG)
───────────────────────────────────────── */
function Sparkline({ data, color = '#ef4444', height = 48, width = 110 }) {
    if (!data || data.length < 2) return null
    const max = Math.max(...data), min = Math.min(...data)
    const pad = 4
    const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (width - pad * 2))
    const ys = data.map(v => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2))
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {xs.map((x, i) => (
                <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="white" stroke={color} strokeWidth="1.5" />
            ))}
        </svg>
    )
}

/* ─────────────────────────────────────────
   ECG Waveform (SVG animated)
───────────────────────────────────────── */
function ECGWave({ width = 600 }) {
    // One QRS-like segment repeated
    const seg = [0, 0, 0, 2, 0, -2, 18, -14, 4, 0, 0, 0, 0]
    const pts = []
    const step = 18
    let x = 0
    for (let r = 0; r < 4; r++) {
        seg.forEach((y, i) => {
            pts.push([x, 50 + y * 2])
            x += step / seg.length * 1.4
        })
    }
    const path = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ')
    return (
        <svg width="100%" height="80" viewBox={`0 0 ${x} 100`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="ecgGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.1" />
                </linearGradient>
                {/* Grid lines */}
            </defs>
            {/* Grid */}
            {Array.from({ length: 5 }, (_, i) => (
                <line key={i} x1="0" y1={i * 25} x2={x} y2={i * 25} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {Array.from({ length: Math.ceil(x / 20) }, (_, i) => (
                <line key={i} x1={i * 20} y1="0" x2={i * 20} y2="100" stroke="#f1f5f9" strokeWidth="1" />
            ))}
            <path d={path} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                <animateTransform
                    attributeName="transform"
                    type="translate"
                    from={`${-x} 0`}
                    to="0 0"
                    dur="3s"
                    repeatCount="indefinite"
                />
            </path>
            {/* Second copy for seamless loop */}
            <path d={path} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                <animateTransform
                    attributeName="transform"
                    type="translate"
                    from="0 0"
                    to={`${x} 0`}
                    dur="3s"
                    repeatCount="indefinite"
                />
            </path>
        </svg>
    )
}

/* ─────────────────────────────────────────
   Systolic Bar Chart (SVG)
───────────────────────────────────────── */
function SystolicChart({ data }) {
    // data = [{label, pct, color}]
    const W = 180, H = 90, pad = { l: 8, r: 8, t: 8, b: 28 }
    const barW = 24, gap = (W - pad.l - pad.r - data.length * barW) / (data.length - 1)
    const maxPct = 60
    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H + pad.t + pad.b}`} preserveAspectRatio="xMidYMid meet">
            {/* Y gridlines */}
            {[0, 20, 40, 60].map(v => {
                const y = H + pad.t - (v / maxPct) * H
                return <line key={v} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            })}
            {data.map(({ label, pct, color }, i) => {
                const bh = (pct / maxPct) * H
                const bx = pad.l + i * (barW + gap)
                const by = pad.t + H - bh
                return (
                    <g key={label}>
                        <rect x={bx} y={by} width={barW} height={bh}
                            fill={color} rx="4"
                            style={{ transition: 'height 0.6s ease, y 0.6s ease' }} />
                        {/* % label above bar */}
                        <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
                            {pct}%
                        </text>
                        {/* range label below */}
                        <text x={bx + barW / 2} y={H + pad.t + pad.b - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                            {label}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}

/* ─────────────────────────────────────────
   Avatar
───────────────────────────────────────── */
function Avatar({ name, size = 32 }) {
    const initials = (name || 'P').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#0ea5e9']
    const bg = colors[(name || '').charCodeAt(0) % colors.length]
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0
        }}>{initials}</div>
    )
}

/* ─────────────────────────────────────────
   Sidebar nav
───────────────────────────────────────── */
const patientNavItems = [
    { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/patient/records', label: 'Patients', icon: Users },
    { to: '/patient/appointments', label: 'Calendar', icon: Calendar },
    { to: '/patient/settings', label: 'Settings', icon: Settings },
    { to: '/patient/support', label: 'Support', icon: HelpCircle },
]

/* ─────────────────────────────────────────
   VitalCard (dark phone style)
───────────────────────────────────────── */
function DarkVitalCard({ label, value, unit, sparkData, accent }) {
    return (
        <div style={{
            background: '#1e293b', borderRadius: 16, padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: 6,
            minWidth: 110, boxShadow: '0 4px 16px rgba(30,41,59,0.18)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
                <Heart size={14} color={accent} fill={accent} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{unit}</span>
            </div>
            <Sparkline data={sparkData} color={accent} height={40} width={100} />
        </div>
    )
}

/* ─────────────────────────────────────────
   LightVitalCard (white, right column)
───────────────────────────────────────── */
function LightVitalCard({ label, value, unit, icon: Icon, accent, sparkData }) {
    return (
        <div style={{
            background: 'white', borderRadius: 14, padding: '0.9rem 1rem',
            border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'flex', flexDirection: 'column', gap: 4
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                <Icon size={14} color={accent} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{unit}</span>
            </div>
            {sparkData && <Sparkline data={sparkData} color={accent} height={36} width={90} />}
        </div>
    )
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function PatientDashboard() {
    const { profile, user, signOut } = useAuth()
    const navigate = useNavigate()
    const [vitals, setVitals] = useState(generateVitals())
    const [device, setDevice] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [sysHistory, setSysHistory] = useState(() => Array.from({ length: 8 }, () => Math.floor(Math.random() * 20 + 115)))
    const [diaHistory, setDiaHistory] = useState(() => Array.from({ length: 8 }, () => Math.floor(Math.random() * 12 + 72)))
    const [pulseHistory, setPulseHistory] = useState(() => Array.from({ length: 8 }, () => Math.floor(Math.random() * 30 + 108)))

    /* Poll vitals */
    useEffect(() => {
        const iv = setInterval(() => {
            if (document.visibilityState !== 'visible') return
            const v = generateVitals()
            setVitals(v)
            setSysHistory(h => [...h.slice(-7), v.sys])
            setDiaHistory(h => [...h.slice(-7), v.dia])
            setPulseHistory(h => [...h.slice(-7), v.pulse])
        }, 4000)
        return () => clearInterval(iv)
    }, [])

    useEffect(() => {
        if (!user) return
        supabase.from('devices').select('*').eq('patient_id', user.id).eq('status', 'active').single()
            .then(({ data }) => data && setDevice(data))
        supabase.from('appointments').select('*, profiles!doctor_id(full_name)')
            .eq('patient_id', user.id).order('date', { ascending: true }).limit(5)
            .then(({ data }) => data && setAppointments(data))
    }, [user])

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Patient'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

    async function handleSignOut() {
        await signOut()
        navigate('/')
    }

    const systolicBars = [
        { label: '0-89', pct: 20, color: '#f97316' },
        { label: '90-119', pct: 35, color: '#6d28d9' },
        { label: '140-159', pct: 53, color: '#94a3b8' },
        { label: '150-500', pct: 30, color: '#e2e8f0' },
    ]

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>

            {/* ── SIDEBAR ── */}
            <aside style={{
                width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column',
                position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
            }}>
                {/* Brand */}
                <div style={{
                    padding: '1.25rem 1.25rem 0',
                    fontWeight: 900, fontSize: '1.1rem', color: '#1e293b', letterSpacing: '-0.5px'
                }}>
                    Smart Care
                </div>

                {/* Greeting card */}
                <div style={{
                    margin: '1rem 0.75rem',
                    borderRadius: 16, overflow: 'hidden',
                    background: 'linear-gradient(160deg, #f97316 0%, #7c3aed 100%)',
                    padding: '1.25rem 1rem',
                    boxShadow: '0 8px 20px rgba(124,58,237,0.25)',
                    position: 'relative', minHeight: 110
                }}>
                    {/* Decorative blob */}
                    <div style={{
                        position: 'absolute', bottom: -18, right: -18,
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.12)'
                    }} />
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{greeting}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white', marginTop: 4, lineHeight: 1.2 }}>
                        {name.split(' ').slice(0, 2).join('\n')}
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {patientNavItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '0.6rem 0.875rem', borderRadius: 10,
                                color: isActive ? '#f97316' : '#64748b',
                                fontWeight: isActive ? 700 : 500, fontSize: '0.875rem',
                                textDecoration: 'none',
                                background: isActive ? '#fff7ed' : 'transparent',
                                transition: 'all 0.15s ease'
                            })}
                        >
                            <Icon size={17} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Log out */}
                <div style={{ padding: '1rem 0.75rem' }}>
                    <button onClick={handleSignOut} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '0.6rem 0.875rem', borderRadius: 10,
                        color: '#64748b', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, width: '100%'
                    }}>
                        <LogOut size={17} />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* ── MAIN ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Top bar */}
                <header style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.85rem 2rem', background: 'white',
                    borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10
                }}>
                    {/* Breadcrumb + Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280, flex: 1 }}>
                            <Search size={15} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Search patients here ..."
                                style={{
                                    border: 'none', outline: 'none', background: 'transparent',
                                    fontSize: '0.875rem', color: '#64748b', fontFamily: 'inherit', width: '100%'
                                }}
                            />
                        </div>
                    </div>
                    {/* Right: mail + user */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ position: 'relative', cursor: 'pointer' }}>
                            <Mail size={20} color="#64748b" />
                            <span style={{
                                position: 'absolute', top: -5, right: -5,
                                background: '#f97316', color: 'white', fontSize: 9,
                                borderRadius: 10, padding: '1px 4px', fontWeight: 700
                            }}>3</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <Avatar name={name} size={32} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                {name.length > 16 ? name.slice(0, 16) + '…' : name}
                            </span>
                            <ChevronDown size={14} color="#94a3b8" />
                        </div>
                    </div>
                </header>

                {/* Breadcrumb */}
                <div style={{ padding: '0.6rem 2rem', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Patients</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 6px' }}>›</span>
                    <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                        {name}
                    </span>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* ── Patient Info Row ── */}
                    <div style={{
                        background: 'white', borderRadius: 18, padding: '1.5rem 2rem',
                        display: 'flex', alignItems: 'center', gap: '2rem',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
                        flexWrap: 'wrap'
                    }}>
                        {/* Avatar large */}
                        <div style={{
                            width: 90, height: 90, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #e0e7ff, #f0fdf4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.5rem', flexShrink: 0,
                            border: '3px solid #e2e8f0'
                        }}>
                            🧑‍⚕️
                        </div>

                        {/* Name + button */}
                        <div style={{ flex: 1, minWidth: 140 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Patient</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.1 }}>{name}</div>
                            <button style={{
                                marginTop: '0.75rem', background: 'none',
                                border: '1.5px solid #e2e8f0', borderRadius: 8,
                                padding: '0.35rem 1rem', fontSize: '0.75rem',
                                fontWeight: 600, color: '#64748b', cursor: 'pointer',
                                letterSpacing: 0.5, textTransform: 'uppercase'
                            }}>View Profile</button>
                        </div>

                        {/* Info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2.5rem', fontSize: '0.875rem' }}>
                            {[
                                ['Sex', 'Male'],
                                ['Check-in', '24 Feb, 2020'],
                                ['Age', '32'],
                                ['Dept:', 'Cardiology'],
                                ['Blood', 'B+'],
                                ['Bed #', '0747'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 8 }}>
                                    <span style={{ color: '#94a3b8', fontWeight: 500, minWidth: 50 }}>{k}:</span>
                                    <span style={{ color: '#1e293b', fontWeight: 700 }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Vitals + Systolic row ── */}
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>

                        {/* SYS dark card */}
                        <DarkVitalCard
                            label="SYS"
                            value={vitals.sys}
                            unit="mmHg"
                            sparkData={sysHistory}
                            accent="#f43f5e"
                        />

                        {/* DIA + Pulse + Weight (stacked white) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minWidth: 180 }}>
                            <LightVitalCard label="DIA" value={vitals.dia} unit="mmHg" icon={Heart} accent="#6d28d9" sparkData={diaHistory} />
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                    <LightVitalCard label="Pulse" value={vitals.pulse} unit="BPM" icon={Activity} accent="#f97316" sparkData={pulseHistory} />
                                </div>
                                <div style={{ flex: 1, background: 'white', borderRadius: 14, padding: '0.9rem 1rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Weight</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{vitals.weight}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>kg</span>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#4ade80', fontWeight: 600 }}>● Normal</div>
                                </div>
                            </div>
                        </div>

                        {/* Systolic Analysis bar chart */}
                        <div style={{
                            background: 'white', borderRadius: 16, padding: '1rem 1.25rem',
                            flex: 1, minWidth: 200,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Systolic Analysis</div>
                            <SystolicChart data={systolicBars} />
                        </div>
                    </div>

                    {/* ── ECG ── */}
                    <div style={{
                        background: 'white', borderRadius: 18, padding: '1.25rem 1.5rem',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ECG Data</h3>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 1.2s infinite' }} />
                                Live
                            </span>
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <ECGWave />
                        </div>
                    </div>

                    {/* ── Appointments row (bonus) ── */}
                    {appointments.length > 0 && (
                        <div style={{
                            background: 'white', borderRadius: 18, padding: '1.25rem 1.5rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9'
                        }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.85rem' }}>Upcoming Appointments</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {appointments.slice(0, 3).map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: 10
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Dr. {a.profiles?.full_name || 'TBD'}
                                            </div>
                                            <div style={{ fontSize: '0.775rem', color: '#94a3b8', marginTop: 2 }}>
                                                {a.date}{a.time ? ` • ${a.time}` : ''}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.65rem',
                                            borderRadius: 20,
                                            background: a.status === 'confirmed' ? '#dcfce7' : '#fff7ed',
                                            color: a.status === 'confirmed' ? '#16a34a' : '#f97316'
                                        }}>{a.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; }
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
            `}</style>
        </div>
    )
}
