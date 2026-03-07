'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { Key, Shield, Zap, Lock, CreditCard, ChevronLeft, Sun, Moon, ExternalLink, Check } from '@/components/Icons';

export default function BYOKPage() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="page-container" style={{ background: 'var(--bg-primary)' }}>
            {/* Navbar */}
            <nav style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 32px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <button className="btn btn-ghost" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ChevronLeft size={16} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo.png" alt="AIRoom Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>AIRoom</span>
                </div>

                <button
                    onClick={toggleTheme}
                    className="btn btn-ghost"
                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </nav>

            <main style={{ maxWidth: 800, margin: '0 auto', padding: '64px 24px', animation: 'fadeIn 0.5s ease' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '24px',
                        background: 'var(--accent-primary-glow)',
                        color: 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                        boxShadow: '0 0 30px var(--accent-primary-glow)'
                    }}>
                        <Key size={40} />
                    </div>
                    <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '16px', letterSpacing: '-1px', color: 'var(--text-primary)' }}>
                        Bring Your Own Key
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
                        AIRoom is designed with privacy and cost-efficiency in mind. Using BYOK gives you absolute control over your intelligence layer.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '64px' }}>
                    <div className="card" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                        <Shield size={28} color="var(--accent-success)" style={{ marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Enterprise Grade Security</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Your API keys are immediately encrypted at rest using <strong>AES-256-GCM</strong>.
                            They are only decrypted securely in memory during active LLM generation requests and never logged.
                        </p>
                    </div>

                    <div className="card" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                        <CreditCard size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Pay Provider Prices</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            We don't mark up your LLM usage. By bringing your own API key, you pay exactly what OpenAI, Anthropic, or Groq charges, with no middleman tax.
                        </p>
                    </div>
                </div>

                <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '32px', color: 'var(--text-primary)', textAlign: 'center' }}>How to set it up</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                    {/* Setup Steps */}
                    <div style={{ display: 'flex', gap: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '32px', borderRadius: '24px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
                        <div>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Generate an API Key</h4>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                                Go to your preferred AI provider's dashboard and generate a new secret API key. Do not share this key with anyone.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    OpenAI <ExternalLink size={14} />
                                </a>
                                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Anthropic <ExternalLink size={14} />
                                </a>
                                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Groq <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '32px', borderRadius: '24px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
                        <div>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Add it to AIRoom</h4>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                                Navigate to your AIRoom <strong>Settings</strong> page, find the <strong>API Keys (BYOK)</strong> section, and securely add your key. It will be immediately encrypted.
                            </p>
                            <button onClick={() => router.push('/settings')} className="btn btn-primary">
                                Go to Settings
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '32px', borderRadius: '24px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
                        <div>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Select your Model</h4>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                When creating a new thread inside a Room, simply select the model corresponding to your API key from the dropdown menu.
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '64px', textAlign: 'center', padding: '48px', background: 'var(--bg-tertiary)', borderRadius: '24px' }}>
                    <Lock size={32} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Your data remains yours</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                        We act only as a pass-through layer. Your prompts, context, and completions are sent directly to the providers you configure.
                    </p>
                </div>
            </main>
        </div>
    );
}
