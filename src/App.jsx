import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import PatientDashboard from './pages/PatientDashboard'
import AIAssistant from './pages/AIAssistant'
import DeviceMonitor from './pages/DeviceMonitor'
import Appointments from './pages/Appointments'
import DoctorDashboard from './pages/DoctorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminVerify from './pages/AdminVerify'
import { AdminShortcut } from './components/AdminShortcut'
import { AlertCircle } from 'lucide-react'

// ── Loading screen ──────────────────────────────────────────────────
function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-logo">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#2563EB" />
                    <path d="M24 10v28M10 24h28" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="24" cy="24" r="6" fill="white" fillOpacity="0.3" />
                </svg>
                <span>MediCrew</span>
            </div>
            <div className="spinner" />
        </div>
    )
}

// ── Error Display for when things go wrong ──────────────────────────
function ErrorDisplay({ error, onRetry, onReset }) {
    return (
        <div className="loading-screen" style={{ background: 'var(--bg)' }}>
            <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '2.5rem' }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
                }}>
                    <AlertCircle size={28} color="#ef4444" />
                </div>
                <h2 style={{ color: 'var(--gray-900)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Connection Blocked</h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                    {error || 'The secure connection to our medical database was interrupted.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={onRetry}>Try Again</button>
                    <button className="btn btn-ghost" onClick={onReset} style={{ fontSize: '0.85rem' }}>Sign Out & Reset</button>
                </div>
            </div>
        </div>
    )
}

// ── Emergency banner shown when DB is unreachable ──────────────────

// ── Protected route ─────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
    const { user, profile, loading, dbWarmingUp, profileError, isAdminVerified, fetchProfile, resetAuth } = useAuth()

    // Auto-retry profile fetch if it errored
    useEffect(() => {
        if (!loading && user && !profile && !profileError) {
            fetchProfile()
        }
    }, [loading, user, profile, profileError])

    if (loading) return <LoadingScreen />
    if (!user) return <Navigate to="/auth" replace />

    // Removed the "Setting up your profile" forced block for better UX.
    // The screen will now load immediately. If the role is missing, 
    // it will sync in the background without locking the UI.

    // All 3 strategies failed — clean, user-friendly error
    if (!profile && profileError) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '2rem', background: 'var(--bg)'
            }}>
                <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%', background: '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                            stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Profile Unavailable</h2>
                    <p style={{ color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: '2rem' }}>
                        We couldn't load your profile right now. This is usually a temporary issue.
                        Please try again or contact your administrator.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button className="btn btn-primary" id="retry-profile-btn" onClick={fetchProfile}>
                            Try Again
                        </button>
                        <button className="btn btn-outline" id="signout-reset-btn" onClick={resetAuth}
                            style={{ color: '#64748b' }}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Role access check - if role is missing, we handle it carefully to avoid incorrect redirects
    const currentRole = profile?.role || 'patient'

    // Role access check
    if (allowedRoles && !allowedRoles.includes(currentRole)) {
        // If we have a user but NO profile yet (syncing), we MUST wait to be sure
        // before redirecting them to the home page. 
        if (!profile) return <LoadingScreen />
        
        console.warn('Access denied for role:', currentRole)
        return <Navigate to="/" replace />
    }

    // Admin secondary verification
    if (allowedRoles && (allowedRoles.includes('admin') || allowedRoles.includes('superadmin'))) {
        if (!isAdminVerified && window.location.pathname !== '/admin/verify') {
            return <Navigate to="/admin/verify" replace />
        }
    }

    return (
        <>
            {profile?._emergency && <EmergencyBanner />}
            {children}
        </>
    )
}

export default function App() {
    const { user, profile, loading, profileError, fetchProfile, resetAuth } = useAuth()

    if (loading) return <LoadingScreen />

    if (user && !profile && profileError) {
        return <ErrorDisplay error={profileError} onRetry={fetchProfile} onReset={resetAuth} />
    }

    return (
        <>
            <AdminShortcut />
            <Routes>
                <Route path="/" element={
                    !user ? <Landing /> :
                        profile ? <Navigate to={getDashboardRoute(profile.role)} replace /> :
                            <LoadingScreen />
                } />
                <Route path="/auth" element={
                    !user ? <Auth /> :
                        profile ? <Navigate to={getDashboardRoute(profile.role)} replace /> :
                            <LoadingScreen />
                } />

                <Route path="/patient/*" element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        <Routes>
                            <Route index element={<PatientDashboard />} />
                            <Route path="ai" element={<AIAssistant />} />
                            <Route path="devices" element={<DeviceMonitor />} />
                            <Route path="appointments" element={<Appointments />} />
                        </Routes>
                    </ProtectedRoute>
                } />

                <Route path="/doctor/*" element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <Routes>
                            <Route index element={<DoctorDashboard />} />
                            <Route path="appointments" element={<Appointments />} />
                        </Routes>
                    </ProtectedRoute>
                } />

                <Route path="/admin/verify" element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                        <AdminVerify />
                    </ProtectedRoute>
                } />

                <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    )
}

function getDashboardRoute(role) {
    if (!role) return '/'
    if (role === 'doctor') return '/doctor'
    if (role === 'admin' || role === 'superadmin') return '/admin'
    return '/patient'
}
