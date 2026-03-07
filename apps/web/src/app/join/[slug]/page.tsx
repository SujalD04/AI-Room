'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useTheme } from '@/components/ThemeProvider';
import { Users, Crown, AlertTriangle, Sun, Moon } from '@/components/Icons';

export default function JoinPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const { isAuthenticated, loadFromStorage } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
    const [room, setRoom] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadFromStorage();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadRoom();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, slug]);

    const loadRoom = async () => {
        try {
            const { room } = await api.getRoom(slug);
            setRoom(room);
            if (room.isMember) {
                router.push(`/room/${slug}`);
                return;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        setJoining(true);
        setError('');
        try {
            await api.joinRoom(slug);
            router.push(`/room/${slug}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setJoining(false);
        }
    };

    if (!isAuthenticated && !loading) {
        router.push(`/login?redirect=/join/${slug}`);
        return null;
    }

    if (loading) {
        return (
            <div className="loading-page">
                <span className="spinner" style={{ width: 40, height: 40 }} />
            </div>
        );
    }

    return (
        <div className="auth-page-wrapper">
            <div className="auth-card-modern" style={{ textAlign: 'center' }}>
                <button
                    onClick={toggleTheme}
                    className="btn btn-ghost"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)'
                    }}
                    aria-label="Toggle Theme"
                    type="button"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <div className="auth-header-modern">
                    <div className="auth-logo-box">
                        <img
                            src="/logo.png"
                            alt="AIRoom Logo"
                            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                        />
                    </div>
                    <h1 className="auth-title-modern">Join Room</h1>
                    <p className="auth-subtitle-modern">You've been invited to collaborate</p>
                </div>

                {error ? (
                    <>
                        <div
                            style={{
                                color: 'var(--accent-danger)',
                                background: 'rgba(225, 112, 85, 0.15)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                marginBottom: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            <AlertTriangle size={16} /> {error}
                        </div>
                        <button className="btn-modern" onClick={() => router.push('/dashboard')}>
                            Go to Dashboard
                        </button>
                    </>
                ) : room ? (
                    <>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', marginBottom: '24px' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{room.name}</p>
                            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Crown size={14} /> Hosted by <strong style={{ color: 'var(--text-primary)' }}>{room.host?.username}</strong>
                            </p>
                            <p style={{ color: 'var(--text-tertiary)', margin: '4px 0 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Users size={14} /> {room.memberCount} / {room.maxMembers} Members
                            </p>
                        </div>

                        <button
                            className="btn-modern"
                            style={{ width: '100%' }}
                            onClick={handleJoin}
                            disabled={joining}
                        >
                            {joining ? 'Joining Room...' : 'Join Room'}
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}
