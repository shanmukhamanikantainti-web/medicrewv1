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

    async function fetchProfile(authUser) {
        if (!authUser) return
        addLog(`🚀 Profile Fetch Start: ${authUser.email}`)
        window.supabase = supabase // Expose for manual console debugging

        try {
            addLog('📡 Sending SELECT request to profiles table...')

            // Race the database request against a 5s timeout
            const fetchPromise = supabase.from('profiles').select('*').eq('id', authUser.id).single()
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 5000))

            const result = await Promise.race([fetchPromise, timeoutPromise])

            if (result.timedOut) {
                addLog('❌ DATABASE REQUEST TIMED OUT (5s). Connection blocked?', 'error')
                return setLoading(false)
            }

            const { data, error } = result
            addLog(`⌛ Request Finished. Status: ${error ? 'Error' : 'Success'}`)

            if (error) {
                addLog(`🟡 Profile not found or error: ${error.message} (${error.code})`, 'warn')

                if (error.code === 'PGRST116' || error.message.includes('JSON object')) {
                    addLog('🛠️ Attempting to create profile record...')
                    const role = authUser.email === SUPERADMIN_EMAIL ? 'superadmin' : (authUser.user_metadata?.role || 'patient')

                    const profileData = {
                        id: authUser.id,
                        email: authUser.email,
                        role,
                        full_name: authUser.email.split('@')[0],
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

                        // Check for Foreign Key Violation (Error code 23503 in PostgreSQL)
                        // This happens if the user was deleted from Supabase Auth but the session persists
                        if (insertError.code === '23503') {
                            addLog('⚠️ User record missing in Auth. Signing out...', 'warn')
                            await signOut()
                        } else {
                            // Alert provides immediate visibility for other database errors
                            alert(`Database Error: ${insertError.message}. Check the DEBUG logs in the app.`)
                        }
                    } else {
                        addLog('✅ Profile created successfully!')
                        setProfile(newProfile)
                    }
                } else {
                    addLog(`❌ Unexpected fetch error: ${error.message}`, 'error')
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
