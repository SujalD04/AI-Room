import { create } from 'zustand';
import type { User, Room, RoomMember, ConversationThread, MessageNode, Note } from '@airoom/shared';

// ─── Auth Store ───
interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    updateUser: (updates: Partial<User>) => void;
    logout: () => void;
    loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,

    setAuth: (user, token) => {
        localStorage.setItem('airoom_token', token);
        localStorage.setItem('airoom_user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true });
    },

    updateUser: (updates) => set((s) => {
        if (!s.user) return s;
        const newUser = { ...s.user, ...updates };
        localStorage.setItem('airoom_user', JSON.stringify(newUser));
        return { user: newUser };
    }),

    logout: () => {
        localStorage.removeItem('airoom_token');
        localStorage.removeItem('airoom_user');
        set({ user: null, token: null, isAuthenticated: false });
    },

    loadFromStorage: () => {
        const token = localStorage.getItem('airoom_token');
        const userStr = localStorage.getItem('airoom_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token, isAuthenticated: true });
            } catch {
                localStorage.removeItem('airoom_token');
                localStorage.removeItem('airoom_user');
            }
        }
    },
}));

// ─── Room Store ───
interface RoomState {
    currentRoom: Room | null;
    members: RoomMember[];
    threads: ConversationThread[];
    onlineUserIds: string[];
    typingUsers: Map<string, string>; // userId -> username

    setRoom: (room: Room) => void;
    setMembers: (members: RoomMember[]) => void;
    addMember: (member: RoomMember) => void;
    removeMember: (userId: string) => void;
    setThreads: (threads: ConversationThread[]) => void;
    addThread: (thread: ConversationThread) => void;
    removeThread: (threadId: string) => void;
    setOnlineUsers: (ids: string[]) => void;
    setTypingUser: (userId: string, username: string, isTyping: boolean) => void;
    clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
    currentRoom: null,
    members: [],
    threads: [],
    onlineUserIds: [],
    typingUsers: new Map(),

    setRoom: (room) => set({ currentRoom: room }),
    setMembers: (members) => set({ members }),
    addMember: (member) => set((s) => ({
        members: s.members.some((m) => m.userId === member.userId)
            ? s.members
            : [...s.members, member],
    })),
    removeMember: (userId) => set((s) => ({
        members: s.members.filter((m) => m.userId !== userId),
    })),
    setThreads: (threads) => set({ threads }),
    addThread: (thread) => set((s) => {
        if (s.threads.some(t => t.id === thread.id)) return s; // dedup
        return { threads: [thread, ...s.threads] };
    }),
    removeThread: (threadId) => set((s) => ({
        threads: s.threads.filter((t) => t.id !== threadId),
    })),
    setOnlineUsers: (ids) => set({ onlineUserIds: ids }),
    setTypingUser: (userId, username, isTyping) =>
        set((s) => {
            const next = new Map(s.typingUsers);
            if (isTyping) next.set(userId, username);
            else next.delete(userId);
            return { typingUsers: next };
        }),
    clearRoom: () =>
        set({
            currentRoom: null,
            members: [],
            threads: [],
            onlineUserIds: [],
            typingUsers: new Map(),
        }),
}));

// ─── Chat Store ───
interface ChatState {
    activeThreadId: string | null;
    messages: MessageNode[];
    activeLeafId: string | null;
    isAiResponding: boolean;

    setActiveThread: (threadId: string) => void;
    setMessages: (messages: MessageNode[]) => void;
    prependMessages: (messages: MessageNode[]) => void;
    addMessage: (message: MessageNode) => void;
    setActiveLeaf: (messageId: string) => void;
    appendStreamToken: (messageId: string, token: string) => void;
    clearStreamingMessage: (messageId: string) => void;
    setAiResponding: (isResponding: boolean) => void;
    clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    activeThreadId: null,
    messages: [],
    activeLeafId: null,
    isAiResponding: false,

    setActiveThread: (threadId) => set({ activeThreadId: threadId, messages: [], activeLeafId: null }),
    setMessages: (messages) => set({
        messages,
        activeLeafId: messages.length > 0 ? messages[messages.length - 1].id : null
    }),
    prependMessages: (newMessages) => set((s) => {
        const existingIds = new Set(s.messages.map(m => m.id));
        const filtered = newMessages.filter(m => !existingIds.has(m.id));
        return { messages: [...filtered, ...s.messages] };
    }),
    addMessage: (message) =>
        set((s) => {
            const exists = s.messages.findIndex((m) => m.id === message.id);
            if (exists >= 0) {
                const next = [...s.messages];
                next[exists] = message;
                return { messages: next };
            }
            return {
                messages: [...s.messages, message],
                activeLeafId: message.id
            };
        }),
    setActiveLeaf: (messageId) => set({ activeLeafId: messageId }),
    appendStreamToken: (messageId, token) =>
        set((s) => {
            const exists = s.messages.findIndex((m) => m.id === messageId);
            if (exists >= 0) {
                const next = [...s.messages];
                next[exists] = { ...next[exists], content: next[exists].content + token };
                return { messages: next };
            }
            return s;
        }),
    clearStreamingMessage: (messageId) => set((s) => s),
    setAiResponding: (isResponding) => set({ isAiResponding: isResponding }),
    clearChat: () =>
        set({
            activeThreadId: null,
            messages: [],
            isAiResponding: false,
        }),
}));

// ─── Notes Store ───
interface NotesState {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    addOrUpdateNote: (note: Note) => void;
    removeNote: (noteId: string) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
    notes: [],
    setNotes: (notes) => set({ notes }),
    addOrUpdateNote: (note) =>
        set((s) => {
            const idx = s.notes.findIndex((n) => n.id === note.id);
            if (idx >= 0) {
                const next = [...s.notes];
                next[idx] = note;
                return { notes: next };
            }
            return { notes: [note, ...s.notes] };
        }),
    removeNote: (noteId) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),
}));
