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

function ProtectedRoute({ children, allowedRoles }) {
    // ALL hooks must be called at the top level, unconditionally
    const { user, profile, loading, isAdminVerified, fetchProfile, debugLog, resetAuth } = useAuth()

    if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading MediCrew...</p></div>

    if (!user) return <Navigate to="/auth" replace />

    // If user exists but profile couldn't be loaded/created
    if (!profile) {
        return (
            <div className="dashboard-layout" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem' }}>
                <div className="card" style={{ maxWidth: 600, width: '100%', padding: '2.5rem' }}>
                    <div style={{ width: 64, height: 64, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <h2 style={{ color: '#ef4444', marginBottom: '0.5rem', textAlign: 'center' }}>Profile Access Required</h2>
                    <p style={{ margin: '1rem 0', color: 'var(--gray-600)', lineHeight: 1.6, textAlign: 'center' }}>
                        We found your account (<strong>{user.email}</strong>), but your health profile record is missing.
                    </p>

                    {/* Debug Console */}
                    <div style={{ background: '#1e293b', color: '#38bdf8', padding: '1rem', borderRadius: 8, fontSize: '0.75rem', fontFamily: 'monospace', marginBottom: '1.5rem', overflow: 'auto', maxHeight: 300 }}>
                        <div style={{ color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: 4, marginBottom: 8, fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span>SYSTEM DEBUG LOG</span>
                            <span>Project: {import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}</span>
                        </div>
                        <div style={{ color: '#6366f1', marginBottom: 8 }}>
                            URL: {import.meta.env.VITE_SUPABASE_URL}<br />
                            User ID: {user.id}
                        </div>
                        {debugLog.length === 0 ? <div style={{ color: '#94a3b8 italic' }}>No execution logs yet. Click Initialize Profile...</div> : debugLog.map((log, i) => (
                            <div key={i} style={{ marginBottom: 2, color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#38bdf8' }}>
                                [{log.time}] {log.msg}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Page</button>
                        <button className="btn btn-outline" onClick={() => fetchProfile()}>Initialize Profile</button>
                    </div>
                    <button
                        className="btn btn-outline"
                        style={{ marginTop: '0.75rem', width: '100%', borderColor: '#6366f1', color: '#6366f1' }}
                        onClick={async () => {
                            try {
                                const { error } = await window.supabase.from('profiles').select('count', { count: 'exact', head: true });
                                if (error) throw error;
                                alert(`Test Success! Connection is active.`);
                            } catch (err) {
                                alert(`Test Failed: ${err.message}`);
                            }
                        }}
                    >
                        Test Database Connectivity
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ marginTop: '0.75rem', width: '100%', color: '#ef4444' }}
                        onClick={resetAuth}
                    >
                        Sign Out & Reset Session
                    </button>
                </div>
            </div>
        )
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
        console.warn('Access denied for role:', profile.role)
        return <Navigate to="/" replace />
    }

    // Role-specific secondary checks
    if (allowedRoles && (allowedRoles.includes('admin') || allowedRoles.includes('superadmin'))) {
        // Prevent circular redirect for the verification page itself
        if (!isAdminVerified && window.location.pathname !== '/admin/verify') {
            return <Navigate to="/admin/verify" replace />
        }
    }

    return children
}

export default function App() {
    const { user, profile, loading } = useAuth()
    console.log('App state:', { loading, hasUser: !!user, hasProfile: !!profile })

    if (loading) return (
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

    return (
        <>
            <AdminShortcut />
            <Routes>
                <Route path="/" element={
                    !user ? <Landing /> :
                        profile ? <Navigate to={getDashboardRoute(profile.role)} replace /> :
                            <div className="loading-screen"><div className="spinner" /></div>
                } />
                <Route path="/auth" element={
                    !user ? <Auth /> :
                        profile ? <Navigate to={getDashboardRoute(profile.role)} replace /> :
                            <div className="loading-screen"><div className="spinner" /></div>
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
    if (!role) return null
    if (role === 'doctor') return '/doctor'
    if (role === 'admin' || role === 'superadmin') return '/admin'
    return '/patient'
}
