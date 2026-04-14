import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const SUPERADMIN_EMAIL = 'shanmukhamanikanta.inti@gmail.com'

// Used ONLY when ALL DB strategies fail for superadmin.
// Lets them log in and run the SQL patch.
const SUPERADMIN_FALLBACK = (user) => ({
    id: user.id,
    email: user.email,
    full_name: 'Admin (Emergency Mode)',
    role: 'superadmin',
    verified: true,
    _emergency: true
})

// Helper: race a promise against a timeout (ms).
// Returns { timedOut: true } on timeout.
function withTimeout(promise, ms) {
    const timer = new Promise(r => setTimeout(() => r({ timedOut: true }), ms))
    return Promise.race([promise, timer])
}

// Warmup: send a lightweight ping to wake up a cold Supabase instance.
async function warmupDB() {
    try {
        await withTimeout(supabase.from('profiles').select('id').limit(1), 5000)
    } catch (_) { /* ignore */ }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [dbWarmingUp, setDbWarmingUp] = useState(false)
    const [profileError, setProfileError] = useState(null)
    const [isAdminVerified, setIsAdminVerified] = useState(() =>
        sessionStorage.getItem('admin_verified') === 'true'
    )

    useEffect(() => {
        if (user?.email === SUPERADMIN_EMAIL && !isAdminVerified) {
            setIsAdminVerified(true)
            sessionStorage.setItem('admin_verified', 'true')
        }
    }, [user, isAdminVerified])

    useEffect(() => {
        let isMounted = true
        // Reduce safety timeout to 45s and ensure it clears loading
        const safety = setTimeout(() => { 
            if (isMounted) {
                console.warn('[Auth] Safety timeout reached. Clearing loading state.')
                setLoading(false) 
            }
        }, 45000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return
            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user)
            } else {
                setUser(null); setProfile(null); setProfileError(null); setLoading(false)
            }
        })

        return () => { isMounted = false; clearTimeout(safety); subscription.unsubscribe() }
    }, [])

    // ─────────────────────────────────────────────────────────────
    //  fetchProfile: 4-strategy cascade, handles cold starts & RLS
    // ─────────────────────────────────────────────────────────────
    async function fetchProfile(authUser, attempt = 1) {
        const MAX = 3
        if (!authUser) return
        setProfileError(null)

        // Show "warming up" on second+ attempt so UI isn't a blank spinner
        if (attempt > 1) setDbWarmingUp(true)

        try {
            // ───────────────────────────────────────────────────────
            // Strategy 1: SECURITY DEFINER RPC — bypasses RLS entirely
            // Works once supabase_urgent_patch.sql has been run.
            // ───────────────────────────────────────────────────────
            const rpc1 = await withTimeout(supabase.rpc('get_my_profile'), 15000)

            if (!rpc1.timedOut && !rpc1.error) {
                if (rpc1.data && rpc1.data.length > 0) {
                    setProfile(rpc1.data[0])
                    setDbWarmingUp(false)
                    setLoading(false)
                    return
                }

                // Profile row missing → upsert it via RPC (also bypasses RLS)
                const role = authUser.email === SUPERADMIN_EMAIL
                    ? 'superadmin' : (authUser.user_metadata?.role || 'patient')

                const rpc2 = await withTimeout(supabase.rpc('upsert_my_profile', {
                    p_email: authUser.email,
                    p_full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                    p_role: role,
                    p_verified: authUser.email === SUPERADMIN_EMAIL
                }), 15000)

                if (!rpc2.timedOut && !rpc2.error && rpc2.data?.length > 0) {
                    setProfile(rpc2.data[0])
                    setDbWarmingUp(false)
                    setLoading(false)
                    return
                }
            }

            // ───────────────────────────────────────────────────────
            // Strategy 2: Direct table query (works when RLS is clean)
            // Uses maybeSingle() — no error if row is missing, just null
            // ───────────────────────────────────────────────────────

            // Warm up the connection first on attempt 1 if RPC timed out
            if (attempt === 1 && rpc1.timedOut) {
                setDbWarmingUp(true)
                await warmupDB()
            }

            const direct = await withTimeout(
                supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
                20000  // generous timeout for cold-start scenarios
            )

            if (!direct.timedOut && !direct.error) {
                if (direct.data) {
                    setProfile(direct.data)
                    setDbWarmingUp(false)
                    setLoading(false)
                    return
                }

                // No row → INSERT
                const role = authUser.email === SUPERADMIN_EMAIL
                    ? 'superadmin' : (authUser.user_metadata?.role || 'patient')

                const ins = await withTimeout(
                    supabase.from('profiles').insert([{
                        id: authUser.id,
                        email: authUser.email,
                        full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                        role,
                        verified: authUser.email === SUPERADMIN_EMAIL
                    }]).select().maybeSingle(),
                    15000
                )

                if (!ins.timedOut && !ins.error && ins.data) {
                    setProfile(ins.data)
                    setDbWarmingUp(false)
                    setLoading(false)
                    return
                }

                // 23505 = trigger created row between our check & insert → refetch
                if (ins.error?.code === '23505') {
                    await new Promise(r => setTimeout(r, 800))
                    return fetchProfile(authUser, attempt)
                }
            }

            // ───────────────────────────────────────────────────────
            // Strategy 3: Retry with exponential backoff
            // ───────────────────────────────────────────────────────
            if (attempt < MAX) {
                const delay = attempt * 3000      // 3s, 6s
                await new Promise(r => setTimeout(r, delay))
                return fetchProfile(authUser, attempt + 1)
            }

            // ───────────────────────────────────────────────────────
            // Strategy 4: Emergency superadmin bypass
            // All DB calls failed. Give superadmin a synthetic profile
            // so they can reach the admin panel and run the SQL patch.
            // ───────────────────────────────────────────────────────
            if (authUser.email === SUPERADMIN_EMAIL) {
                console.warn('[Auth] Emergency superadmin bypass activated.')
                setProfile(SUPERADMIN_FALLBACK(authUser))
                setDbWarmingUp(false)
                setLoading(false)
                return
            }

            // Regular user — all strategies failed
            setProfileError('Database connection timed out. If you are the administrator, please check RLS policies.')

        } catch (err) {
            console.error('[Auth] Critical error in fetchProfile:', err)
            if (authUser?.email === SUPERADMIN_EMAIL) {
                setProfile(SUPERADMIN_FALLBACK(authUser))
            } else {
                setProfileError('An unexpected authentication error occurred.')
            }
        } finally {
            setDbWarmingUp(false)
            setLoading(false)
        }
    }

    async function signOut() {
        await supabase.auth.signOut()
        setUser(null); setProfile(null); setProfileError(null)
        setIsAdminVerified(false)
        sessionStorage.removeItem('admin_verified')
    }

    const verifyAdmin = (code) => {
        if (code === 'MEDICREWV12026') {
            setIsAdminVerified(true)
            sessionStorage.setItem('admin_verified', 'true')
            return true
        }
        return false
    }

    async function updateProfile(updates) {
        try {
            // Try RPC upsert first (handles cold-start gracefully)
            const rpc = await supabase.rpc('upsert_my_profile', {
                p_email: updates.email || profile?.email,
                p_full_name: updates.full_name || profile?.full_name,
                p_role: profile?.role,
                p_verified: profile?.verified,
                ...updates
            })
            if (!rpc.error && rpc.data?.length > 0) {
                setProfile(rpc.data[0]); return rpc.data[0]
            }
        } catch (_) { /* fall through */ }

        // Fallback to direct update
        const { data } = await supabase.from('profiles')
            .update(updates).eq('id', user.id).select().maybeSingle()
        if (data) setProfile(data)
        return data
    }

    const resetAuth = async () => {
        await supabase.auth.signOut()
        localStorage.clear(); sessionStorage.clear()
        window.location.reload()
    }

    const role = profile?.role || null

    return (
        <AuthContext.Provider value={{
            user, profile, loading, dbWarmingUp, role, profileError,
            isPatient: role === 'patient',
            isDoctor: role === 'doctor',
            isAdmin: role === 'admin' || role === 'superadmin',
            isSuperAdmin: role === 'superadmin',
            isAdminVerified,
            signOut, updateProfile, resetAuth, verifyAdmin,
            fetchProfile: () => user && fetchProfile(user)
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
