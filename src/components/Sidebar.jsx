import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    Activity, Brain, Cpu, Calendar, LayoutDashboard,
    Users, UserCheck, Server, ClipboardList, Shield,
    LogOut, Heart, Stethoscope
} from 'lucide-react'

function SidebarLogo() {
    return (
        <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#2563EB" />
                <path d="M16 6v20M6 16h20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.35" />
            </svg>
            MediCrew
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
        <aside className="sidebar">
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
                        <Icon size={19} />
                        {label}
                    </NavLink>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{profile?.full_name || profile?.email}</div>
                        <div className="sidebar-user-role">
                            <RoleIcon size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {role}
                        </div>
                    </div>
                </div>
                <button onClick={handleSignOut} className="sidebar-link" id="sign-out-btn" style={{ color: '#dc2626', marginTop: '0.25rem' }}>
                    <LogOut size={17} /> Sign Out
                </button>
            </div>
        </aside>
    )
}
