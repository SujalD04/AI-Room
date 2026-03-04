import './globals.css';
import { Metadata } from 'next';
import ClientProviders from './providers';

export const metadata: Metadata = {
    title: 'AIRoom — Multiplayer AI Workspace',
    description:
        'Real-time collaborative AI workspace. Create rooms, invite your team, and work with multiple LLMs simultaneously.',
    keywords: ['AI', 'workspace', 'multiplayer', 'LLM', 'collaboration', 'real-time'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <ClientProviders>{children}</ClientProviders>
            </body>
        </html>
    );
}

