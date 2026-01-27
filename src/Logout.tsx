// components/UserProfileDropdown.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface UserProfileDropdownProps {
    userName?: string | null
}

export function UserProfileDropdown({ userName }: UserProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const handleLogout = async () => {
        setIsLoading(true)
        await logout()
    }

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setDropdownPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right
            })
        }
        setIsOpen(!isOpen)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
            >
                {/* User Icon */}
                <svg
                    className="w-8 h-8 text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
                {userName && (
                    <span className="text-gray-300 text-sm">{userName}</span>
                )}
                {/* Dropdown Arrow */}
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
                    className="fixed w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50"
                >
                    <button
                        onClick={handleLogout}
                        disabled={isLoading}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-gray-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {isLoading ? 'Logging out...' : 'Logout'}
                    </button>
                </div>
            )}
        </div>
    )
}


async function logout() {
    // 1. Clear the httpOnly cookie via server-side API route
    await fetch('/api/logout', {
        method: 'POST'
    })

    // 2. Clear local token storage (if any)
    localStorage.removeItem('access_token')

    // 3. Redirect to home (middleware will redirect to login if needed)
    window.location.href = '/'
}
