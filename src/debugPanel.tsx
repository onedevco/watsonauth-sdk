'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WatsonAuthDebugEvent } from './proxy'

function readDebugCookie(): WatsonAuthDebugEvent | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(/watson_auth_debug=([^;]+)/)
    if (!match) return null
    try {
        return JSON.parse(decodeURIComponent(match[1])) as WatsonAuthDebugEvent
    } catch {
        return null
    }
}

function useCountdown(expiresAt?: number): number | null {
    const [seconds, setSeconds] = useState<number | null>(null)

    useEffect(() => {
        if (!expiresAt) {
            setSeconds(null)
            return
        }
        const tick = () => setSeconds(Math.floor(expiresAt - Date.now() / 1000))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [expiresAt])

    return seconds
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
    allow:    { bg: '#0f3460', text: '#93c5fd' },
    refresh:  { bg: '#14532d', text: '#86efac' },
    redirect: { bg: '#7f1d1d', text: '#fca5a5' },
}

function Badge({ action }: { action: string }) {
    const colors = ACTION_COLORS[action] ?? { bg: '#1e293b', text: '#94a3b8' }
    return (
        <span style={{
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            background: colors.bg,
            color: colors.text,
            letterSpacing: '0.03em',
        }}>
            {action}
        </span>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '7px', gap: '16px' }}>
            <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0 }}>{label}</span>
            <span style={{ color: '#e2e8f0', fontSize: '11px', textAlign: 'right', wordBreak: 'break-all' }}>{children}</span>
        </div>
    )
}

export function WatsonAuthDebugPanel() {
    const [event, setEvent] = useState<WatsonAuthDebugEvent | null>(null)
    const [open, setOpen] = useState(true)
    const countdown = useCountdown(event?.tokenExpiresAt)

    const refresh = useCallback(() => setEvent(readDebugCookie()), [])

    useEffect(() => {
        refresh()
        // Pick up updates after navigations and server actions
        const id = setInterval(refresh, 2000)
        window.addEventListener('focus', refresh)
        return () => {
            clearInterval(id)
            window.removeEventListener('focus', refresh)
        }
    }, [refresh])

    const expiryColor =
        countdown === null ? '#94a3b8'
        : countdown < 30   ? '#f87171'
        : countdown < 120  ? '#fbbf24'
        :                    '#86efac'

    const lastRefresh = event?.refreshedAt
        ? new Date(event.refreshedAt).toLocaleTimeString()
        : '—'

    return (
        <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999, fontFamily: 'monospace' }}>
            <div style={{
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: '8px',
                padding: open ? '12px 16px 14px' : '9px 14px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                minWidth: '260px',
                border: '1px solid #1e293b',
            }}>
                {/* Header */}
                <div
                    onClick={() => setOpen(o => !o)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                >
                    <span style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        WatsonAuth Debug
                    </span>
                    {event && <Badge action={event.action} />}
                    <span style={{ color: '#475569', fontSize: '10px', marginLeft: '6px' }}>{open ? '▼' : '▲'}</span>
                </div>

                {open && (
                    <div style={{ marginTop: '4px' }}>
                        {!event ? (
                            <div style={{ color: '#475569', fontSize: '11px', marginTop: '8px' }}>No requests intercepted yet</div>
                        ) : (
                            <>
                                <Row label="path">{event.path}</Row>
                                {event.reason && (
                                    <Row label="reason">
                                        <span style={{ color: '#fca5a5' }}>{event.reason}</span>
                                    </Row>
                                )}
                                {event.userId && <Row label="user">{event.userId}</Row>}
                                <Row label="token expires in">
                                    <span style={{ color: expiryColor, fontWeight: 600 }}>
                                        {countdown !== null ? `${countdown}s` : '—'}
                                    </span>
                                </Row>
                                <Row label="last refresh">{lastRefresh}</Row>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
