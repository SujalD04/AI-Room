'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useTheme } from '@/components/ThemeProvider';
import { User, Mail, Lock, AlertTriangle, Check, X, Sun, Moon } from '@/components/Icons';

export default function RegisterPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Password strength checks
    const pwChecks = useMemo(() => ({
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    }), [password]);

    const pwScore = Object.values(pwChecks).filter(Boolean).length;
    const pwStrength = pwScore <= 2 ? 'weak' : pwScore <= 4 ? 'medium' : 'strong';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Client-side validation
        if (pwScore < 5) {
            setError('Password does not meet all requirements');
            return;
        }

        setLoading(true);

        try {
            const { user, token } = await api.register({ username, email, password });
            setAuth(user, token);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const Requirement = ({ met, text }: { met: boolean; text: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }} className={met ? 'met' : ''}>
            {met ? <Check size={12} color="var(--accent-success)" /> : <X size={12} color="var(--text-tertiary)" />}
            <span style={{ color: met ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{text}</span>
        </div>
    );

    return (
        <div className="auth-page-wrapper">
            <div className="auth-card-modern">
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
                    <h1 className="auth-title-modern">Create Account</h1>
                    <p className="auth-subtitle-modern">Join AIRoom and start collaborating</p>
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
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label" htmlFor="username" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                            <User size={12} /> USERNAME
                        </label>
                        <input
                            id="username"
                            type="text"
                            className="input-modern"
                            placeholder="johndoe"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                            minLength={3}
                            maxLength={30}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
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
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" htmlFor="password" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                            <Lock size={12} /> PASSWORD
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="input-modern"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        {/* Password strength indicator */}
                        {password.length > 0 && (
                            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                    {[1, 2, 3].map((step) => {
                                        let bg = 'var(--border-subtle)';
                                        if (pwStrength === 'weak' && step === 1) bg = 'var(--accent-danger)';
                                        if (pwStrength === 'medium' && step <= 2) bg = 'var(--accent-warning)';
                                        if (pwStrength === 'strong' && step <= 3) bg = 'var(--accent-success)';
                                        return (
                                            <div
                                                key={step}
                                                style={{
                                                    flex: 1,
                                                    height: '4px',
                                                    borderRadius: '2px',
                                                    background: bg,
                                                    transition: 'all 0.3s ease'
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                                    <Requirement met={pwChecks.length} text="8+ characters" />
                                    <Requirement met={pwChecks.upper} text="Uppercase char" />
                                    <Requirement met={pwChecks.lower} text="Lowercase char" />
                                    <Requirement met={pwChecks.digit} text="One number" />
                                    <Requirement met={pwChecks.special} text="Special char (!@#)" />
                                </div>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn-modern" style={{ marginTop: '24px' }} disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-switch-modern">
                    Already have an account? <a href="/login">Sign in</a>
                </div>
            </div>
        </div>
    );
}
