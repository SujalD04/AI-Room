'use client';

import React from 'react';
import { useAuthStore } from '@/stores';

interface UserAvatarProps {
    user: any;
    className?: string;
    style?: React.CSSProperties;
    fallbackClassName?: string;
}

export default function UserAvatar({ user, className = '', style, fallbackClassName = '' }: UserAvatarProps) {
    const { user: authUser } = useAuthStore();

    // If the provided user is the currently logged-in user, use the authStore's avatar
    // because it updates immediately when changed in settings.
    const isCurrentUser = user?.id && authUser?.id === user.id;
    const avatarUrl = isCurrentUser ? authUser?.avatarUrl : user?.avatarUrl;
    const name = isCurrentUser ? authUser?.username : user?.username;

    const initials = name ? name[0].toUpperCase() : '?';

    if (avatarUrl) {
        return <img src={avatarUrl} alt={name || 'User'} className={className} style={style} />;
    }

    return (
        <div className={`${className} ${fallbackClassName}`.trim()} style={style}>
            {initials}
        </div>
    );
}
