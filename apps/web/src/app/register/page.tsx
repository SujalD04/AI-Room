'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { Zap, User, Mail, Lock, AlertTriangle, Check, X } from '@/components/Icons';

export default function RegisterPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className={met ? 'met' : ''}>
            {met ? <Check size={10} color="var(--accent-success)" /> : <X size={10} color="var(--text-tertiary)" />}
            <span>{text}</span>
        </div>
    );

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
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join AIRoom and start collaborating with AI</p>

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
                            <label className="form-label" htmlFor="username">
                                <User size={12} style={{ marginRight: '4px' }} /> Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                className="input"
                                placeholder="johndoe"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                                minLength={3}
                                maxLength={30}
                            />
                        </div>
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
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">
                                <Lock size={12} style={{ marginRight: '4px' }} /> Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="Strong password..."
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />

                            {/* Strength bar */}
                            {password.length > 0 && (
                                <>
                                    <div className="password-strength">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div
                                                key={i}
                                                className={`password-strength-bar ${i <= pwScore ? 'filled' : ''} ${pwStrength === 'medium' ? 'medium' : ''} ${pwStrength === 'strong' ? 'strong' : ''}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="password-requirements">
                                        <Requirement met={pwChecks.length} text="At least 8 characters" />
                                        <Requirement met={pwChecks.upper} text="One uppercase letter" />
                                        <Requirement met={pwChecks.lower} text="One lowercase letter" />
                                        <Requirement met={pwChecks.digit} text="One digit" />
                                        <Requirement met={pwChecks.special} text="One special character (!@#$...)" />
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || pwScore < 5}
                            style={{ width: '100%', marginTop: '8px' }}
                        >
                            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account?{' '}
                        <a href="/login" style={{ fontWeight: 600 }}>
                            Sign in
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
