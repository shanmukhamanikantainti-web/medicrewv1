import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Shield, X, Lock } from 'lucide-react'

const ACCESS_CODE = 'DTI2026MEDICREW4240'
const SUPERADMIN_EMAIL = 'shanmukhamanikanta.inti@gmail.com'

export function AdminGate() {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { user, isAdmin, isSuperAdmin } = useAuth()
    const navigate = useNavigate()

    const handleKeyDown = useCallback((e) => {
        if (e.ctrlKey && e.key === 'q') {
            e.preventDefault()
            setOpen(true)
            setCode(''); setError('')
        }
        if (e.key === 'Escape') setOpen(false)
    }, [])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true); setError('')

        // Server-side validation: must match email AND code
        if (!user) { setError('You must be logged in.'); setLoading(false); return }
        if (user.email !== SUPERADMIN_EMAIL) { setError('Access denied: email not authorized.'); setLoading(false); return }
        if (code.trim() !== ACCESS_CODE) { setError('Invalid access code.'); setLoading(false); return }

        setLoading(false)
        setOpen(false)
        navigate('/admin')
    }

    // Only show the Ctrl+Q gate for non-admins (admins can just navigate to /admin)
    if (isAdmin || isSuperAdmin) return null

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield size={20} color="#2563eb" />
                        </div>
                        <div>
                            <div className="modal-title">Admin Access Gate</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Session-level access only</div>
                        </div>
                    </div>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }} onClick={() => setOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                    <Lock size={16} style={{ flexShrink: 0 }} />
                    Enter the admin access code to proceed. This grants session-level access only.
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Access Code</label>
                        <input
                            id="admin-access-code"
                            type="password"
                            className="form-input"
                            placeholder="Enter access code"
                            value={code}
                            onChange={e => { setCode(e.target.value); setError('') }}
                            autoFocus
                        />
                    </div>
                    {error && <div className="auth-error">{error}</div>}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading} id="admin-gate-submit">
                            {loading ? 'Validating...' : 'Enter Admin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
