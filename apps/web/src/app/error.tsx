'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Home, RotateCcw } from '@/components/Icons';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Runtime Error:', error);
    }, [error]);

    return (
        <div className="error-container">
            <div className="error-content animate-fade-in">
                <div className="icon-badge">
                    <AlertTriangle size={48} color="var(--accent-danger)" strokeWidth={1.5} />
                </div>

                <h2 className="error-title">Something went wrong</h2>
                <p className="error-description">
                    We've encountered an unexpected glitch in the matrix. Our systems are working to recalibrate.
                </p>

                {error.message && (
                    <div className="error-debug">
                        <code>{error.message}</code>
                    </div>
                )}

                <div className="action-group">
                    <button
                        onClick={() => reset()}
                        className="btn btn-primary"
                    >
                        <RotateCcw size={18} style={{ marginRight: '8px' }} />
                        Try Again
                    </button>
                    <a href="/dashboard" className="btn btn-ghost">
                        <Home size={18} style={{ marginRight: '8px' }} />
                        Return Home
                    </a>
                </div>
            </div>

            <style jsx>{`
                .error-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-primary);
                    padding: 24px;
                }

                .error-content {
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
                    background: rgba(var(--accent-danger-rgb), 0.1);
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 32px;
                    border: 1px solid rgba(var(--accent-danger-rgb), 0.2);
                }

                .error-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #fff;
                    margin: 0 0 16px;
                }

                .error-description {
                    font-size: 1rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    margin-bottom: 24px;
                }

                .error-debug {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 12px;
                    border-radius: 12px;
                    margin-bottom: 32px;
                    font-size: 0.8rem;
                    color: var(--accent-danger);
                    text-align: left;
                    font-family: monospace;
                    word-break: break-all;
                    border: 1px solid rgba(var(--accent-danger-rgb), 0.1);
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
                    cursor: pointer;
                    border: none;
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
                    text-decoration: none;
                }

                .btn-ghost:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                }
            `}</style>
        </div>
    );
}
