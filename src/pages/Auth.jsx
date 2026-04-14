import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import {
    Mail, Lock, UserCheck, Stethoscope, ArrowLeft, Loader,
    Eye, EyeOff, GraduationCap, Building2, ChevronRight, ChevronLeft, BadgeCheck
} from 'lucide-react'
import './Auth.css'

/* ─────────────────────────────────────────────────────────
   Selectable lists
───────────────────────────────────────────────────────── */
const DEGREES = ['MBBS', 'MD', 'MS', 'DNB', 'DM', 'MCh', 'BDS', 'MDS', 'BAMS', 'BHMS', 'BPT', 'MPT', 'Other']
const SPECIALIZATIONS = [
    'General Medicine', 'General Surgery', 'Pediatrics', 'Gynecology & Obstetrics',
    'Cardiology', 'Orthopedics', 'Neurology', 'Dermatology', 'Ophthalmology',
    'ENT', 'Psychiatry', 'Radiology', 'Anesthesiology', 'Oncology', 'Nephrology',
    'Gastroenterology', 'Pulmonology', 'Endocrinology', 'Rheumatology',
    'Emergency Medicine', 'Family Medicine', 'Other',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 60 }, (_, i) => currentYear - i)

/* ─────────────────────────────────────────────────────────
   Sub-component: Step indicator
───────────────────────────────────────────────────────── */
function StepIndicator({ step, totalSteps, labels }) {
    return (
        <div className="step-indicator">
            {labels.map((label, i) => (
                <div key={i} className={`step-item ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                    <div className="step-circle">
                        {i < step ? <BadgeCheck size={14} /> : i + 1}
                    </div>
                    <span className="step-label">{label}</span>
                    {i < totalSteps - 1 && <div className="step-line" />}
                </div>
            ))}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   Main Auth Component
───────────────────────────────────────────────────────── */
export default function Auth() {
    const [searchParams] = useSearchParams()
    const defaultRole = searchParams.get('role') || 'patient'

    const [authMode, setAuthMode]     = useState('login')   // 'login' | 'signup'
    const [role, setRole]             = useState(defaultRole)
    const [signupStep, setSignupStep] = useState(0)         // 0 | 1 | 2 (doctor-only steps 1,2)

    /* Step 0 — credentials */
    const [email, setEmail]                   = useState('')
    const [password, setPassword]             = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPw, setShowPw]                 = useState(false)
    const [showCpw, setShowCpw]               = useState(false)

    /* Step 1 — academic details */
    const [fullName, setFullName]           = useState('')
    const [degree, setDegree]               = useState('')
    const [university, setUniversity]       = useState('')
    const [gradYear, setGradYear]           = useState('')
    const [licenseNo, setLicenseNo]         = useState('')
    const [specialization, setSpecialization] = useState('')

    /* Step 2 — hospital details */
    const [hospitalName, setHospitalName]   = useState('')
    const [hospitalRegNo, setHospitalRegNo] = useState('')
    const [hospitalAddress, setHospitalAddress] = useState('')
    const [hospitalCity, setHospitalCity]   = useState('')
    const [hospitalState, setHospitalState] = useState('')
    const [experience, setExperience]       = useState('')

    /* UI state */
    const [loading, setLoading]         = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError]             = useState('')
    const [successMsg, setSuccessMsg]   = useState('')

    /* Clear errors on mode switch */
    useEffect(() => {
        setError(''); setSuccessMsg('')
        setPassword(''); setConfirmPassword('')
        setSignupStep(0)
    }, [authMode])

    useEffect(() => { setError('') }, [signupStep])

    const isDoctorSignup = authMode === 'signup' && role === 'doctor'
    const totalSteps     = isDoctorSignup ? 3 : 1
    const stepLabels     = ['Account', 'Academic', 'Hospital']

    /* ── Validate Step 0 ── */
    function validateStep0() {
        if (!email.trim())          return 'Please enter your email address.'
        if (password.length < 6)    return 'Password must be at least 6 characters.'
        if (password !== confirmPassword) return 'Passwords do not match.'
        return null
    }

    /* ── Validate Step 1 (academic) ── */
    function validateStep1() {
        if (!fullName.trim())        return 'Please enter your full name.'
        if (!degree)                 return 'Please select your medical degree.'
        if (!university.trim())      return 'Please enter your university / medical college.'
        if (!gradYear)               return 'Please select your graduation year.'
        if (!licenseNo.trim())       return 'Please enter your Medical Council registration / license number.'
        if (!specialization)         return 'Please select your specialization.'
        return null
    }

    /* ── Validate Step 2 (hospital) ── */
    function validateStep2() {
        if (!hospitalName.trim())    return 'Please enter the hospital name.'
        if (!hospitalRegNo.trim())   return 'Please enter the hospital registration number.'
        if (!hospitalAddress.trim()) return 'Please enter the hospital address.'
        if (!hospitalCity.trim())    return 'Please enter the city.'
        if (!hospitalState.trim())   return 'Please enter the state.'
        if (experience === '')       return 'Please enter your years of experience (0 is fine).'
        if (isNaN(Number(experience)) || Number(experience) < 0)
            return 'Experience must be a non-negative number.'
        return null
    }

    /* ── Next step (doctor signup only) ── */
    function handleNext(e) {
        e.preventDefault()
        setError('')
        let err = null
        if (signupStep === 0) err = validateStep0()
        if (signupStep === 1) err = validateStep1()
        if (err) return setError(err)
        setSignupStep(s => s + 1)
    }

    /* ── Final submit ── */
    async function handleSubmit(e) {
        e.preventDefault()
        setError(''); setSuccessMsg('')

        if (authMode === 'login') {
            /* ── LOGIN ── */
            if (!email.trim()) return setError('Please enter your email address.')
            if (!password)     return setError('Please enter your password.')
            setLoading(true)
            const { error: err } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(), password,
            })
            setLoading(false)
            if (err) return setError(err.message)
            return
        }

        /* ── SIGNUP ── */
        if (!isDoctorSignup) {
            /* Patient signup — validate step 0 inline */
            const err = validateStep0()
            if (err) return setError(err)
        } else {
            const err = validateStep2()
            if (err) return setError(err)
        }

        setLoading(true)

        const metadata = {
            role,
            full_name: isDoctorSignup ? fullName : email.split('@')[0],
            ...(isDoctorSignup && {
                // Academic
                degree, university, grad_year: gradYear,
                license_no: licenseNo, specialization,
                // Hospital
                hospital_name: hospitalName,
                hospital_reg_no: hospitalRegNo,
                hospital_address: hospitalAddress,
                hospital_city: hospitalCity,
                hospital_state: hospitalState,
                experience_years: Number(experience),
                verification_status: 'pending',
            }),
        }

        const { data: signupData, error: err } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: metadata,
                emailRedirectTo: window.location.origin + '/auth',
            },
        })

        if (err) { setLoading(false); return setError(err.message) }

        /* For doctors: also insert into doctor_verifications table */
        if (isDoctorSignup && signupData?.user?.id) {
            await supabase.from('doctor_verifications').upsert({
                user_id:           signupData.user.id,
                email:             email.trim().toLowerCase(),
                full_name:         fullName,
                degree,
                university,
                graduation_year:   Number(gradYear),
                license_number:    licenseNo,
                specialization,
                hospital_name:     hospitalName,
                hospital_reg_no:   hospitalRegNo,
                hospital_address:  hospitalAddress,
                hospital_city:     hospitalCity,
                hospital_state:    hospitalState,
                experience_years:  Number(experience),
                status:            'pending',
            })
        }

        setLoading(false)
        setSuccessMsg(
            isDoctorSignup
                ? 'Account created! Please confirm your email. Your credentials will be reviewed by our team before you can access the doctor dashboard.'
                : 'Account created! Check your inbox to confirm your email, then sign in.'
        )
        setAuthMode('login')
        setSignupStep(0)
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
    }

    /* ─────────────────────────────────────────────────────────
       Render helpers
    ───────────────────────────────────────────────────────── */
    function renderStep0() {
        return (
            <>
                {/* Role selector — signup only */}
                {authMode === 'signup' && (
                    <div className="role-selector">
                        <button type="button" className={`role-btn ${role === 'patient' ? 'active' : ''}`}
                            onClick={() => { setRole('patient'); setSignupStep(0) }} id="role-patient">
                            <UserCheck size={20} />
                            <div>
                                <div className="role-btn-title">Patient</div>
                                <div className="role-btn-sub">Access health tools</div>
                            </div>
                        </button>
                        <button type="button" className={`role-btn ${role === 'doctor' ? 'active' : ''}`}
                            onClick={() => { setRole('doctor'); setSignupStep(0) }} id="role-doctor">
                            <Stethoscope size={20} />
                            <div>
                                <div className="role-btn-title">Doctor</div>
                                <div className="role-btn-sub">Monitor patients</div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Google */}
                <button type="button" className="btn-google" onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading} id="google-signin-btn">
                    {googleLoading ? <Loader size={18} className="spin-icon" /> : (
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                </button>

                <div className="auth-divider"><span>or continue with email</span></div>

                {/* Email */}
                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="input-icon-wrapper">
                        <Mail size={18} className="input-icon" />
                        <input id="email-input" type="email" className="form-input input-with-icon"
                            placeholder="you@example.com" value={email} autoFocus
                            onChange={e => { setEmail(e.target.value); setError('') }} required />
                    </div>
                </div>

                {/* Password */}
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="input-icon-wrapper">
                        <Lock size={18} className="input-icon" />
                        <input id="password-input" type={showPw ? 'text' : 'password'}
                            className="form-input input-with-icon input-with-eye"
                            placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                            value={password} onChange={e => { setPassword(e.target.value); setError('') }} required />
                        <button type="button" className="eye-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Confirm — signup only */}
                {authMode === 'signup' && (
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <div className="input-icon-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input id="confirm-password-input" type={showCpw ? 'text' : 'password'}
                                className="form-input input-with-icon input-with-eye"
                                placeholder="Re-enter password" value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError('') }} required />
                            <button type="button" className="eye-toggle" onClick={() => setShowCpw(v => !v)} tabIndex={-1}>
                                {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                )}
            </>
        )
    }

    function renderStep1() {
        return (
            <>
                <div className="step-section-title"><GraduationCap size={16} /> Academic Details</div>

                <div className="form-group">
                    <label className="form-label">Full Name <span className="req">*</span></label>
                    <input id="fullname-input" type="text" className="form-input"
                        placeholder="Dr. First Last" value={fullName}
                        onChange={e => { setFullName(e.target.value); setError('') }} required autoFocus />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Medical Degree <span className="req">*</span></label>
                        <select id="degree-select" className="form-input form-select" value={degree}
                            onChange={e => { setDegree(e.target.value); setError('') }} required>
                            <option value="">Select degree</option>
                            {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Graduation Year <span className="req">*</span></label>
                        <select id="gradyear-select" className="form-input form-select" value={gradYear}
                            onChange={e => { setGradYear(e.target.value); setError('') }} required>
                            <option value="">Select year</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">University / Medical College <span className="req">*</span></label>
                    <input id="university-input" type="text" className="form-input"
                        placeholder="e.g. AIIMS Delhi, CMC Vellore" value={university}
                        onChange={e => { setUniversity(e.target.value); setError('') }} required />
                </div>

                <div className="form-group">
                    <label className="form-label">Medical Council License / Registration No. <span className="req">*</span></label>
                    <input id="license-input" type="text" className="form-input"
                        placeholder="e.g. MCI-2020-XXXXX" value={licenseNo}
                        onChange={e => { setLicenseNo(e.target.value); setError('') }} required />
                    <span className="form-hint">Issued by MCI / State Medical Council or equivalent authority</span>
                </div>

                <div className="form-group">
                    <label className="form-label">Specialization <span className="req">*</span></label>
                    <select id="specialization-select" className="form-input form-select" value={specialization}
                        onChange={e => { setSpecialization(e.target.value); setError('') }} required>
                        <option value="">Select specialization</option>
                        {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </>
        )
    }

    function renderStep2() {
        return (
            <>
                <div className="step-section-title"><Building2 size={16} /> Current Hospital</div>
                <p className="step-section-note">
                    You must be currently affiliated with a registered and legally operating hospital.
                </p>

                <div className="form-group">
                    <label className="form-label">Hospital Name <span className="req">*</span></label>
                    <input id="hospital-name-input" type="text" className="form-input"
                        placeholder="e.g. Apollo Hospitals, AIIMS" value={hospitalName}
                        onChange={e => { setHospitalName(e.target.value); setError('') }} required autoFocus />
                </div>

                <div className="form-group">
                    <label className="form-label">Hospital Registration Number <span className="req">*</span></label>
                    <input id="hospital-reg-input" type="text" className="form-input"
                        placeholder="Govt. registration / accreditation number" value={hospitalRegNo}
                        onChange={e => { setHospitalRegNo(e.target.value); setError('') }} required />
                    <span className="form-hint">As registered with state health authorities / NABH</span>
                </div>

                <div className="form-group">
                    <label className="form-label">Hospital Address <span className="req">*</span></label>
                    <input id="hospital-addr-input" type="text" className="form-input"
                        placeholder="Street / locality" value={hospitalAddress}
                        onChange={e => { setHospitalAddress(e.target.value); setError('') }} required />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">City <span className="req">*</span></label>
                        <input id="hospital-city-input" type="text" className="form-input"
                            placeholder="City" value={hospitalCity}
                            onChange={e => { setHospitalCity(e.target.value); setError('') }} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">State <span className="req">*</span></label>
                        <input id="hospital-state-input" type="text" className="form-input"
                            placeholder="State" value={hospitalState}
                            onChange={e => { setHospitalState(e.target.value); setError('') }} required />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Years of Experience <span className="req">*</span></label>
                    <input id="experience-input" type="number" min="0" max="60" className="form-input"
                        placeholder="0" value={experience}
                        onChange={e => { setExperience(e.target.value); setError('') }} required />
                    <span className="form-hint">Enter 0 if you are a fresher — that's perfectly fine!</span>
                </div>
            </>
        )
    }

    /* ─────────────────────────────────────────────────────────
       Main render
    ───────────────────────────────────────────────────────── */
    const isLastStep = !isDoctorSignup || signupStep === 2

    return (
        <div className="auth-page">
            {/* Left panel */}
            <div className="auth-left">
                <Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to Home</Link>
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
                        'Verified doctor credentials',
                        'Role-based access control',
                    ].map(f => (
                        <div key={f} className="auth-feature">
                            <span className="auth-feature-dot" />{f}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel */}
            <div className="auth-right">
                <div className={`auth-card ${isDoctorSignup ? 'auth-card-wide' : ''}`}>

                    {/* Header */}
                    <div className="auth-card-header">
                        <h2>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                        <p>
                            {authMode === 'login'
                                ? 'Sign in to your MediCrew account'
                                : isDoctorSignup
                                    ? 'Doctor registration — your credentials will be verified'
                                    : 'Join MediCrew as a patient'}
                        </p>
                    </div>

                    {/* Mode Tabs */}
                    <div className="auth-tabs">
                        <button type="button" className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                            onClick={() => setAuthMode('login')} id="tab-login">Sign In</button>
                        <button type="button" className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                            onClick={() => setAuthMode('signup')} id="tab-signup">Sign Up</button>
                    </div>

                    {/* Step indicator for doctor signup */}
                    {isDoctorSignup && (
                        <StepIndicator step={signupStep} totalSteps={3} labels={stepLabels} />
                    )}

                    {/* Messages */}
                    {successMsg && <div className="auth-success">{successMsg}</div>}

                    {/* Form */}
                    <form onSubmit={isLastStep ? handleSubmit : handleNext} className="auth-form">
                        {signupStep === 0 && renderStep0()}
                        {signupStep === 1 && renderStep1()}
                        {signupStep === 2 && renderStep2()}

                        {error && <div className="auth-error">{error}</div>}

                        {/* Buttons */}
                        <div className="form-actions">
                            {signupStep > 0 && (
                                <button type="button" className="btn btn-ghost btn-back"
                                    onClick={() => { setSignupStep(s => s - 1); setError('') }} disabled={loading}>
                                    <ChevronLeft size={16} /> Back
                                </button>
                            )}
                            <button type="submit" className="btn btn-primary btn-submit"
                                disabled={loading || googleLoading} id="submit-btn">
                                {loading
                                    ? <><Loader size={18} className="spin-icon" />
                                        {authMode === 'login' ? 'Signing in…' : isLastStep ? 'Creating account…' : 'Processing…'}</>
                                    : isLastStep
                                        ? (authMode === 'login' ? 'Sign In →' : 'Create Account →')
                                        : <>Next <ChevronRight size={16} /></>
                                }
                            </button>
                        </div>
                    </form>

                    {/* Switch mode link */}
                    <p className="auth-switch">
                        {authMode === 'login' ? (
                            <>Don't have an account?{' '}
                                <button type="button" className="auth-link-btn" onClick={() => setAuthMode('signup')}>Sign up free</button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button type="button" className="auth-link-btn" onClick={() => setAuthMode('login')}>Sign in</button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    )
}
