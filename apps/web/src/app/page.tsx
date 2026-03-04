'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import {
    Users, Bot, Sparkles, GitBranch, Shield, StickyNote, Zap, ChevronRight,
    Check, Globe, Crown, MessageSquare, Lock, Monitor
} from '@/components/Icons';

const FEATURES = [
    {
        icon: Users,
        title: 'Multiplayer Rooms',
        desc: 'Create isolated project rooms with up to 10 members. Share an invite link and collaborate instantly.',
        color: 'var(--accent-primary)',
    },
    {
        icon: Bot,
        title: 'Multi-LLM Support',
        desc: '7 providers, dozens of models. GPT-4o, Claude, Gemini, Llama, and more — all in one workspace.',
        color: 'var(--accent-secondary)',
    },
    {
        icon: Sparkles,
        title: 'AI Council',
        desc: 'Query multiple AI models at once. They debate, synthesize, and reach consensus to reduce hallucinations.',
        color: 'var(--accent-tertiary)',
    },
    {
        icon: GitBranch,
        title: 'Branching Conversations',
        desc: 'Git-style DAG chat history. Branch from any message to explore ideas without polluting context.',
        color: 'var(--accent-success)',
    },
    {
        icon: Shield,
        title: 'Bring Your Own Key',
        desc: 'Your API keys, encrypted at rest with AES-256-GCM. Or use free models on OpenRouter and Groq.',
        color: 'var(--accent-warning)',
    },
    {
        icon: StickyNote,
        title: 'Shared Notes & Todos',
        desc: 'Collaborative notes and to-do lists inside each room. Keep your research organized in one place.',
        color: 'var(--accent-danger)',
    },
];

const STATS = [
    { number: '7+', label: 'AI Providers' },
    { number: '10', label: 'Max Members/Room' },
    { number: '256', label: 'Bit Encryption' },
    { number: '∞', label: 'Conversations' },
];

const STEPS = [
    { title: 'Create a Room', desc: 'Set up an AI workspace in seconds. Name it, configure it, and get a shareable invite link.' },
    { title: 'Invite Your Team', desc: 'Share the invite link. Team members join instantly and see all conversations in real-time.' },
    { title: 'Collaborate with AI', desc: 'Chat with multiple LLMs, branch conversations, take notes, and build together — all in one place.' },
];

const TESTIMONIALS = [
    {
        text: 'AIRoom changed how our team does AI research. Having everyone in the same conversation with multiple models is a game-changer.',
        name: 'Alex Chen',
        role: 'AI Research Lead',
        initials: 'AC',
    },
    {
        text: 'The branching feature alone is worth it. We can explore 5 different approaches simultaneously without losing context.',
        name: 'Sarah Kim',
        role: 'Senior Engineer',
        initials: 'SK',
    },
    {
        text: 'AI Council is brilliant — getting consensus from Claude, GPT-4, and Gemini on complex problems reduces hallucination dramatically.',
        name: 'Marco Rossi',
        role: 'CTO, TechCore',
        initials: 'MR',
    },
];

const PRICING = [
    {
        name: 'Free',
        price: '$0',
        period: 'forever',
        features: ['Up to 3 rooms', '5 members per room', 'Free model access', 'Basic notes', 'Community support'],
        featured: false,
    },
    {
        name: 'Pro',
        price: '$19',
        period: '/month',
        features: ['Unlimited rooms', '10 members per room', 'All AI providers', 'AI Council', 'Branching conversations', 'Priority support'],
        featured: true,
    },
    {
        name: 'Team',
        price: '$49',
        period: '/month',
        features: ['Everything in Pro', 'Shared API key pools', 'Admin dashboard', 'Usage analytics', 'SSO & SAML', 'Dedicated support'],
        featured: false,
    },
];

export default function LandingPage() {
    const router = useRouter();
    const { isAuthenticated, loadFromStorage } = useAuthStore();
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadFromStorage();
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (loaded && isAuthenticated) {
            router.push('/dashboard');
        }
    }, [loaded, isAuthenticated]);

    return (
        <div className="page-container" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Background orbs */}
            <div className="hero-gradient-orb hero-gradient-orb-1" />
            <div className="hero-gradient-orb hero-gradient-orb-2" />
            <div className="hero-gradient-orb hero-gradient-orb-3" />

            {/* ─── Navbar ─── */}
            <nav
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 32px',
                    position: 'relative',
                    zIndex: 10,
                }}
            >
                <a href="/" className="logo">
                    <div className="logo-icon">
                        <Zap size={18} />
                    </div>
                    <span className="logo-text" style={{ fontSize: '1.3rem' }}>AIRoom</span>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <a href="#features" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</a>
                    <a href="#how-it-works" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>How It Works</a>
                    {/*<a href="#pricing" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Pricing</a>*/}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" onClick={() => router.push('/login')}>
                            Log In
                        </button>
                        <button className="btn btn-primary" onClick={() => router.push('/register')}>
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ─── */}
            <main
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '80px 24px 40px',
                    position: 'relative',
                    zIndex: 10,
                }}
            >
                <div className="animate-fade-in">
                    <div className="badge badge-primary" style={{ marginBottom: '24px', fontSize: '0.75rem' }}>
                        <Sparkles size={14} /> Multiplayer AI Workspace
                    </div>

                    <h1
                        style={{
                            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            marginBottom: '24px',
                            maxWidth: '800px',
                        }}
                    >
                        Think Together.{' '}
                        <span
                            style={{
                                background: 'var(--gradient-accent)',
                                backgroundSize: '200% 200%',
                                animation: 'gradientShift 5s ease infinite',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Build Smarter.
                        </span>
                    </h1>

                    <p
                        style={{
                            fontSize: '1.15rem',
                            color: 'var(--text-secondary)',
                            maxWidth: '800px',
                            marginBottom: '40px',
                            lineHeight: 1.7,
                        }}
                    >
                        Create AI-powered rooms where your team collaborates with multiple LLMs in real-time.
                        Branch conversations, run AI councils, and eliminate hallucinations together.
                    </p>

                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => router.push('/register')}
                            style={{ fontSize: '1rem', padding: '14px 32px' }}
                        >
                            <Zap size={18} /> Start Free — No Card Required
                        </button>
                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => {
                                const el = document.getElementById('features');
                                el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            style={{ fontSize: '1rem', padding: '14px 32px' }}
                        >
                            See Features <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </main>

            {/* ─── Stats ─── */}
            <section className="landing-section" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
                <div className="landing-section-inner">
                    <div className="stats-grid">
                        {STATS.map((stat, i) => (
                            <div key={i} className="stat-card card glass">
                                <div className="stat-number">{stat.number}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Features ─── */}
            <section id="features" className="landing-section">
                <div className="landing-section-inner">
                    <div className="section-label"><Sparkles size={14} /> Features</div>
                    <h2 className="section-title">Everything You Need to Collaborate with AI</h2>
                    <p className="section-desc">
                        A complete toolkit for teams that think with AI. From branching conversations to multi-model councils,
                        every feature is designed for real collaborative intelligence.
                    </p>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '24px',
                        }}
                    >
                        {FEATURES.map((feature, i) => {
                            const IconComp = feature.icon;
                            return (
                                <div
                                    key={i}
                                    className="card glass"
                                    style={{ textAlign: 'left', animationDelay: `${i * 0.1}s` }}
                                >
                                    <div
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 'var(--radius-md)',
                                            background: `${feature.color}15`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '16px',
                                            color: feature.color,
                                        }}
                                    >
                                        <IconComp size={24} />
                                    </div>
                                    <h3 style={{ fontWeight: 700, marginBottom: '8px', fontSize: '1.05rem' }}>{feature.title}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        {feature.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section id="how-it-works" className="landing-section" style={{ background: 'var(--bg-secondary)' }}>
                <div className="landing-section-inner">
                    <div className="section-label"><Globe size={14} /> How It Works</div>
                    <h2 className="section-title">Up and Running in 60 Seconds</h2>
                    <p className="section-desc">
                        No complex setup, no config files. Create a room, invite your team, and start collaborating with AI instantly.
                    </p>

                    <div className="steps-grid">
                        {STEPS.map((step, i) => (
                            <div key={i} className="step-card card glass">
                                <div className="step-number">{i + 1}</div>
                                <h3 className="step-title">{step.title}</h3>
                                <p className="step-desc">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Testimonials ─── */}
            {/*<section className="landing-section">
                <div className="landing-section-inner">
                    <div className="section-label"><MessageSquare size={14} /> Trusted By Teams</div>
                    <h2 className="section-title">What People Are Saying</h2>
                    <p className="section-desc">
                        Teams around the world use AIRoom to supercharge their AI workflows.
                    </p>

                    <div className="testimonials-grid">
                        {TESTIMONIALS.map((t, i) => (
                            <div key={i} className="testimonial-card">
                                <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
                                <div className="testimonial-author">
                                    <div className="testimonial-avatar">{t.initials}</div>
                                    <div>
                                        <div className="testimonial-name">{t.name}</div>
                                        <div className="testimonial-role">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>*/}

            {/* ─── Pricing ─── */}
            {/*<section id="pricing" className="landing-section" style={{ background: 'var(--bg-secondary)' }}>
                <div className="landing-section-inner">
                    <div className="section-label"><Crown size={14} /> Pricing</div>
                    <h2 className="section-title">Simple, Transparent Pricing</h2>
                    <p className="section-desc">
                        Start free, upgrade when you need more. All plans include the core collaborative AI experience.
                    </p>

                    <div className="pricing-grid">
                        {PRICING.map((plan, i) => (
                            <div key={i} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
                                <div className="pricing-name">{plan.name}</div>
                                <div className="pricing-price">{plan.price}</div>
                                <div className="pricing-period">{plan.period}</div>
                                <ul className="pricing-features">
                                    {plan.features.map((f, j) => (
                                        <li key={j}>
                                            <Check size={16} color="var(--accent-success)" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ width: '100%' }}
                                    onClick={() => router.push('/register')}
                                >
                                    {plan.price === '$0' ? 'Get Started' : 'Start Free Trial'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>*/}

            {/* ─── CTA Band ─── */}
            <div className="cta-band">
                <h2 className="cta-title">Ready to Think Together?</h2>
                <p className="cta-desc">Join teams already collaborating with AI in real-time. Free forever to get started.</p>
                <button className="cta-btn" onClick={() => router.push('/register')}>
                    Create Your Free Account
                </button>
            </div>

            {/* ─── Footer ─── */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="footer-brand">
                        <a href="/" className="logo">
                            <div className="logo-icon">
                                <Zap size={18} />
                            </div>
                            <span className="logo-text" style={{ fontSize: '1.2rem' }}>AIRoom</span>
                        </a>
                        <p>Real-time collaborative AI workspace for teams. Branch conversations, run AI councils, and build smarter — together.</p>
                    </div>
                    <div className="footer-column">
                        <h4>Product</h4>
                        <a href="#features">Features</a>
                        <a href="#pricing">Pricing</a>
                        <a href="#how-it-works">How It Works</a>
                    </div>
                    <div className="footer-column">
                        <h4>Resources</h4>
                        <a href="#">Documentation</a>
                        <a href="#">API Reference</a>
                        <a href="#">Changelog</a>
                    </div>
                    <div className="footer-column">
                        <h4>Company</h4>
                        <a href="#">About</a>
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                    </div>
                </div>
            </footer>
            <div className="footer-bottom">
                AIRoom © {new Date().getFullYear()} — Built for collaborative intelligence
            </div>
        </div>
    );
}
