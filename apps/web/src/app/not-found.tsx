'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Home, ChevronLeft } from '@/components/Icons';

export default function NotFound() {
    return (
        <div className="not-found-container">
            <div className="not-found-content animate-fade-in">
                <div className="glow-orb" />
                <div className="icon-badge">
                    <Sparkles size={48} color="var(--accent-primary)" strokeWidth={1.5} />
                </div>

                <h1 className="error-code">404</h1>
                <h2 className="error-title">Room Not Found</h2>
                <p className="error-description">
                    The space you're looking for doesn't exist or has been moved to another dimension.
                </p>

                <div className="action-group">
                    <Link href="/dashboard" className="btn btn-primary">
                        <Home size={18} style={{ marginRight: '8px' }} />
                        Back to Dashboard
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="btn btn-ghost"
                    >
                        <ChevronLeft size={18} style={{ marginRight: '8px' }} />
                        Go Back
                    </button>
                </div>
            </div>

            <style jsx>{`
                .not-found-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-primary);
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                }

                .glow-orb {
                    position: absolute;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(var(--accent-primary-rgb), 0.15) 0%, transparent 70%);
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 0;
                    pointer-events: none;
                }

                .not-found-content {
                    position: relative;
                    z-index: 1;
                    max-width: 480px;
                    width: 100%;
                    text-align: center;
                    background: rgba(var(--bg-secondary-rgb), 0.4);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--border-subtle);
                    border-radius: 24px;
                    padding: 48px 32px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
                }

                .icon-badge {
                    width: 96px;
                    height: 96px;
                    background: rgba(var(--accent-primary-rgb), 0.1);
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 32px;
                    border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
                }

                .error-code {
                    font-size: 5rem;
                    font-weight: 900;
                    margin: 0;
                    line-height: 1;
                    background: linear-gradient(to bottom, #fff, rgba(255, 255, 255, 0.4));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: -0.05em;
                }

                .error-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #fff;
                    margin: 12px 0 16px;
                }

                .error-description {
                    font-size: 1rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    margin-bottom: 32px;
                }

                .action-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                @media (min-width: 640px) {
                    .action-group {
                        flex-direction: row;
                        justify-content: center;
                    }
                }

                .btn {
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: var(--accent-primary);
                    color: white;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(var(--accent-primary-rgb), 0.3);
                }

                .btn-ghost {
                    background: transparent;
                    border: 1px solid var(--border-subtle);
                    color: var(--text-secondary);
                }

                .btn-ghost:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                }
            `}</style>
        </div>
    );
}
