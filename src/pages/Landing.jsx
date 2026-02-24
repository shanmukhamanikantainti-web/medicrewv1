import { Link } from 'react-router-dom'
import { Activity, Brain, Cpu, Shield, Users, Zap, ArrowRight, Heart, CheckCircle } from 'lucide-react'
import './Landing.css'

export default function Landing() {
    console.log('Landing Page Rendering')
    return (
        <div className="landing">
            {/* Header */}
            <header className="landing-header">
                <div className="landing-header-inner">
                    <Link to="/" className="landing-logo">
                        <div className="logo-icon">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <rect width="32" height="32" rx="8" fill="#2563EB" />
                                <path d="M16 6v20M6 16h20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.35" />
                            </svg>
                        </div>
                        <span>MediCrew</span>
                    </Link>
                    <nav className="landing-nav">
                        <a href="#features">Features</a>
                        <a href="#how">How it Works</a>
                        <Link to="/auth" className="btn btn-primary btn-sm">Login</Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="hero">
                <div className="hero-badge">
                    <Zap size={14} /> AI-Powered Healthcare Platform
                </div>
                <h1 className="hero-title">
                    MediCrew — Intelligent<br />
                    <span className="hero-gradient">Healthcare in Real Time</span>
                </h1>
                <p className="hero-subtitle">
                    AI-powered health monitoring and connected medical response.<br />
                    One secure platform for patients, doctors, and administrators.
                </p>
                <div className="hero-ctas">
                    <Link to="/auth?role=patient" className="btn btn-primary btn-xl">
                        Get Started as Patient <ArrowRight size={18} />
                    </Link>
                    <Link to="/auth?role=doctor" className="btn btn-outline btn-xl">
                        Join as Doctor
                    </Link>
                </div>
                <div className="hero-stats">
                    {[
                        { value: 'AI + IoT', label: 'Integrated' },
                        { value: 'OTP', label: 'Secure Auth' },
                        { value: 'RBAC', label: 'Role-Based Access' },
                        { value: '24/7', label: 'Monitoring' },
                    ].map(s => (
                        <div key={s.label} className="hero-stat">
                            <span className="hero-stat-value">{s.value}</span>
                            <span className="hero-stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Hero Visual */}
                <div className="hero-visual">
                    <div className="hero-card floating">
                        <div className="hero-card-header">
                            <div className="live-dot" style={{ marginRight: 8 }} />
                            Live Health Monitor
                        </div>
                        <div className="hero-vitals">
                            <div className="hero-vital"><span className="hero-vital-val red">72</span><span>bpm</span><div>Heart Rate</div></div>
                            <div className="hero-vital"><span className="hero-vital-val blue">98%</span><span></span><div>SpO₂</div></div>
                            <div className="hero-vital"><span className="hero-vital-val orange">36.8°</span><span></span><div>Temp</div></div>
                            <div className="hero-vital"><span className="hero-vital-val purple">120/80</span><span></span><div>Blood Pressure</div></div>
                        </div>
                    </div>
                    <div className="hero-card floating-slow" style={{ marginTop: '1rem' }}>
                        <div className="hero-card-header">
                            <Brain size={16} style={{ color: '#7c3aed' }} />AI Health Assistant
                        </div>
                        <p className="hero-card-body">Symptom analysed → <strong>Tension headache</strong> · Urgency: <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Low</span></p>
                        <p className="hero-card-hint">✓ First aid steps generated</p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="features" id="features">
                <div className="features-inner">
                    <div className="section-label">What We Offer</div>
                    <h2 className="section-title-lg">Everything You Need in One Platform</h2>
                    <div className="features-grid">
                        {features.map(f => (
                            <div key={f.title} className="feature-card">
                                <div className="feature-icon" style={{ background: f.bg }}>
                                    <f.icon size={24} color={f.color} />
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="how-it-works" id="how">
                <div className="features-inner">
                    <div className="section-label">How It Works</div>
                    <h2 className="section-title-lg">Three Roles, One Seamless System</h2>
                    <div className="roles-grid">
                        {roles.map(r => (
                            <div key={r.name} className="role-card" style={{ borderColor: r.color + '30' }}>
                                <div className="role-icon" style={{ background: r.color + '15', color: r.color }}>
                                    <r.icon size={28} />
                                </div>
                                <h3 style={{ color: r.color }}>{r.name}</h3>
                                <ul>
                                    {r.points.map(p => (
                                        <li key={p}><CheckCircle size={14} style={{ color: r.color }} />{p}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="cta-section">
                <div className="cta-inner">
                    <h2>Ready to Transform Your Healthcare Experience?</h2>
                    <p>Join MediCrew and experience intelligent healthcare management.</p>
                    <div className="hero-ctas">
                        <Link to="/auth?role=patient" className="btn btn-primary btn-xl">
                            Get Started Free <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="landing-logo" style={{ marginBottom: '0.5rem', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="8" fill="#2563EB" />
                        <path d="M16 6v20M6 16h20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span>MediCrew</span>
                </div>
                <p>© 2026 MediCrew. Intelligent Healthcare in Real Time.</p>
            </footer>
        </div>
    )
}

const features = [
    { icon: Brain, title: 'AI Health Assistant', desc: 'Upload symptoms + images for instant AI-powered preliminary health analysis with recommended first aid.', bg: '#f3e8ff', color: '#7c3aed' },
    { icon: Cpu, title: 'IoT Device Monitoring', desc: 'Connect your health device and monitor Heart Rate, SpO₂, Temperature, and Blood Pressure in real time.', bg: '#ecfdf5', color: '#059669' },
    { icon: Shield, title: 'Secure OTP Auth', desc: 'Email-based One-Time Password login with auto-expiry. All rolevalidation happens server-side only.', bg: '#eff6ff', color: '#2563eb' },
    { icon: Users, title: 'Role-Based Access', desc: 'Four-tier RBAC — Patient, Doctor, Admin, SuperAdmin. Each role sees only what they\'re allowed to.', bg: '#fff7ed', color: '#ea580c' },
    { icon: Activity, title: 'Live Polling Updates', desc: 'High-priority data refreshes every 3–5s, medium-priority every 10–15s with tab-inactivity optimization.', bg: '#fdf2f8', color: '#db2777' },
    { icon: Heart, title: 'Admin Governance', desc: 'Full audit logging, temporary admin assignment, doctor verification, and device management in one dashboard.', bg: '#fef2f2', color: '#dc2626' },
]

const roles = [
    {
        name: 'Patient', icon: Heart, color: '#2563eb',
        points: ['AI health analysis anytime', 'Connect IoT health device', 'View live health metrics', 'Book doctor appointments']
    },
    {
        name: 'Doctor', icon: Activity, color: '#059669',
        points: ['Monitor assigned patients', 'Receive abnormal vitals alerts', 'Manage appointments', 'Upload verification credentials']
    },
    {
        name: 'Admin / SuperAdmin', icon: Shield, color: '#7c3aed',
        points: ['Approve/reject doctors', 'Manage all devices', 'View full audit logs', 'Grant temporary admin access']
    }
]
