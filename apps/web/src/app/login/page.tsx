'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { Zap, Mail, Lock, AlertTriangle } from '@/components/Icons';

export default function LoginPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { user, token } = await api.login({ email, password });
            setAuth(user, token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-center" style={{ background: 'var(--gradient-dark)' }}>
            <div className="auth-container">
                <div className="auth-card glass-strong">
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <a href="/" className="logo" style={{ justifyContent: 'center' }}>
                            <div className="logo-icon" style={{ width: 48, height: 48 }}>
                                <Zap size={24} />
                            </div>
                        </a>
                    </div>
                    <h1 className="auth-title">Welcome Back</h1>
                    <p className="auth-subtitle">Sign in to your AIRoom workspace</p>

                    {error && (
                        <div
                            style={{
                                background: 'rgba(225, 112, 85, 0.15)',
                                color: 'var(--accent-danger)',
                                padding: '10px 16px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.85rem',
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">
                                <Mail size={12} style={{ marginRight: '4px' }} /> Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>
                                    <Lock size={12} style={{ marginRight: '4px' }} /> Password
                                </label>
                                <a href="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                                    Forgot password?
                                </a>
                            </div>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ width: '100%', marginTop: '8px' }}
                        >
                            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don&apos;t have an account?{' '}
                        <a href="/register" style={{ fontWeight: 600 }}>
                            Create one
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
