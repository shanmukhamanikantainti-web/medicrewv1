import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    Users, Stethoscope, Cpu, Calendar, Shield, ClipboardList,
    CheckCircle, XCircle, Clock, Trash2, RefreshCw, UserPlus,
    AlertCircle, ShieldCheck, ShieldOff, Monitor, Activity
} from 'lucide-react'

const TABS = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'admins', label: 'Admin Mgmt', icon: Shield },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
]

async function logAudit(supabase, adminId, action, targetId = null) {
    await supabase.from('audit_logs').insert([{ admin_id: adminId, action, target_user_id: targetId }])
}

export default function AdminDashboard() {
    const { user, isSuperAdmin } = useAuth()
    const [tab, setTab] = useState('users')

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <header className="page-header">
                    <div className="header-content">
                        <div className="header-icon">
                            <Shield size={24} />
                        </div>
                        <div className="header-text">
                            <h1 className="page-title">Admin Dashboard</h1>
                            <p className="page-subtitle">Centralized system governance and audit-logged operations</p>
                        </div>
                    </div>
                </header>

                <div className="page-content">
                    <div className="tabs-container">
                        <div className="tabs">
                            <button
                                className={`tab-btn ${tab === 'users' ? 'active' : ''}`}
                                onClick={() => setTab('users')}
                            >
                                <Users size={18} />
                                Users Inventory
                            </button>
                            <button
                                className={`tab-btn ${tab === 'devices' ? 'active' : ''}`}
                                onClick={() => setTab('devices')}
                            >
                                <Monitor size={18} />
                                Device Network
                            </button>
                            <button
                                className={`tab-btn ${tab === 'stats' ? 'active' : ''}`}
                                onClick={() => setTab('stats')}
                            >
                                <Activity size={18} />
                                Analytics
                            </button>
                        </div>
                    </div>

                    <div className="tab-pane-content">
                        {tab === 'users' && <UsersTab adminId={user?.id} />}
                        {tab === 'doctors' && <DoctorsTab adminId={user?.id} />}
                        {tab === 'devices' && <DevicesTab adminId={user?.id} />}
                        {tab === 'appointments' && <AppointmentsTab />}
                        {tab === 'admins' && <AdminsTab adminId={user?.id} isSuperAdmin={isSuperAdmin} />}
                        {tab === 'audit' && <AuditTab />}
                        {tab === 'stats' && <StatsTab />}
                    </div>
                </div>
            </main>
        </div>
    )
}

/* ── Users Tab ── */
function UsersTab({ adminId }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState({}) // per-row loading state

    const fetchUsers = () => {
        setLoading(true)
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { setUsers(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    async function toggleVerify(u) {
        const newVerified = !u.verified
        setActionLoading(prev => ({ ...prev, [u.id + '_verify']: true }))
        const { error } = await supabase.from('profiles').update({ verified: newVerified }).eq('id', u.id)
        if (error) {
            alert('Error updating verification: ' + error.message)
        } else {
            await logAudit(supabase, adminId, `${newVerified ? 'Verified' : 'Unverified'} user ${u.email}`, u.id)
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, verified: newVerified } : x))
        }
        setActionLoading(prev => ({ ...prev, [u.id + '_verify']: false }))
    }

    async function deleteUser(id, email) {
        if (!confirm(`PERMANENTLY DELETE user ${email}? This action cannot be undone and will remove them from Authentication.`)) return
        setActionLoading(prev => ({ ...prev, [id + '_delete']: true }))
        const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: id })
        if (error) {
            alert('Error deleting user: ' + error.message + '\n\nNote: If this is the first time, make sure you\'ve run the SQL function in Supabase.')
            setActionLoading(prev => ({ ...prev, [id + '_delete']: false }))
            return
        }
        await logAudit(supabase, adminId, `Deleted user ${email}`, id)
        setUsers(u => u.filter(x => x.id !== id))
    }

    const roleColor = { patient: 'badge-blue', doctor: 'badge-green', admin: 'badge-orange', superadmin: 'badge-red' }

    return (
        <div className="glass-panel section-container">
            <div className="section-header">
                <div className="section-header-text">
                    <h2 className="section-title">Directory</h2>
                    <p className="section-subtitle">Real-time user authorization and lifecycle management</p>
                </div>
                <div className="section-actions">
                    <span className="badge badge-outline">{users.length} Total Users</span>
                    <button className="btn btn-secondary btn-sm" onClick={fetchUsers} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        <span>Sync</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={24} className="spin" />
                    <p>Securing connection...</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="ethereal-table">
                        <thead>
                            <tr>
                                <th>Identity</th>
                                <th>Access Level</th>
                                <th>Validation</th>
                                <th className="text-right">Governance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="user-identity">
                                            <span className="user-name">{u.full_name || 'Anonymous User'}</span>
                                            <span className="user-email">{u.email}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${roleColor[u.role] || 'badge-gray'}`}>
                                            {u.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        {u.verified ? (
                                            <span className="status-indicator status-online">
                                                <CheckCircle size={12} /> Verified
                                            </span>
                                        ) : (
                                            <span className="status-indicator status-offline">
                                                <Clock size={12} /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="table-actions justify-end">
                                            {u.role !== 'superadmin' && (
                                                <button
                                                    id={`verify-btn-${u.id}`}
                                                    className={`btn btn-sm ${u.verified ? 'btn-outline' : 'btn-primary'}`}
                                                    onClick={() => toggleVerify(u)}
                                                    disabled={actionLoading[u.id + '_verify']}
                                                >
                                                    {actionLoading[u.id + '_verify'] ? (
                                                        <RefreshCw size={12} className="spin" />
                                                    ) : u.verified ? (
                                                        <ShieldOff size={12} />
                                                    ) : (
                                                        <ShieldCheck size={12} />
                                                    )}
                                                    {u.verified ? 'Suspend' : 'Validate'}
                                                </button>
                                            )}
                                            {u.role !== 'superadmin' && (
                                                <button
                                                    id={`delete-btn-${u.id}`}
                                                    className="btn btn-sm btn-ghost btn-danger"
                                                    onClick={() => deleteUser(u.id, u.email)}
                                                    disabled={actionLoading[u.id + '_delete']}
                                                >
                                                    {actionLoading[u.id + '_delete'] ? (
                                                        <RefreshCw size={12} className="spin" />
                                                    ) : (
                                                        <Trash2 size={13} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/* ── Doctors Tab ── */
function DoctorsTab({ adminId }) {
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    const fetchDoctors = () => {
        setLoading(true)
        supabase.from('profiles').select('*').eq('role', 'doctor').order('created_at', { ascending: false })
            .then(({ data }) => { setDoctors(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchDoctors()
    }, [])

    async function approve(id, email) {
        await supabase.from('profiles').update({ verified: true }).eq('id', id)
        await logAudit(supabase, adminId, `Approved doctor ${email}`, id)
        setDoctors(d => d.map(x => x.id === id ? { ...x, verified: true } : x))
    }

    async function reject(id, email) {
        if (!confirm(`Reject and remove doctor ${email}?`)) return
        await supabase.from('profiles').update({ role: 'patient', verified: false }).eq('id', id)
        await logAudit(supabase, adminId, `Rejected doctor ${email}`, id)
        setDoctors(d => d.filter(x => x.id !== id))
    }

    return (
        <div className="glass-panel section-container">
            <div className="section-header">
                <div className="section-header-text">
                    <h2 className="section-title">Clinical Personnel</h2>
                    <p className="section-subtitle">Credential verification and medical staff onboarding</p>
                </div>
                <div className="section-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetchDoctors} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                        <UserPlus size={14} />
                        <span>Appoint Doctor</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={24} className="spin" />
                </div>
            ) : doctors.length === 0 ? (
                <div className="empty-state">
                    <Stethoscope size={40} />
                    <h3>No Practitioners Found</h3>
                    <p>Onboard qualified medical staff to begin operations.</p>
                </div>
            ) : (
                <div className="table-wrapper animate-fade">
                    <table className="ethereal-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Verified</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.map(d => (
                                <tr key={d.id}>
                                    <td>
                                        <div className="user-identity">
                                            <span className="user-name">{d.full_name || 'Dr. Unknown'}</span>
                                            <span className="user-email">{d.email}</span>
                                        </div>
                                    </td>
                                    <td>Medical Degree Verified</td>
                                    <td>
                                        {d.verified ? (
                                            <span className="badge badge-green">Validated</span>
                                        ) : (
                                            <span className="badge badge-yellow">Under Review</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="table-actions justify-end">
                                            {!d.verified && (
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => approve(d.id, d.email)}
                                                >
                                                    Approve
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-sm btn-ghost btn-danger"
                                                onClick={() => reject(d.id, d.email)}
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && <AddDoctorModal onClose={() => setShowAddModal(false)} onAdded={fetchDoctors} adminId={adminId} />}
        </div>
    )
}

function AddDoctorModal({ onClose, onAdded, adminId }) {
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    async function handleAdd(e) {
        e.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            // Find user by email
            const { data: user, error: findError } = await supabase.from('profiles').select('*').eq('email', email).single()

            if (findError) throw new Error("User not found with this email.")
            if (user.role === 'doctor') throw new Error("User is already a doctor.")

            // Promote to doctor
            const { error: promoError } = await supabase.from('profiles')
                .update({ role: 'doctor', verified: true })
                .eq('id', user.id)

            if (promoError) throw promoError

            await logAudit(supabase, adminId, `Promoted ${email} to doctor`, user.id)
            onAdded()
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal glass-panel glass-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <UserPlus className="modal-icon" />
                        <h3 className="modal-title">Elevate to Practitioner</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}><XCircle size={20} /></button>
                </div>
                <div className="modal-body">
                    <p className="modal-description">
                        Upgrade an existing user to doctor status. This grants them clinical management permissions.
                    </p>
                    <form onSubmit={handleAdd} className="modal-form">
                        <div className="form-group">
                            <label className="form-label">Search Identity by Email</label>
                            <div className="input-group">
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="doctor@medicrew.ai"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <div className="form-error">{error}</div>}
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={onClose}>Dismiss</button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? <RefreshCw size={14} className="spin" /> : 'Confirm Elevation'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

/* ── Devices Tab ── */
function DevicesTab({ adminId }) {
    const [devices, setDevices] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchDevices = () => {
        setLoading(true)
        supabase.from('devices').select('*, patient:patient_id(full_name, email)').order('created_at', { ascending: false })
            .then(({ data }) => { setDevices(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchDevices()
    }, [])

    async function toggle(dev) {
        const newStatus = dev.status === 'active' ? 'inactive' : 'active'
        await supabase.from('devices').update({ status: newStatus }).eq('id', dev.id)
        await logAudit(supabase, adminId, `Set device ${dev.device_id} to ${newStatus}`, dev.patient_id)
        setDevices(d => d.map(x => x.id === dev.id ? { ...x, status: newStatus } : x))
    }

    async function unbind(dev) {
        await supabase.from('devices').update({ patient_id: null, status: 'inactive' }).eq('id', dev.id)
        await logAudit(supabase, adminId, `Unbound device ${dev.device_id}`, dev.patient_id)
        setDevices(d => d.map(x => x.id === dev.id ? { ...x, patient_id: null, patient: null, status: 'inactive' } : x))
    }

    return (
        <div className="glass-panel section-container">
            <div className="section-header">
                <div className="section-header-text">
                    <h2 className="section-title">Telemetry Nodes</h2>
                    <p className="section-subtitle">Infrastructure monitoring and terminal deployment status</p>
                </div>
                <div className="section-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetchDevices} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={24} className="spin" />
                </div>
            ) : devices.length === 0 ? (
                <div className="empty-state">
                    <Cpu size={40} />
                    <h3>No Active Nodes</h3>
                    <p>Register hardware terminals to begin telemetry ingestion.</p>
                </div>
            ) : (
                <div className="table-wrapper animate-fade">
                    <table className="ethereal-table">
                        <thead>
                            <tr>
                                <th>Serial Number</th>
                                <th>Patient</th>
                                <th>Status</th>
                                <th>Last Pulse</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(dev => (
                                <tr key={dev.id}>
                                    <td>
                                        <code className="terminal-code">{dev.device_id}</code>
                                    </td>
                                    <td>
                                        {dev.patient?.full_name || dev.patient?.email ? (
                                            <div className="user-identity">
                                                <span className="user-name">{dev.patient.full_name}</span>
                                            </div>
                                        ) : (
                                            <span className="status-offline">Offline / Unbound</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-indicator ${dev.status === 'active' ? 'status-online' : 'status-offline'}`}>
                                            {dev.status === 'active' ? 'Broadcasting' : 'Standby'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="timestamp">
                                            {dev.last_sync ? new Date(dev.last_sync).toLocaleTimeString() : 'Infinite'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions justify-end">
                                            <button
                                                className={`btn btn-sm ${dev.status === 'active' ? 'btn-outline' : 'btn-secondary'}`}
                                                onClick={() => toggle(dev)}
                                            >
                                                {dev.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </button>
                                            {dev.patient_id && (
                                                <button
                                                    className="btn btn-sm btn-ghost btn-danger"
                                                    onClick={() => unbind(dev)}
                                                >
                                                    Release
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/* ── Appointments Tab ── */
function AppointmentsTab() {
    const [appts, setAppts] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchAppts = () => {
        setLoading(true)
        supabase.from('appointments').select('*, patient:patient_id(full_name, email), doctor:doctor_id(full_name)').order('date', { ascending: false }).limit(50)
            .then(({ data }) => { setAppts(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchAppts()
    }, [])

    const statusBadge = { pending: 'badge-yellow', confirmed: 'badge-green', cancelled: 'badge-red', completed: 'badge-gray' }

    return (
        <div className="glass-panel section-container">
            <div className="section-header">
                <div className="section-header-text">
                    <h2 className="section-title">Clinical Encounters</h2>
                    <p className="section-subtitle">System-wide appointment synchronization and patient schedules</p>
                </div>
                <div className="section-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetchAppts} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={24} className="spin" />
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="ethereal-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Practitioner</th>
                                <th>Schedule</th>
                                <th>Status</th>
                                <th className="text-right">Manifest</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appts.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        <div className="user-identity">
                                            <span className="user-name">{a.patient?.full_name || a.patient?.email}</span>
                                        </div>
                                    </td>
                                    <td>{a.doctor?.full_name || 'Standard Routing'}</td>
                                    <td>
                                        <div className="schedule-cell">
                                            <span className="date">{a.date}</span>
                                            <span className="time">{a.time}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${statusBadge[a.status] || 'badge-gray'}`}>
                                            {a.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <span className="manifest-notes" title={a.notes}>
                                            {a.notes || 'No supplemental data'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/* ── Admins Tab ── */
function AdminsTab({ adminId, isSuperAdmin }) {
    const [users, setUsers] = useState([])
    const [selected, setSelected] = useState('')
    const [hours, setHours] = useState(24)
    const [granting, setGranting] = useState(false)
    const [loading, setLoading] = useState(true)

    const fetchAdmins = () => {
        setLoading(true)
        supabase.from('profiles').select('id, full_name, email, role, temp_admin_expires_at')
            .in('role', ['patient', 'doctor', 'admin']).order('created_at', { ascending: false })
            .then(({ data }) => { setUsers(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchAdmins()
    }, [])

    async function grantAdmin() {
        if (!selected || !isSuperAdmin) return
        setGranting(true)
        const expiry = new Date(Date.now() + hours * 3600000).toISOString()
        const target = users.find(u => u.id === selected)
        await supabase.from('profiles').update({
            role: 'admin', previous_role: target.role, temp_admin_expires_at: expiry
        }).eq('id', selected)
        await logAudit(supabase, adminId, `Granted temp admin to ${target.email} for ${hours}h`, selected)
        setUsers(u => u.map(x => x.id === selected ? { ...x, role: 'admin', temp_admin_expires_at: expiry } : x))
        setGranting(false)
    }

    async function revokeAdmin(id, email) {
        await supabase.from('profiles').update({ role: 'patient', temp_admin_expires_at: null, previous_role: null }).eq('id', id)
        await logAudit(supabase, adminId, `Revoked admin from ${email}`, id)
        setUsers(u => u.map(x => x.id === id ? { ...x, role: 'patient', temp_admin_expires_at: null } : x))
    }

    const tempAdmins = users.filter(u => u.role === 'admin' && u.temp_admin_expires_at)

    return (
        <div className="admin-mgmt-container">
            {!isSuperAdmin && (
                <div className="alert alert-warning mb-6 glass-panel">
                    <AlertCircle size={18} />
                    <p>Elevated Governance required. Actions restricted to System Overlord.</p>
                </div>
            )}

            <div className="mgmt-grid">
                {/* Grant */}
                {isSuperAdmin && (
                    <div className="glass-panel mgmt-card">
                        <div className="card-header">
                            <h3 className="card-title">Interim Permission Grant</h3>
                            <p className="card-subtitle">Authorize temporal administrative access to selected nodes</p>
                        </div>
                        <div className="mgmt-form">
                            <div className="form-group">
                                <label className="form-label">Target Identity</label>
                                <select className="form-select" value={selected} onChange={e => setSelected(e.target.value)}>
                                    <option value="">Query identity...</option>
                                    {users.filter(u => u.role !== 'admin').map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name || u.email} — [{u.role.toUpperCase()}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Temporal Window (Hours)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={hours}
                                        min={1}
                                        max={168}
                                        onChange={e => setHours(Number(e.target.value))}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={grantAdmin}
                                    disabled={!selected || granting}
                                >
                                    <Shield size={16} />
                                    <span>{granting ? 'Granting...' : 'Authorize'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Active temp admins */}
                <div className="glass-panel mgmt-card">
                    <div className="section-header">
                        <div className="section-header-text">
                            <h2 className="section-title">Temporal Administrators</h2>
                            <p className="section-subtitle">Active nodes with provisional oversight permissions</p>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={fetchAdmins} disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading-state">
                            <RefreshCw size={24} className="spin" />
                        </div>
                    ) : tempAdmins.length === 0 ? (
                        <div className="empty-state">
                            <Shield size={36} />
                            <h3>No Active Overlays</h3>
                            <p>All administrative roles are currently static.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="ethereal-table">
                                <thead>
                                    <tr>
                                        <th>Identity</th>
                                        <th>Expiration</th>
                                        <th className="text-right">Oversight</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tempAdmins.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="user-identity">
                                                    <span className="user-name">{u.full_name || 'System Entity'}</span>
                                                    <span className="user-email">{u.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="timestamp">
                                                    {new Date(u.temp_admin_expires_at).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                {isSuperAdmin && (
                                                    <button
                                                        className="btn btn-sm btn-ghost btn-danger"
                                                        onClick={() => revokeAdmin(u.id, u.email)}
                                                    >
                                                        Revoke
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ── Audit Logs Tab ── */
function AuditTab() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchLogs = () => {
        setLoading(true)
        supabase.from('audit_logs').select('*, admin:admin_id(full_name, email)').order('created_at', { ascending: false }).limit(100)
            .then(({ data }) => { setLogs(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    return (
        <div className="glass-panel section-container">
            <div className="section-header">
                <div className="section-header-text">
                    <h2 className="section-title">Audit Log</h2>
                    <p className="section-subtitle">Immutable record of high-privilege system modifications</p>
                </div>
                <div className="section-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <RefreshCw size={24} className="spin" />
                </div>
            ) : logs.length === 0 ? (
                <div className="empty-state">
                    <ClipboardList size={40} />
                    <h3>No Operations Logged</h3>
                    <p>System actions will be recorded here for security compliance.</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="ethereal-table">
                        <thead>
                            <tr>
                                <th>Administrator</th>
                                <th>Operation</th>
                                <th className="text-right">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id}>
                                    <td>
                                        <div className="user-identity">
                                            <span className="user-name">{l.admin?.full_name || l.admin?.email || 'System'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="audit-action">{l.action}</span>
                                    </td>
                                    <td className="text-right">
                                        <span className="timestamp">
                                            {new Date(l.created_at).toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/* ── Stats Tab placeholder ── */
function StatsTab() {
    return (
        <div className="glass-panel section-container">
            <div className="empty-state">
                <Activity size={40} />
                <h3>Analytics Engine Starting</h3>
                <p>Establishing real-time data streams for system-wide health metrics.</p>
            </div>
        </div>
    )
}

export default AdminDashboard
