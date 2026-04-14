import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    Activity, Brain, Cpu, Calendar, LayoutDashboard,
    Users, UserCheck, Server, ClipboardList, Shield,
    LogOut, Heart, Stethoscope, ChevronRight, Settings
} from 'lucide-react'

function SidebarLogo() {
    return (
        <div className="sidebar-logo">
            <div style={{ position: 'relative', width: 34, height: 34 }}>
                <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="12" fill="url(#logo-grad)" />
                    <path d="M20 10v20M10 20h20" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                    <defs>
                        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#2563EB" />
                            <stop offset="1" stopColor="#1D4ED8" />
                        </linearGradient>
                    </defs>
                </svg>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)',
                    pointerEvents: 'none'
                }} />
            </div>
            <span>Medicrew</span>
        </div>
    )
}

const patientNav = [
    { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/patient/ai', label: 'AI Assistant', icon: Brain },
    { to: '/patient/devices', label: 'My Device', icon: Cpu },
    { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
]

const doctorNav = [
    { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/doctor/appointments', label: 'Appointments', icon: Calendar },
]

const adminNav = [
    { to: '/admin', label: 'Admin Panel', icon: Shield, end: true },
]

export default function Sidebar() {
    const { profile, role, signOut } = useAuth()
    const navigate = useNavigate()

    const navItems = role === 'doctor' ? doctorNav : role === 'admin' || role === 'superadmin' ? adminNav : patientNav
    const RoleIcon = role === 'doctor' ? Stethoscope : role === 'admin' || role === 'superadmin' ? Shield : Heart

    async function handleSignOut() {
        await signOut()
        navigate('/')
    }

    const initials = (profile?.full_name || profile?.email || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

    return (
        <aside className="sidebar animate-fade">
            <SidebarLogo />
            <nav className="sidebar-nav">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                        id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                        <div className="sidebar-icon-container">
                            <Icon size={20} />
                        </div>
                        <span style={{ flex: 1 }}>{label}</span>
                        <ChevronRight size={14} className="chevron" style={{ opacity: 0.3 }} />
                    </NavLink>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{profile?.full_name || profile?.email}</div>
                        <div className="sidebar-user-role">
                            <RoleIcon size={12} />
                            {role}
                        </div>
                    </div>
                </div>
                <button onClick={handleSignOut} className="sidebar-link" id="sign-out-btn" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                    <LogOut size={20} /> <span>Sign Out</span>
                </button>
            </div>
        </aside>
    )
}
