import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

export default function AdminVerify() {
    const { user, isAdmin, isAdminVerified, verifyAdmin, signOut } = useAuth()
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // If not an admin, boot them
        if (!isAdmin) {
            navigate('/')
            return
        }
        // If already verified, go to dashboard
        if (isAdminVerified) {
            navigate('/admin')
        }
    }, [isAdmin, isAdminVerified, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)

        // Artificial delay for premium feel
        await new Promise(resolve => setTimeout(resolve, 800))

        const success = verifyAdmin(code)
        if (success) {
            navigate('/admin')
        } else {
            setError('Invalid access code. Please try again.')
            setSubmitting(false)
        }
    }

    if (!user) return null

    return (
        <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div className="auth-card" style={{ maxWidth: 450, width: '90%' }}>
                <div className="auth-header">
                    <div className="auth-logo" style={{ background: '#eff6ff' }}>
                        <Shield size={28} color="#2563eb" />
                    </div>
                    <h1 className="auth-title">Admin Verification</h1>
                    <p className="auth-subtitle">Authorized personnel only — enter session code</p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="alert alert-info" style={{ borderRadius: 12, padding: '1rem' }}>
                        <Lock size={18} style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.875rem' }}>
                            Hello, <strong>{user.email}</strong>. This area requires an additional access code to proceed.
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">Access Code</label>
                        <input
                            type="password"
                            className={`form-input ${error ? 'error' : ''}`}
                            placeholder="••••••••••••••••"
                            value={code}
                            onChange={e => { setCode(e.target.value); setError('') }}
                            required
                            autoFocus
                            style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.125rem' }}
                        />
                        {error && (
                            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={submitting} style={{ height: 48, fontSize: '1rem' }}>
                        {submitting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="spinner-sm" style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                Validating Code...
                            </div>
                        ) : 'Verify & Enter Portal'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ fontSize: '0.875rem' }}>
                        <ArrowLeft size={16} /> Back to Landing
                    </button>
                </div>
            </div>
        </div>
    )
}
