import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mail, Lock, UserCheck, Stethoscope, ArrowLeft, Loader } from 'lucide-react'
import './Auth.css'

export default function Auth() {
    const [searchParams] = useSearchParams()
    const defaultRole = searchParams.get('role') || 'patient'

    const [step, setStep] = useState('email') // email | otp
    const [role, setRole] = useState(defaultRole)
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [countdown, setCountdown] = useState(0)
    const navigate = useNavigate()

    useEffect(() => {
        if (countdown > 0) {
            const t = setTimeout(() => setCountdown(c => c - 1), 1000)
            return () => clearTimeout(t)
        }
    }, [countdown])

    async function handleSendOTP(e) {
        e.preventDefault()
        if (!email.trim()) return setError('Please enter your email address.')
        setLoading(true); setError('')
        const { error: err } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
                data: { role },
                shouldCreateUser: true,
                emailRedirectTo: window.location.origin,
            }
        })
        setLoading(false)
        if (err) return setError(err.message)
        setMessage(`OTP sent to ${email}. Check your inbox.`)
        setStep('otp')
        setCountdown(60)
    }

    async function handleVerifyOTP(e) {
        e.preventDefault()
        if (!otp.trim() || otp.length !== 6) return setError('Enter the 6-digit OTP from your email.')
        setLoading(true); setError('')
        const { error: err } = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: otp.trim(),
            type: 'email'
        })
        setLoading(false)
        if (err) return setError('Invalid or expired OTP. Please try again.')
        // AuthContext handles redirect via onAuthStateChange
    }

    return (
        <div className="auth-page">
            <div className="auth-left">
                <Link to="/" className="auth-back">
                    <ArrowLeft size={16} /> Back to Home
                </Link>
                <div className="auth-brand">
                    <div className="auth-logo">
                        <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
                            <rect width="32" height="32" rx="8" fill="#2563EB" />
                            <path d="M16 6v20M6 16h20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="16" cy="16" r="4" fill="white" fillOpacity="0.35" />
                        </svg>
                    </div>
                    <h1>MediCrew</h1>
                    <p>Secure healthcare access for everyone</p>
                </div>
                <div className="auth-features">
                    {['AI-powered health analysis', 'Real-time IoT monitoring', 'Secure OTP authentication', 'Role-based access control'].map(f => (
                        <div key={f} className="auth-feature"><span className="auth-feature-dot" />{f}</div>
                    ))}
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-card">
                    {step === 'email' ? (
                        <>
                            <div className="auth-card-header">
                                <h2>Welcome to MediCrew</h2>
                                <p>Sign in or create your account with email OTP</p>
                            </div>

                            {/* Role Selector */}
                            <div className="role-selector">
                                <button
                                    type="button"
                                    className={`role-btn ${role === 'patient' ? 'active' : ''}`}
                                    onClick={() => setRole('patient')}
                                    id="role-patient"
                                >
                                    <UserCheck size={20} />
                                    <div>
                                        <div className="role-btn-title">Patient</div>
                                        <div className="role-btn-sub">Access health tools</div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    className={`role-btn ${role === 'doctor' ? 'active' : ''}`}
                                    onClick={() => setRole('doctor')}
                                    id="role-doctor"
                                >
                                    <Stethoscope size={20} />
                                    <div>
                                        <div className="role-btn-title">Doctor</div>
                                        <div className="role-btn-sub">Monitor patients</div>
                                    </div>
                                </button>
                            </div>

                            <form onSubmit={handleSendOTP} className="auth-form">
                                <div className="form-group">
                                    <label className="form-label">Email Address</label>
                                    <div className="input-icon-wrapper">
                                        <Mail size={18} className="input-icon" />
                                        <input
                                            id="email-input"
                                            type="email"
                                            className="form-input input-with-icon"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={e => { setEmail(e.target.value); setError('') }}
                                            required autoFocus
                                        />
                                    </div>
                                </div>
                                {error && <div className="auth-error">{error}</div>}
                                <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} id="send-otp-btn">
                                    {loading ? <><Loader size={18} className="spin-icon" /> Sending OTP...</> : 'Send OTP →'}
                                </button>
                            </form>
                            <p className="auth-note">
                                By continuing, you agree to receive a one-time password to your email. OTP expires in 5 minutes.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="auth-card-header">
                                <h2>Check your email</h2>
                                <p>We sent a 6-digit OTP to <strong>{email}</strong></p>
                            </div>
                            {message && <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>{message}</div>}
                            <form onSubmit={handleVerifyOTP} className="auth-form">
                                <div className="form-group">
                                    <label className="form-label">One-Time Password</label>
                                    <div className="input-icon-wrapper">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            id="otp-input"
                                            type="text"
                                            className="form-input input-with-icon otp-input"
                                            placeholder="123456"
                                            value={otp}
                                            maxLength={6}
                                            onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }}
                                            required autoFocus
                                        />
                                    </div>
                                </div>
                                {error && <div className="auth-error">{error}</div>}
                                <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} id="verify-otp-btn">
                                    {loading ? <><Loader size={18} className="spin-icon" /> Verifying...</> : 'Verify & Sign In →'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost w-full"
                                    onClick={handleSendOTP}
                                    disabled={countdown > 0 || loading}
                                >
                                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                                </button>
                            </form>
                            <button type="button" className="auth-change-email" onClick={() => { setStep('email'); setOtp(''); setError(''); }}>
                                ← Change email
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
