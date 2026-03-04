'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Check, ChevronLeft, Zap, AlertTriangle } from '@/components/Icons';
import { api } from '@/lib/api';

const API_BASE = '/api';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
            setMessage(data.message);
            setStep(2);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            router.push('/login?reset=success');
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
                    <h1 className="auth-title">Reset Password</h1>
                    <p className="auth-subtitle">
                        {step === 1 ? 'Enter your email to receive an OTP' : 'Enter the OTP and your new password'}
                    </p>

                    {error && (
                        <div style={{
                            background: 'rgba(225, 112, 85, 0.15)', color: 'var(--accent-danger)',
                            padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
                            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}
                    {message && step === 1 && (
                        <div style={{
                            background: 'rgba(0, 184, 148, 0.15)', color: 'var(--accent-success)',
                            padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
                            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            <Check size={16} /> {message}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleSendOtp}>
                            <div className="form-group">
                                <label className="form-label">
                                    <Mail size={12} style={{ marginRight: '4px' }} /> Email
                                </label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
                                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Send OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword}>
                            <div className="form-group">
                                <label className="form-label">
                                    <Check size={12} style={{ marginRight: '4px' }} /> 6-Digit OTP
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="123456"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                    maxLength={6}
                                    minLength={6}
                                    autoFocus
                                    style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 600 }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <Lock size={12} style={{ marginRight: '4px' }} /> New Password
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Strong password..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    <Lock size={12} style={{ marginRight: '4px' }} /> Confirm Password
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Confirm password..."
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
                                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Reset Password'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} style={{ width: '100%', marginTop: '8px' }}>
                                Back
                            </button>
                        </form>
                    )}

                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <a href="/login" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ChevronLeft size={14} /> Back to Sign In
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
