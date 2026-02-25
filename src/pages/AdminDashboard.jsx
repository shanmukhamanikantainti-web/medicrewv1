import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
    Users, Stethoscope, Cpu, Calendar, Shield, ClipboardList,
    CheckCircle, XCircle, Clock, Trash2, RefreshCw, UserPlus, AlertCircle
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
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield size={24} color="#7c3aed" />
                        </div>
                        <div>
                            <h1 className="page-title">Admin Dashboard</h1>
                            <p className="page-subtitle">System governance and management — all actions are audit logged</p>
                        </div>
                    </div>
                </div>
                <div className="page-content">
                    <div className="tabs">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                                onClick={() => setTab(t.id)}
                                id={`admin-tab-${t.id}`}
                            >
                                <t.icon size={16} /> {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === 'users' && <UsersTab adminId={user?.id} />}
                    {tab === 'doctors' && <DoctorsTab adminId={user?.id} />}
                    {tab === 'devices' && <DevicesTab adminId={user?.id} />}
                    {tab === 'appointments' && <AppointmentsTab />}
                    {tab === 'admins' && <AdminsTab adminId={user?.id} isSuperAdmin={isSuperAdmin} />}
                    {tab === 'audit' && <AuditTab />}
                </div>
            </main>
        </div>
    )
}

/* ── Users Tab ── */
function UsersTab({ adminId }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchUsers = () => {
        setLoading(true)
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { setUsers(data || []); setLoading(false) })
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    async function deleteUser(id, email) {
        if (!confirm(`PERMANENTLY DELETE user ${email}? This action cannot be undone.`)) return
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        if (error) {
            alert("Error deleting user: " + error.message)
            return
        }
        await logAudit(supabase, adminId, `Deleted user ${email}`, id)
        setUsers(u => u.filter(x => x.id !== id))
    }

    const roleColor = { patient: 'badge-blue', doctor: 'badge-green', admin: 'badge-orange', superadmin: 'badge-red' }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>All Users <span className="badge badge-gray">{users.length}</span></h2>
                <button className="btn btn-sm btn-outline" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh List
                </button>
            </div>
            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Name / Email</th><th>Role</th><th>Verified</th><th>Actions</th></tr></thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>{u.email}</div>
                                    </td>
                                    <td><span className={`badge ${roleColor[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                                    <td>{u.verified ? <CheckCircle size={16} color="#16a34a" /> : <Clock size={16} color="#ca8a04" />}</td>
                                    <td>
                                        {u.role !== 'superadmin' && (
                                            <button className="btn btn-sm btn-ghost" style={{ color: '#dc2626' }} onClick={() => deleteUser(u.id, u.email)}>
                                                <Trash2 size={13} /> Delete User
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
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Doctor Management <span className="badge badge-gray">{doctors.length}</span></h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-sm btn-outline" onClick={fetchDoctors} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>
                        <UserPlus size={14} /> Add Doctor
                    </button>
                </div>
            </div>

            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : doctors.length === 0 ? (
                <div className="card empty-state"><Stethoscope size={40} style={{ color: 'var(--gray-300)' }} /><h3>No Doctors</h3></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Doctor</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {doctors.map(d => (
                                <tr key={d.id}>
                                    <td style={{ fontWeight: 600 }}>{d.full_name || '—'}</td>
                                    <td style={{ color: 'var(--gray-500)' }}>{d.email}</td>
                                    <td>
                                        {d.verified
                                            ? <span className="badge badge-green"><CheckCircle size={11} /> Approved</span>
                                            : <span className="badge badge-yellow"><Clock size={11} /> Pending</span>}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {!d.verified && <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#16a34a' }} onClick={() => approve(d.id, d.email)}><CheckCircle size={13} /> Approve</button>}
                                            <button className="btn btn-sm btn-danger" onClick={() => reject(d.id, d.email)}><XCircle size={13} /> Reject</button>
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
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Add New Doctor</h3>
                    <button className="btn btn-sm btn-ghost" onClick={onClose}><XCircle size={18} /></button>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
                    Promote an existing user to doctor status by their email.
                </p>
                <form onSubmit={handleAdd} className="form-group">
                    <label className="form-label">User Email Address</label>
                    <input
                        type="email"
                        className="form-input"
                        placeholder="doctor@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    {error && <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</div>}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                            {submitting ? 'Adding...' : 'Add Doctor'}
                        </button>
                    </div>
                </form>
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
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Device Management <span className="badge badge-gray">{devices.length}</span></h2>
                <button className="btn btn-sm btn-outline" onClick={fetchDevices} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>
            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : devices.length === 0 ? (
                <div className="card empty-state"><Cpu size={40} style={{ color: 'var(--gray-300)' }} /><h3>No Devices</h3></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Device ID</th><th>Linked Patient</th><th>Status</th><th>Last Sync</th><th>Actions</th></tr></thead>
                        <tbody>
                            {devices.map(dev => (
                                <tr key={dev.id}>
                                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{dev.device_id}</td>
                                    <td>{dev.patient?.full_name || dev.patient?.email || <span style={{ color: 'var(--gray-400)' }}>Unlinked</span>}</td>
                                    <td><span className={`badge ${dev.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{dev.status}</span></td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>{dev.last_sync ? new Date(dev.last_sync).toLocaleString() : '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-sm btn-outline" onClick={() => toggle(dev)}>{dev.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                                            {dev.patient_id && <button className="btn btn-sm btn-ghost" style={{ color: '#dc2626' }} onClick={() => unbind(dev)}>Unbind</button>}
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
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>All Appointments <span className="badge badge-gray">{appts.length}</span></h2>
                <button className="btn btn-sm btn-outline" onClick={fetchAppts} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>
            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead>
                        <tbody>
                            {appts.map(a => (
                                <tr key={a.id}>
                                    <td>{a.patient?.full_name || a.patient?.email || '—'}</td>
                                    <td>{a.doctor?.full_name || 'Any'}</td>
                                    <td>{a.date} {a.time ? `${a.time}` : ''}</td>
                                    <td><span className={`badge ${statusBadge[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-500)' }}>{a.notes || '—'}</td>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!isSuperAdmin && (
                <div className="alert alert-warning"><AlertCircle size={15} style={{ flexShrink: 0 }} />Only the SuperAdmin can grant or revoke admin roles.</div>
            )}

            {/* Grant */}
            {isSuperAdmin && (
                <div className="card">
                    <div className="card-header"><div className="card-title">Grant Temporary Admin Access</div></div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="form-label">Select User</label>
                            <select className="form-select" value={selected} onChange={e => setSelected(e.target.value)} id="admin-grant-select">
                                <option value="">Choose a user...</option>
                                {users.filter(u => u.role !== 'admin').map(u => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Duration (hours)</label>
                            <input type="number" className="form-input" value={hours} min={1} max={168} onChange={e => setHours(Number(e.target.value))} style={{ width: 120 }} />
                        </div>
                        <button className="btn btn-primary" onClick={grantAdmin} disabled={!selected || granting} id="grant-admin-btn">
                            <UserPlus size={16} /> {granting ? 'Granting...' : 'Grant Admin'}
                        </button>
                    </div>
                </div>
            )}

            {/* Active temp admins */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 className="section-title" style={{ margin: 0 }}>Active Temporary Admins</h2>
                    <button className="btn btn-sm btn-outline" onClick={fetchAdmins} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
                {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : tempAdmins.length === 0 ? (
                    <div className="card empty-state" style={{ padding: '2rem' }}><Shield size={36} style={{ color: 'var(--gray-300)' }} /><h3>No Temporary Admins</h3></div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>User</th><th>Email</th><th>Expires</th><th>Actions</th></tr></thead>
                            <tbody>
                                {tempAdmins.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.full_name || '—'}</td>
                                        <td>{u.email}</td>
                                        <td>{new Date(u.temp_admin_expires_at).toLocaleString()}</td>
                                        <td>
                                            {isSuperAdmin && <button className="btn btn-sm btn-danger" onClick={() => revokeAdmin(u.id, u.email)}>Revoke</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Audit Logs <span className="badge badge-gray">{logs.length}</span></h2>
                <button className="btn btn-sm btn-outline" onClick={fetchLogs} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>
            {loading ? <div style={{ color: 'var(--gray-400)', padding: '2rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></div> : logs.length === 0 ? (
                <div className="card empty-state"><ClipboardList size={40} style={{ color: 'var(--gray-300)' }} /><h3>No Logs Yet</h3><p>Admin actions will appear here</p></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Admin</th><th>Action</th><th>Timestamp</th></tr></thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id}>
                                    <td style={{ fontWeight: 600 }}>{l.admin?.full_name || l.admin?.email || 'System'}</td>
                                    <td>{l.action}</td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>{new Date(l.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
