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
        <div className="loading-screen" style={{ flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-panel animate-fade" style={{ maxWidth: 450, width: '90%', padding: '3rem', textAlign: 'center' }}>
                <div className="sidebar-logo" style={{ justifyContent: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ position: 'relative', width: 48, height: 48 }}>
                        <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
                            <rect width="40" height="40" rx="12" fill="var(--primary)" />
                            <path d="M20 10v20M10 20h20" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span style={{ fontSize: '1.75rem' }}>Medicrew</span>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '20px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Shield size={32} color="var(--primary)" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.5rem' }}>Administrative Gateway</h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', opacity: 0.7 }}>Secure session verification required</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label" style={{ textAlign: 'center' }}>Enter Authorization Code</label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={code}
                            onChange={e => { setCode(e.target.value); setError('') }}
                            required
                            autoFocus
                            style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.25rem', padding: '1.25rem' }}
                        />
                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--red-alert)', fontSize: '0.875rem', fontWeight: 600 }}>
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={submitting} style={{ height: 56, marginTop: '1rem' }}>
                        {submitting ? 'Authenticating...' : 'Access Command Center'}
                    </button>
                </form>

                <div style={{ marginTop: '2.5rem' }}>
                    <button className="btn btn-ethereal" onClick={() => navigate('/')} style={{ padding: '0.5rem 1.5rem', fontSize: '0.8125rem' }}>
                        <ArrowLeft size={16} />
                        Terminate Session
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', opacity: 0.3, fontWeight: 700, letterSpacing: '0.1em' }}>SECURED BY MEDICREW NEURAL MESH</p>
        </div>
    )
}
