import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Calendar, Plus, X, Clock, User } from 'lucide-react'

export default function Appointments() {
    const { user, isDoctor, profile } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ doctor_id: '', date: '', time: '', notes: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchAppointments()
        if (!isDoctor) {
            supabase.from('profiles').select('id, full_name, email').eq('role', 'doctor').eq('verified', true)
                .then(({ data }) => data && setDoctors(data))
        }
    }, [user])

    async function fetchAppointments() {
        setLoading(true)
        let query = supabase.from('appointments').select('*, patient:patient_id(full_name, email), doctor:doctor_id(full_name)')
        if (isDoctor) query = query.eq('doctor_id', user.id)
        else query = query.eq('patient_id', user.id)
        const { data } = await query.order('date', { ascending: true })
        setAppointments(data || [])
        setLoading(false)
    }

    async function handleBook(e) {
        e.preventDefault(); setSaving(true)
        await supabase.from('appointments').insert([{
            patient_id: user.id,
            doctor_id: form.doctor_id || null,
            date: form.date, time: form.time, notes: form.notes, status: 'pending'
        }])
        setSaving(false); setShowModal(false)
        setForm({ doctor_id: '', date: '', time: '', notes: '' })
        fetchAppointments()
    }

    async function updateStatus(id, status) {
        await supabase.from('appointments').update({ status }).eq('id', id)
        fetchAppointments()
    }

    const statusColor = { pending: 'badge-yellow', confirmed: 'badge-green', cancelled: 'badge-red', completed: 'badge-gray' }

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 className="page-title">Appointments</h1>
                        <p className="page-subtitle">{isDoctor ? 'Manage your patient appointments' : 'Your scheduled appointments'}</p>
                    </div>
                    {!isDoctor && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)} id="book-appointment-btn">
                            <Plus size={16} /> Book Appointment
                        </button>
                    )}
                </div>
                <div className="page-content">
                    {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>Loading...</div> :
                        appointments.length === 0 ? (
                            <div className="card empty-state">
                                <Calendar size={48} style={{ color: 'var(--gray-300)' }} />
                                <h3>No Appointments</h3>
                                <p>{isDoctor ? 'No appointments assigned yet.' : 'Book your first appointment above.'}</p>
                            </div>
                        ) : (
                            <div className="table-wrapper animate-fade">
                                <table className="ethereal-table">
                                    <thead>
                                        <tr>
                                            {isDoctor && <th>Patient</th>}
                                            {!isDoctor && <th>Doctor</th>}
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Status</th>
                                            <th>Notes</th>
                                            {isDoctor && <th>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments.map(a => (
                                            <tr key={a.id}>
                                                {isDoctor && <td>{a.patient?.full_name || a.patient?.email || '—'}</td>}
                                                {!isDoctor && <td>{a.doctor?.full_name || 'Any Doctor'}</td>}
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Calendar size={14} color="var(--primary)" />
                                                        {a.date}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Clock size={14} color="var(--primary)" />
                                                        {a.time || '—'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${statusColor[a.status] || 'badge-gray'}`}>
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {a.notes || '—'}
                                                </td>
                                                {isDoctor && (
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            {a.status === 'pending' && (
                                                                <>
                                                                    <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => updateStatus(a.id, 'confirmed')}>Confirm</button>
                                                                    <button className="btn btn-ethereal" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--red-alert)' }} onClick={() => updateStatus(a.id, 'cancelled')}>Cancel</button>
                                                                </>
                                                            )}
                                                            {a.status === 'confirmed' && (
                                                                <button className="btn btn-ethereal" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => updateStatus(a.id, 'completed')}>Complete</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    }
                </div>
            </main>

            {/* Book Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal glass-panel animate-fade" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Schedule Appointment</h2>
                            <button className="btn-ethereal" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleBook} className="animate-fade">
                            <div className="input-group">
                                <label className="input-label">Select Practitioner</label>
                                <select className="input-field" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                                    <option value="">Any Available Specialist</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name || d.email}</option>)}
                                </select>
                            </div>
                            <div className="grid-2">
                                <div className="input-group">
                                    <label className="input-label">Date *</label>
                                    <input type="date" className="input-field" required value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Time Preference</label>
                                    <input type="time" className="input-field" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Clinical Notes</label>
                                <textarea className="input-field" rows={4} placeholder="Briefly describe your symptoms or reason for the visit..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-ethereal" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Dismiss</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving} id="confirm-book-btn">
                                    {saving ? 'Processing...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
