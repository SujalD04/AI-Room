const API_BASE = '/api';

/**
 * Typed fetch wrapper with JWT auth.
 */
async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token =
        typeof window !== 'undefined' ? localStorage.getItem('airoom_token') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
}

export const api = {
    // Auth
    register: (data: { username: string; email: string; password: string }) =>
        request<{ user: any; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    login: (data: { email: string; password: string }) =>
        request<{ user: any; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    changePassword: (data: any) =>
        request<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getMe: () => request<{ user: any }>('/auth/me'),

    updateProfile: (data: { nickname?: string | null; bio?: string | null; avatarUrl?: string | null }) =>
        request<{ user: any }>('/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),



    deleteAvatar: () =>
        request<{ user: any; message: string }>('/upload/avatar', {
            method: 'DELETE',
        }),


    // Rooms
    createRoom: (data: { name: string; maxMembers?: number }) =>
        request<{ room: any }>('/rooms', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getRooms: () => request<{ rooms: any[]; totalTokens: number }>('/rooms'),

    getRoom: (slug: string) => request<{ room: any }>(`/rooms/${slug}`),

    joinRoom: (slug: string) =>
        request<{ message: string; roomSlug: string }>(`/rooms/${slug}/join`, {
            method: 'POST',
        }),

    leaveRoom: (slug: string) =>
        request<{ message: string }>(`/rooms/${slug}/leave`, {
            method: 'POST',
        }),

    deleteRoom: (slug: string) =>
        request<{ message: string }>(`/rooms/${slug}`, {
            method: 'DELETE',
        }),

    kickMember: (slug: string, userId: string) =>
        request<{ message: string }>(`/rooms/${slug}/kick/${userId}`, {
            method: 'POST',
        }),

    // API Keys
    addKey: (data: { provider: string; apiKey: string; label?: string }) =>
        request<{ key: any }>('/keys', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getKeys: () => request<{ keys: any[] }>('/keys'),

    deleteKey: (keyId: string) =>
        request<{ message: string }>(`/keys/${keyId}`, {
            method: 'DELETE',
        }),

    // Models
    getModels: () => request<{ models: any }>('/models'),

    // Notes
    createNote: (data: { roomSlug: string; title: string; content?: string; type?: string }) =>
        request<{ note: any }>('/notes', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateNote: (noteId: string, data: any) =>
        request<{ note: any }>(`/notes/${noteId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    deleteNote: (noteId: string) =>
        request<{ message: string }>(`/notes/${noteId}`, {
            method: 'DELETE',
        }),

    // Threads
    createThread: (data: { roomSlug: string; title: string; modelConfig?: any }) =>
        request<{ thread: any }>('/threads', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getThreadMessages: (threadId: string, limit = 50) =>
        request<{ messages: any[] }>(`/threads/${threadId}/messages?limit=${limit}`),

    getThreadTree: (threadId: string) =>
        request<{ nodes: any[]; edges: any[] }>(`/threads/${threadId}/tree`),

    deleteThread: (threadId: string) =>
        request<{ message: string }>(`/threads/${threadId}`, {
            method: 'DELETE',
        }),

    // Upload
    uploadAvatar: async (file: File): Promise<{ user: any; avatarUrl: string }> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('airoom_token') : null;
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch(`${API_BASE}/upload/avatar`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(body.error || `HTTP ${res.status}`);
        }

        return res.json();
    },
};
