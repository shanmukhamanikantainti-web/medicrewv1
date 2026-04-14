import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Mail, Lock, UserCheck, Stethoscope, ArrowLeft, Loader, Eye, EyeOff } from 'lucide-react'
import './Auth.css'

export default function Auth() {
    const [searchParams] = useSearchParams()
    const defaultRole = searchParams.get('role') || 'patient'

    const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
    const [role, setRole] = useState(defaultRole)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const navigate = useNavigate()

    // Clear errors when switching modes
    useEffect(() => {
        setError('')
        setSuccessMsg('')
        setPassword('')
        setConfirmPassword('')
    }, [authMode])

    /* ── Email / Password ── */
    async function handleEmailAuth(e) {
        e.preventDefault()
        setError(''); setSuccessMsg('')

        if (!email.trim()) return setError('Please enter your email address.')
        if (password.length < 6) return setError('Password must be at least 6 characters.')

        if (authMode === 'signup') {
            if (password !== confirmPassword) return setError('Passwords do not match.')
        }

        setLoading(true)

        if (authMode === 'login') {
            const { error: err } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })
            setLoading(false)
            if (err) return setError(err.message)
            // AuthContext will handle redirect via onAuthStateChange
        } else {
            const { error: err } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: { role },
                    emailRedirectTo: window.location.origin + '/auth',
                },
            })
            setLoading(false)
            if (err) return setError(err.message)
            setSuccessMsg('Account created! Check your inbox to confirm your email, then sign in.')
            setAuthMode('login')
        }
    }

    /* ── Google OAuth ── */
    async function handleGoogleSignIn() {
        setGoogleLoading(true); setError('')
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: { access_type: 'offline', prompt: 'select_account' },
                data: { role },
            },
        })
        if (err) { setError(err.message); setGoogleLoading(false) }
        // On success the browser is redirected — no need to handle here
    }

    return (
        <div className="auth-page">
            {/* ── Left Panel ── */}
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
                    {[
                        'AI-powered health analysis',
                        'Real-time IoT monitoring',
                        'Secure email & Google login',
                        'Role-based access control',
                    ].map(f => (
                        <div key={f} className="auth-feature">
                            <span className="auth-feature-dot" />{f}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right Panel ── */}
            <div className="auth-right">
                <div className="auth-card">
                    {/* Header */}
                    <div className="auth-card-header">
                        <h2>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                        <p>{authMode === 'login' ? 'Sign in to your MediCrew account' : 'Join MediCrew as a patient or doctor'}</p>
                    </div>

                    {/* Mode Tabs */}
                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                            onClick={() => setAuthMode('login')}
                            id="tab-login"
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                            onClick={() => setAuthMode('signup')}
                            id="tab-signup"
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Role selector – only on signup */}
                    {authMode === 'signup' && (
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
                    )}

                    {/* Google Button */}
                    <button
                        type="button"
                        className="btn-google"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading || loading}
                        id="google-signin-btn"
                    >
                        {googleLoading ? (
                            <Loader size={18} className="spin-icon" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        {googleLoading ? 'Redirecting…' : `Continue with Google`}
                    </button>

                    {/* Divider */}
                    <div className="auth-divider"><span>or continue with email</span></div>

                    {/* Email + Password Form */}
                    <form onSubmit={handleEmailAuth} className="auth-form">
                        {/* Email */}
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
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-icon-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="password-input"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input input-with-icon input-with-eye"
                                    placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError('') }}
                                    required
                                />
                                <button
                                    type="button"
                                    className="eye-toggle"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password – signup only */}
                        {authMode === 'signup' && (
                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <div className="input-icon-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        id="confirm-password-input"
                                        type={showConfirm ? 'text' : 'password'}
                                        className="form-input input-with-icon input-with-eye"
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowConfirm(v => !v)}
                                        tabIndex={-1}
                                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <div className="auth-error">{error}</div>}
                        {successMsg && <div className="auth-success">{successMsg}</div>}

                        <button
                            type="submit"
                            className="btn btn-primary w-full btn-lg"
                            disabled={loading || googleLoading}
                            id="submit-btn"
                        >
                            {loading
                                ? <><Loader size={18} className="spin-icon" /> {authMode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                                : authMode === 'login' ? 'Sign In →' : 'Create Account →'
                            }
                        </button>
                    </form>

                    {/* Switch mode link */}
                    <p className="auth-switch">
                        {authMode === 'login' ? (
                            <>Don't have an account?{' '}
                                <button type="button" className="auth-link-btn" onClick={() => setAuthMode('signup')}>
                                    Sign up free
                                </button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button type="button" className="auth-link-btn" onClick={() => setAuthMode('login')}>
                                    Sign in
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    )
}
