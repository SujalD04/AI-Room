'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores';
import { User, Settings, LogOut, ChevronDown, Layout, Zap, Sun, Moon } from './Icons';
import { useTheme } from './ThemeProvider';

export default function NavbarDropdown() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const displayName = user?.nickname || user?.username || 'User';
    const initials = displayName[0]?.toUpperCase() || '?';

    return (
        <div className="navbar-dropdown-container" ref={dropdownRef}>
            <button
                className="navbar-profile-trigger"
                onClick={() => setOpen(!open)}
            >
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={displayName} className="navbar-avatar" />
                ) : (
                    <div className="navbar-avatar navbar-avatar-fallback">
                        {initials}
                    </div>
                )}
                <div className="navbar-profile-info">
                    <span className="navbar-display-name">{displayName}</span>
                    {user?.nickname && user?.username && (
                        <span className="navbar-username">@{user.username}</span>
                    )}
                </div>
                <ChevronDown size={14} className={`navbar-chevron ${open ? 'rotated' : ''}`} />
            </button>

            {open && (
                <div className="navbar-dropdown-menu">
                    <div className="dropdown-header">
                        <div className="dropdown-user-info">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={displayName} className="dropdown-avatar-lg" />
                            ) : (
                                <div className="dropdown-avatar-lg dropdown-avatar-fallback">
                                    {initials}
                                </div>
                            )}
                            <div>
                                <div className="dropdown-display-name">{displayName}</div>
                                <div className="dropdown-email">{user?.email}</div>
                            </div>
                        </div>
                        {user?.bio && (
                            <p className="dropdown-bio">{user.bio}</p>
                        )}
                    </div>

                    <div className="dropdown-divider" />

                    <button
                        className="dropdown-item"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTheme();
                        }}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>

                    <button
                        className="dropdown-item"
                        onClick={() => { setOpen(false); router.push('/dashboard'); }}
                    >
                        <Layout size={16} /> Dashboard
                    </button>
                    <button
                        className="dropdown-item"
                        onClick={() => { setOpen(false); router.push('/settings'); }}
                    >
                        <Settings size={16} /> Settings
                    </button>

                    <div className="dropdown-divider" />

                    <button
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => {
                            setOpen(false);
                            logout();
                            router.push('/');
                        }}
                    >
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}
