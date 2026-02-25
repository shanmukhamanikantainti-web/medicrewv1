import { useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export function AdminShortcut() {
    const { isAdmin, isAdminVerified } = useAuth()
    const navigate = useNavigate()

    const handleKeyDown = useCallback((e) => {
        // Ctrl+Q shortcut
        if (e.ctrlKey && e.key === 'q') {
            e.preventDefault()

            // Only trigger if user is an admin
            if (isAdmin) {
                if (isAdminVerified) {
                    navigate('/admin')
                } else {
                    navigate('/admin/verify')
                }
            }
        }
    }, [isAdmin, isAdminVerified, navigate])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return null
}
