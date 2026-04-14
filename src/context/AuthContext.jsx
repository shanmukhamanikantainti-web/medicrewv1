import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const SUPERADMIN_EMAIL = 'shanmukhamanikanta.inti@gmail.com'

// Synthetic superadmin profile used ONLY when DB is unreachable.
// Lets the admin log in, run the SQL fix, and restore full DB access.
const SUPERADMIN_FALLBACK = (user) => ({
    id: user.id,
    email: user.email,
    full_name: 'Shanmukha (Emergency Mode)',
    role: 'superadmin',
    verified: true,
    _emergency: true   // flag so we can show a banner
})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [profileError, setProfileError] = useState(null)
    const [isAdminVerified, setIsAdminVerified] = useState(() =>
        sessionStorage.getItem('admin_verified') === 'true'
    )

    // Auto-verify superadmin email
    useEffect(() => {
        if (user?.email === SUPERADMIN_EMAIL && !isAdminVerified) {
            setIsAdminVerified(true)
            sessionStorage.setItem('admin_verified', 'true')
        }
    }, [user, isAdminVerified])

    useEffect(() => {
        let isMounted = true

        // Hard safety cap — never block UI forever
        const safetyTimer = setTimeout(() => {
            if (isMounted && loading) setLoading(false)
        }, 35000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return
            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user)
            } else {
                setUser(null)
                setProfile(null)
                setProfileError(null)
                setLoading(false)
            }
        })

        return () => {
            isMounted = false
            clearTimeout(safetyTimer)
            subscription.unsubscribe()
        }
    }, [])

    // ─── Core profile fetch ────────────────────────────────────────
    async function fetchProfile(authUser, attempt = 1) {
        const MAX = 3
        if (!authUser) return
        setProfileError(null)

        try {
            // ── Strategy 1: SECURITY DEFINER RPC (bypasses RLS deadlock) ──
            // Works after running supabase_fix_rls.sql
            const rpcResult = await Promise.race([
                supabase.rpc('get_my_profile'),
                new Promise(r => setTimeout(() => r({ timedOut: true }), 8000))
            ])

            if (!rpcResult.timedOut && !rpcResult.error && rpcResult.data?.length > 0) {
                setProfile(rpcResult.data[0])
                setLoading(false)
                return
            }

            // ── Strategy 2: RPC returned empty → try upsert RPC ──────────
            if (!rpcResult.timedOut && !rpcResult.error && rpcResult.data?.length === 0) {
                const role = authUser.email === SUPERADMIN_EMAIL ? 'superadmin'
                    : (authUser.user_metadata?.role || 'patient')
                const upsertResult = await supabase.rpc('upsert_my_profile', {
                    p_email: authUser.email,
                    p_full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                    p_role: role,
                    p_verified: authUser.email === SUPERADMIN_EMAIL
                })
                if (!upsertResult.error && upsertResult.data?.length > 0) {
                    setProfile(upsertResult.data[0])
                    setLoading(false)
                    return
                }
            }

            // ── Strategy 3: Direct table query (works if RLS is clean) ───
            if (attempt <= MAX) {
                const direct = await Promise.race([
                    supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
                    new Promise(r => setTimeout(() => r({ timedOut: true }), 8000))
                ])

                if (!direct.timedOut) {
                    if (!direct.error && direct.data) {
                        setProfile(direct.data)
                        setLoading(false)
                        return
                    }

                    // No row yet → insert
                    if (!direct.error && !direct.data) {
                        const insertResult = await supabase.from('profiles')
                            .insert([{
                                id: authUser.id,
                                email: authUser.email,
                                full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                                role: authUser.email === SUPERADMIN_EMAIL ? 'superadmin' : (authUser.user_metadata?.role || 'patient'),
                                verified: authUser.email === SUPERADMIN_EMAIL
                            }])
                            .select().maybeSingle()

                        if (!insertResult.error && insertResult.data) {
                            setProfile(insertResult.data)
                            setLoading(false)
                            return
                        }
                        // 23505 = trigger already created it — just refetch
                        if (insertResult.error?.code === '23505') {
                            await new Promise(r => setTimeout(r, 500))
                            return fetchProfile(authUser, attempt)
                        }
                    }
                }

                // Retry with backoff
                if (attempt < MAX) {
                    await new Promise(r => setTimeout(r, attempt * 2000))
                    return fetchProfile(authUser, attempt + 1)
                }
            }

            // ── Strategy 4: Emergency superadmin bypass ───────────────────
            // Database is completely unreachable. Give superadmin a synthetic
            // profile so they can at least access the admin panel and run the SQL fix.
            if (authUser.email === SUPERADMIN_EMAIL) {
                setProfile(SUPERADMIN_FALLBACK(authUser))
                setLoading(false)
                return
            }

            // All strategies failed for regular user
            setProfileError('Database unreachable. Please contact your administrator.')
        } catch (err) {
            console.error('[AuthContext] Critical error:', err)
            // Last-resort superadmin protection
            if (authUser?.email === SUPERADMIN_EMAIL) {
                setProfile(SUPERADMIN_FALLBACK(authUser))
            }
        } finally {
            setLoading(false)
        }
    }

    async function signOut() {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setProfileError(null)
        setIsAdminVerified(false)
        sessionStorage.removeItem('admin_verified')
    }

    const verifyAdmin = (code) => {
        const ACCESS_CODE = 'DTI2026MEDICREW4240'
        if (code === ACCESS_CODE) {
            setIsAdminVerified(true)
            sessionStorage.setItem('admin_verified', 'true')
            return true
        }
        return false
    }

    async function updateProfile(updates) {
        try {
            const { data } = await supabase.from('profiles')
                .update(updates).eq('id', user.id).select().maybeSingle()
            if (data) setProfile(data)
            return data
        } catch (err) {
            console.error('updateProfile error:', err)
        }
    }

    const resetAuth = async () => {
        await supabase.auth.signOut()
        localStorage.clear()
        sessionStorage.clear()
        window.location.reload()
    }

    const role = profile?.role || null
    const isPatient = role === 'patient'
    const isDoctor = role === 'doctor'
    const isAdmin = role === 'admin' || role === 'superadmin'
    const isSuperAdmin = role === 'superadmin'

    return (
        <AuthContext.Provider value={{
            user, profile, loading, role, profileError,
            isPatient, isDoctor, isAdmin, isSuperAdmin, isAdminVerified,
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
