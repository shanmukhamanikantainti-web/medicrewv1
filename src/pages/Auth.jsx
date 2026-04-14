import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import {
    Mail, Lock, UserCheck, Stethoscope, Shield, ArrowLeft, Loader,
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
    const [error, setError]             = useState('')
    const [successMsg, setSuccessMsg]   = useState('')

    /* Clear errors on mode switch */
    useEffect(() => {
        setError(''); setSuccessMsg('')
        setPassword(''); setConfirmPassword('')
        setSignupStep(0)
    }, [authMode])

    useEffect(() => { setError('') }, [signupStep])

    const isDoctorFlow = role === 'doctor'
    const totalSteps     = isDoctorFlow ? 3 : 1
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

    /* ── Next step (doctor flow) ── */
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
            if (!isDoctorFlow) {
                if (!email.trim()) return setError('Please enter your email address.')
                if (!password)     return setError('Please enter your password.')
            } else {
                const err = validateStep2()
                if (err) return setError(err)
            }
            
            setLoading(true)
            const { data: signinData, error: err } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(), password,
            })
            
            if (err) { setLoading(false); return setError(err.message) }
            
            /* For doctors: update/re-verify their data upon login */
            if (isDoctorFlow && signinData?.user?.id) {
                await supabase.from('doctor_verifications').upsert({
                    user_id:           signinData.user.id,
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
                
                await supabase.auth.updateUser({
                    data: {
                        role,
                        full_name: fullName,
                        degree, university, grad_year: gradYear,
                        license_no: licenseNo, specialization,
                        hospital_name: hospitalName,
                        hospital_reg_no: hospitalRegNo,
                        hospital_address: hospitalAddress,
                        hospital_city: hospitalCity,
                        hospital_state: hospitalState,
                        experience_years: Number(experience),
                        verification_status: 'pending',
                    }
                })
            }
            
            setLoading(false)
            if (isDoctorFlow) {
                setSuccessMsg('Reverification details submitted successfully. You are now signed in.')
            }
            return
        }

        /* ── SIGNUP ── */
        if (!isDoctorFlow) {
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
            full_name: isDoctorFlow ? fullName : email.split('@')[0],
            ...(isDoctorFlow && {
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
        if (isDoctorFlow && signupData?.user?.id) {
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
            isDoctorFlow
                ? 'Account created! Please confirm your email. Your credentials will be reviewed by our team before you can access the doctor dashboard.'
                : 'Account created! Check your inbox to confirm your email, then sign in.'
        )
        setAuthMode('login')
        setSignupStep(0)
    }

    /* ─────────────────────────────────────────────────────────
       Render helpers
    ───────────────────────────────────────────────────────── */
    function renderStep0() {
        return (
            <div className="form-fieldset">
                {/* Role selector */}
                <div className="auth-role-group">
                    <label className="auth-label">Access Role</label>
                    <div className="role-grid">
                        <button type="button" className={`role-card ${role === 'patient' ? 'active' : ''}`}
                            onClick={() => { setRole('patient'); setSignupStep(0) }} id="role-patient">
                            <UserCheck size={20} className="role-icon" />
                            <span className="role-name">Patient</span>
                        </button>
                        <button type="button" className={`role-card ${role === 'doctor' ? 'active' : ''}`}
                            onClick={() => { setRole('doctor'); setSignupStep(0) }} id="role-doctor">
                            <Stethoscope size={20} className="role-icon" />
                            <span className="role-name">Doctor</span>
                        </button>
                        <button type="button" className={`role-card ${role === 'admin' ? 'active' : ''}`}
                            onClick={() => { setRole('admin'); setSignupStep(0) }} id="role-admin">
                            <Shield size={20} className="role-icon" />
                            <span className="role-name">Admin</span>
                        </button>
                    </div>
                </div>

                {/* Email */}
                <div className="input-group">
                    <label className="auth-label">Professional Email</label>
                    <div className="input-wrapper">
                        <Mail size={18} className="input-icon-left" />
                        <input id="email-input" type="email" className="form-input"
                            placeholder="name@medicrew.com" value={email} autoFocus
                            onChange={e => { setEmail(e.target.value); setError('') }} required />
                    </div>
                </div>

                {/* Password */}
                <div className="input-group">
                    <div className="input-header-row">
                        <label className="auth-label" style={{ marginBottom: 0 }}>Security Key</label>
                        {authMode === 'login' && <button type="button" className="input-link">Forgot?</button>}
                    </div>
                    <div className="input-wrapper">
                        <Lock size={18} className="input-icon-left" />
                        <input id="password-input" type={showPw ? 'text' : 'password'}
                            className="form-input"
                            placeholder={authMode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                            value={password} onChange={e => { setPassword(e.target.value); setError('') }} required />
                        <button type="button" className="input-icon-right" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                            {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {/* Confirm Password — signup only */}
                {authMode === 'signup' && (
                    <div className="input-group">
                        <label className="auth-label">Confirm Key</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon-left" />
                            <input id="confirm-password-input" type={showCpw ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Re-enter password" value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError('') }} required />
                            <button type="button" className="input-icon-right" onClick={() => setShowCpw(v => !v)} tabIndex={-1}>
                                {showCpw ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Remember Me */}
                {authMode === 'login' && (
                    <div className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                        <input type="checkbox" id="remember" className="checkbox-input" />
                        <label htmlFor="remember" className="checkbox-label">Keep me authenticated for 12 hours</label>
                    </div>
                )}
            </div>
        )
    }

    function renderStep1() {
        return (
            <div className="form-fieldset">
                <div style={{ color: 'var(--color-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <GraduationCap size={16} /> Academic Credentials
                </div>

                <div className="input-group">
                    <label className="auth-label">Full Name *</label>
                    <input id="fullname-input" type="text" className="form-input"
                        placeholder="Dr. First Last" value={fullName}
                        onChange={e => { setFullName(e.target.value); setError('') }} required autoFocus />
                </div>

                <div className="form-row">
                    <div className="input-group">
                        <label className="auth-label">Medical Degree *</label>
                        <select id="degree-select" className="form-input" style={{ paddingLeft: '1rem' }} value={degree}
                            onChange={e => { setDegree(e.target.value); setError('') }} required>
                            <option value="">Select degree</option>
                            {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="auth-label">Grad Year *</label>
                        <select id="gradyear-select" className="form-input" style={{ paddingLeft: '1rem' }} value={gradYear}
                            onChange={e => { setGradYear(e.target.value); setError('') }} required>
                            <option value="">Select year</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label className="auth-label">University / Medical College *</label>
                    <input id="university-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                        placeholder="e.g. AIIMS Delhi, CMC Vellore" value={university}
                        onChange={e => { setUniversity(e.target.value); setError('') }} required />
                </div>

                <div className="input-group">
                    <label className="auth-label">License / Registration No. *</label>
                    <input id="license-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                        placeholder="e.g. MCI-2020-XXXXX" value={licenseNo}
                        onChange={e => { setLicenseNo(e.target.value); setError('') }} required />
                </div>

                <div className="input-group">
                    <label className="auth-label">Specialization *</label>
                    <select id="specialization-select" className="form-input" style={{ paddingLeft: '1rem' }} value={specialization}
                        onChange={e => { setSpecialization(e.target.value); setError('') }} required>
                        <option value="">Select specialization</option>
                        {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
        )
    }

    function renderStep2() {
        return (
            <div className="form-fieldset">
                <div style={{ color: 'var(--color-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Building2 size={16} /> Current Hospital Affiliation
                </div>

                <div className="input-group">
                    <label className="auth-label">Hospital Name *</label>
                    <input id="hospital-name-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                        placeholder="e.g. Apollo Hospitals" value={hospitalName}
                        onChange={e => { setHospitalName(e.target.value); setError('') }} required autoFocus />
                </div>

                <div className="form-row">
                    <div className="input-group">
                        <label className="auth-label">Registration No. *</label>
                        <input id="hospital-reg-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                            placeholder="Govt registration" value={hospitalRegNo} onChange={e => { setHospitalRegNo(e.target.value); setError('') }} required />
                    </div>
                    <div className="input-group">
                        <label className="auth-label">Experience (Yrs) *</label>
                        <input id="experience-input" type="number" min="0" max="60" className="form-input" style={{ paddingLeft: '1rem' }}
                            placeholder="0" value={experience} onChange={e => { setExperience(e.target.value); setError('') }} required />
                    </div>
                </div>

                <div className="input-group">
                    <label className="auth-label">Hospital Address *</label>
                    <input id="hospital-addr-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                        placeholder="Street / locality" value={hospitalAddress} onChange={e => { setHospitalAddress(e.target.value); setError('') }} required />
                </div>

                <div className="form-row">
                    <div className="input-group">
                        <label className="auth-label">City *</label>
                        <input id="hospital-city-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                            placeholder="City" value={hospitalCity} onChange={e => { setHospitalCity(e.target.value); setError('') }} required />
                    </div>
                    <div className="input-group">
                        <label className="auth-label">State *</label>
                        <input id="hospital-state-input" type="text" className="form-input" style={{ paddingLeft: '1rem' }}
                            placeholder="State" value={hospitalState} onChange={e => { setHospitalState(e.target.value); setError('') }} required />
                    </div>
                </div>
            </div>
        )
    }

    /* ─────────────────────────────────────────────────────────
       Main render
    ───────────────────────────────────────────────────────── */
    const isLastStep = !isDoctorFlow || signupStep === 2

    return (
        <div className="auth-bg-wrapper">
            <div className="auth-blob-1" />
            <div className="auth-blob-2" />

            <div className="auth-main-card animate-fade">
                {/* Left Panel */}
                <div className="auth-left-panel">
                    <div className="auth-pattern-overlay" />
                    <div className="auth-brand-header">
                        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'auto', fontSize: '0.875rem', fontWeight: 600 }}>
                            <ArrowLeft size={16} /> Back to sanctuary
                        </Link>
                        
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="auth-logo-row">
                                <div className="auth-logo-box">
                                    <Stethoscope size={24} color="white" />
                                </div>
                                <h2 className="auth-brand-title">Medicrew</h2>
                            </div>
                            <h1 className="auth-hero-title">The Digital Sanctuary for Healthcare</h1>
                            <p className="auth-hero-desc">
                                Experience a clinical workspace that prioritizes focus, precision, and patient well-being through high-fidelity monitoring.
                            </p>
                        </div>
                    </div>

                    <div className="auth-illustration">
                        <img 
                            src="https://images.unsplash.com/photo-1576091160550-217359f4ecf8?auto=format&fit=crop&q=80&w=800" 
                            alt="Medical Technology" 
                            style={{ height: '100%', objectFit: 'cover', opacity: 0.15 }}
                        />
                    </div>

                    <div className="auth-status-bar">
                        <p className="auth-status-text">Medicrew Core: v2.4.0 • Clinical Protocol Active</p>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="auth-right-panel">
                    <div className="auth-form-container">
                        <div className="auth-form-header">
                            <h1 className="auth-form-title">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
                            <p className="auth-form-subtitle">
                                {authMode === 'login'
                                    ? isDoctorFlow ? 'Physician authentication portal.' : 'Access your health records and monitoring.'
                                    : isDoctorFlow
                                        ? 'Physician onboarding — strict clinical verification required.'
                                        : 'Begin your healthcare journey with Medicrew.'}
                            </p>
                        </div>

                        {/* Mode Tabs */}
                        <div className="auth-tabs">
                            <button type="button" className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                                onClick={() => setAuthMode('login')} id="tab-login">Sign In</button>
                            <button type="button" className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                                onClick={() => setAuthMode('signup')} id="tab-signup">Sign Up</button>
                        </div>

                        {/* Step indicator for doctor flow */}
                        {isDoctorFlow && authMode === 'signup' && (
                            <div className="stepper-container" style={{ margin: '1.5rem 0' }}>
                                <StepIndicator step={signupStep} totalSteps={3} labels={stepLabels} />
                            </div>
                        )}

                        {/* Messages */}
                        {successMsg && <div className="auth-alert success">{successMsg}</div>}
                        {error && <div className="auth-alert error">{error}</div>}

                        {/* Form */}
                        <form onSubmit={isLastStep ? handleSubmit : handleNext}>
                            {signupStep === 0 && renderStep0()}
                            {signupStep === 1 && renderStep1()}
                            {signupStep === 2 && renderStep2()}

                            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                                {signupStep > 0 && (
                                    <button type="button" className="btn btn-ethereal" style={{ flex: 1, padding: '0.875rem' }}
                                        onClick={() => { setSignupStep(s => s - 1); setError('') }} disabled={loading}>
                                        <ChevronLeft size={18} />
                                        <span>Back</span>
                                    </button>
                                )}
                                <button type="submit" className="submit-btn" disabled={loading} id="submit-btn" style={{ flex: 2 }}>
                                    <span>
                                        {loading
                                            ? (authMode === 'login' ? 'Processing…' : isLastStep ? 'Verifying…' : 'Next…')
                                            : isLastStep
                                                ? 'Initialize Access'
                                                : 'Next Step'}
                                    </span>
                                    {loading ? <Loader size={18} className="spin-icon" /> : <ChevronRight size={18} />}
                                </button>
                            </div>
                        </form>

                        {/* Footer Links */}
                        <div className="auth-footer">
                            <p>
                                {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
                                <button type="button" className="input-link"
                                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                                    {authMode === 'login' ? 'Request Access' : 'Sign In'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Support Floating Button */}
            <div className="support-btn-wrapper" style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem' }}>
                <button className="btn btn-ethereal" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }} onClick={() => window.open('https://medicrew.support')}>
                    <Shield size={16} />
                    <span>Clinical Support</span>
                </button>
            </div>
        </div>
    )
}
