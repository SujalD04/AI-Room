'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useTheme } from '@/components/ThemeProvider';
import { Mail, Lock, AlertTriangle, Sun, Moon } from '@/components/Icons';

export default function LoginPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
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
        <div className="auth-page-wrapper">
            <div className="auth-card-modern">
                {/* Theme Toggle Button */}
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
                    <h1 className="auth-title-modern">Welcome Back</h1>
                    <p className="auth-subtitle-modern">Sign in to your AIRoom workspace</p>
                </div>

                {error && (
                    <div
                        style={{
                            background: 'rgba(225, 112, 85, 0.15)',
                            color: 'var(--accent-danger)',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '0.9rem',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" htmlFor="email" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                            <Mail size={12} /> EMAIL
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="input-modern"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label className="form-label" htmlFor="password" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                <Lock size={12} /> PASSWORD
                            </label>
                            <a href="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                                Forgot password?
                            </a>
                        </div>
                        <input
                            id="password"
                            type="password"
                            className="input-modern"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-modern" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-switch-modern">
                    Don't have an account? <a href="/register">Create one</a>
                </div>
            </div>
        </div>
    );
}
