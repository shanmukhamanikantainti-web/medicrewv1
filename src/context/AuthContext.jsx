import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const SUPERADMIN_EMAIL = 'shanmukhamanikanta.inti@gmail.com'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [debugLog, setDebugLog] = useState([])
    const [isAdminVerified, setIsAdminVerified] = useState(() => {
        return sessionStorage.getItem('admin_verified') === 'true'
    })

    // Auto-verify if superadmin email matches
    useEffect(() => {
        if (user?.email === SUPERADMIN_EMAIL && !isAdminVerified) {
            setIsAdminVerified(true)
            sessionStorage.setItem('admin_verified', 'true')
        }
    }, [user, isAdminVerified])

    const addLog = (msg, type = 'info') => {
        console.log(`[DEBUG] ${msg}`)
        setDebugLog(prev => [...prev.slice(-10), { msg, type, time: new Date().toLocaleTimeString() }])
    }

    useEffect(() => {
        let isMounted = true

        // Use a safety timeout in case onAuthStateChange is slow
        const timeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('Auth check timeout')
                setLoading(false)
            }
        }, 8000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            addLog(`Auth Event: ${event} for ${session?.user?.email || 'no user'}`)
            if (!isMounted) return

            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user)
            } else {
                setUser(null)
                setProfile(null)
                setLoading(false)
            }
        })

        return () => {
            isMounted = false
            clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [])

    async function fetchProfile(authUser, attempt = 1) {
        const MAX_ATTEMPTS = 3
        if (!authUser) return
        addLog(`🚀 Profile Fetch Start: ${authUser.email} (attempt ${attempt}/${MAX_ATTEMPTS})`)
        window.supabase = supabase

        try {
            addLog('📡 Sending SELECT request to profiles table...')

            // Race the database request against a 10s timeout
            const fetchPromise = supabase.from('profiles').select('*').eq('id', authUser.id).single()
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 10000))

            const result = await Promise.race([fetchPromise, timeoutPromise])

            if (result.timedOut) {
                addLog(`❌ DATABASE REQUEST TIMED OUT (10s) on attempt ${attempt}.`, 'error')
                if (attempt < MAX_ATTEMPTS) {
                    const delay = attempt * 2000
                    addLog(`⏳ Retrying in ${delay / 1000}s...`, 'warn')
                    await new Promise(r => setTimeout(r, delay))
                    return fetchProfile(authUser, attempt + 1)
                }
                addLog('🚫 All retry attempts exhausted. Run supabase_fix_rls.sql in your Supabase dashboard.', 'error')
                return setLoading(false)
            }

            const { data, error } = result
            addLog(`⌛ Request Finished. Status: ${error ? 'Error' : 'Success'}`)

            if (error) {
                addLog(`🟡 Profile not found or error: ${error.message} (${error.code})`, 'warn')

                // PGRST116 = no rows returned — profile doesn't exist yet
                if (error.code === 'PGRST116' || error.message?.includes('JSON object')) {
                    addLog('🛠️ Attempting to create profile record...')
                    const role = authUser.email === SUPERADMIN_EMAIL ? 'superadmin' : (authUser.user_metadata?.role || 'patient')

                    const profileData = {
                        id: authUser.id,
                        email: authUser.email,
                        role,
                        full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                        verified: authUser.email === SUPERADMIN_EMAIL
                    }
                    addLog(`📦 Data payload: ${JSON.stringify(profileData)}`)

                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert([profileData])
                        .select()
                        .single()

                    if (insertError) {
                        addLog(`❌ DATABASE INSERT FAILED: ${insertError.message}`, 'error')
                        if (insertError.details) addLog(`Details: ${insertError.details}`, 'error')

                        if (insertError.code === '23503') {
                            // FK violation: auth user missing, force sign out
                            addLog('⚠️ User record missing in Auth. Signing out...', 'warn')
                            await signOut()
                        } else if (insertError.code === '23505') {
                            // Unique violation: trigger already created the profile — just refetch
                            addLog('ℹ️ Profile created by trigger (race condition). Refetching...', 'warn')
                            await new Promise(r => setTimeout(r, 500))
                            return fetchProfile(authUser, attempt)
                        } else {
                            addLog(`❌ Unhandled insert error: ${insertError.code}`, 'error')
                        }
                    } else {
                        addLog('✅ Profile created successfully!')
                        setProfile(newProfile)
                    }
                } else {
                    addLog(`❌ Unexpected fetch error: ${error.message}`, 'error')
                    if (attempt < MAX_ATTEMPTS) {
                        const delay = attempt * 2000
                        addLog(`⏳ Retrying in ${delay / 1000}s...`, 'warn')
                        await new Promise(r => setTimeout(r, delay))
                        return fetchProfile(authUser, attempt + 1)
                    }
                }
            } else if (data) {
                addLog(`✅ Profile loaded successfully. Role: ${data.role}`)
                setProfile(data)
            }
        } catch (err) {
            addLog(`🚨 CRITICAL SYSTEM ERROR: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function signOut() {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
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
        const { data } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single()
        setProfile(data)
        return data
    }

    const role = profile?.role || null
    const isPatient = role === 'patient'
    const isDoctor = role === 'doctor'
    const isAdmin = role === 'admin' || role === 'superadmin'
    const isSuperAdmin = role === 'superadmin'

    const resetAuth = async () => {
        addLog('Resetting Auth State...')
        await supabase.auth.signOut()
        localStorage.clear()
        window.location.reload()
    }

    return (
        <AuthContext.Provider value={{
            user, profile, loading, role, debugLog, addLog,
            isPatient, isDoctor, isAdmin, isSuperAdmin, isAdminVerified,
            signOut, updateProfile, resetAuth, verifyAdmin, fetchProfile: () => user && fetchProfile(user)
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
