'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { Zap, Users, Crown, AlertTriangle } from '@/components/Icons';

export default function JoinPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const { isAuthenticated, loadFromStorage } = useAuthStore();
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
        <div className="content-center" style={{ background: 'var(--gradient-dark)' }}>
            <div className="auth-container">
                <div className="auth-card glass-strong" style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <a href="/" className="logo" style={{ justifyContent: 'center' }}>
                            <div className="logo-icon" style={{ width: 56, height: 56 }}>
                                <Zap size={28} />
                            </div>
                        </a>
                    </div>
                    <h1 className="auth-title">Join Room</h1>

                    {error ? (
                        <>
                            <div
                                style={{
                                    color: 'var(--accent-danger)',
                                    margin: '16px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                }}
                            >
                                <AlertTriangle size={16} /> {error}
                            </div>
                            <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
                                Go to Dashboard
                            </button>
                        </>
                    ) : room ? (
                        <>
                            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '16px' }}>{room.name}</p>
                            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Crown size={14} /> Hosted by <strong>{room.host?.username}</strong>
                                <span style={{ opacity: 0.5 }}>·</span>
                                <Users size={14} /> {room.memberCount}/{room.maxMembers}
                            </p>
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                onClick={handleJoin}
                                disabled={joining}
                            >
                                {joining ? 'Joining...' : 'Join Room'}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
