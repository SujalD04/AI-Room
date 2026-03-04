'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore, useRoomStore, useChatStore, useNotesStore } from '@/stores';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import MediaControls from '@/components/MediaControls';
import {
    ChevronLeft, Zap, Users, Crown, Settings, Link2, Copy, Plus, Trash2,
    MessageSquare, Send, Bot, GitBranch, Hash, StickyNote, Pin, Edit, X,
    Mic, MicOff, FileText, Check, Sparkles, Globe, Search, Shield, Key,
    ChevronRight, ChevronDown
} from '@/components/Icons';
import VoiceChannel from '@/components/VoiceChannel';
import type { MessageNode, ConversationThread, RoomMember } from '@airoom/shared';

// Provider metadata for the model selector
const PROVIDER_META: Record<string, { name: string; icon: any; color: string }> = {
    openrouter: { name: 'OpenRouter', icon: Globe, color: 'var(--accent-primary)' },
    groq: { name: 'Groq', icon: Zap, color: '#f55036' },
    gemini: { name: 'Gemini', icon: Sparkles, color: '#4285f4' },
    openai: { name: 'OpenAI', icon: Bot, color: '#10a37f' },
    anthropic: { name: 'Anthropic', icon: Shield, color: '#d4a27f' },
    deepseek: { name: 'DeepSeek', icon: Search, color: '#2563eb' },
    together: { name: 'Together', icon: Sparkles, color: '#6366f1' },
};

// ─── Recursive Branch Tree View ───
interface MessageTreeNode {
    msg: MessageNode;
    children: MessageTreeNode[];
}

const buildMessageTree = (messages: MessageNode[]) => {
    const map = new Map<string, MessageTreeNode>();
    const roots: MessageTreeNode[] = [];

    messages.forEach(msg => {
        map.set(msg.id, { msg, children: [] });
    });

    messages.forEach(msg => {
        const node = map.get(msg.id)!;
        if (msg.parentId && map.has(msg.parentId)) {
            map.get(msg.parentId)!.children.push(node);
        } else if (!msg.parentId) {
            roots.push(node);
        }
    });

    return roots;
};

const BranchNode = ({
    node,
    level = 0,
    activeLeafId,
    onSelect,
    lineageIds = new Set<string>()
}: {
    node: MessageTreeNode;
    level?: number;
    activeLeafId: string | null;
    onSelect: (id: string) => void;
    lineageIds?: Set<string>;
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children.length > 0;
    const isActive = activeLeafId === node.msg.id;
    const isLineage = lineageIds.has(node.msg.id);

    // Find the child that continues the current active lineage
    const lineageChild = node.children.find(c => lineageIds.has(c.msg.id));
    const otherChildren = node.children.filter(c => c !== lineageChild);

    // If we're in the lineage, we don't indent this specific node container relative to its parent container
    // unless the parent specifically indents its children.
    const indentStyle = !isLineage ? { marginLeft: '12px' } : {};

    return (
        <div style={{ ...indentStyle, marginBottom: '2px' }}>
            <div
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                style={{ height: 'auto', padding: '6px 8px', borderRadius: '8px' }}
                onClick={() => onSelect(node.msg.id)}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        width: '100%',
                        overflow: 'hidden'
                    }}
                >
                    {hasChildren ? (
                        <button
                            className="btn-icon-ghost"
                            style={{ width: 16, height: 16, padding: 0 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    ) : (
                        <div style={{ width: 16 }} />
                    )}

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {node.msg.authorType === 'AI' ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <Bot size={10} /> AI
                                    </span>
                                ) : (
                                    node.msg.authorName || 'User'
                                )}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                                {new Date(node.msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-primary)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {node.msg.content}
                        </p>
                    </div>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div>
                    {/* Render other branches (forks) indented with a line */}
                    {otherChildren.length > 0 && (
                        <div style={{ borderLeft: '1px solid var(--border-subtle)', marginLeft: '7px', marginTop: '4px', paddingLeft: '4px' }}>
                            {otherChildren.map(child => (
                                <BranchNode
                                    key={child.msg.id}
                                    node={child}
                                    level={level + 1}
                                    activeLeafId={activeLeafId}
                                    onSelect={onSelect}
                                    lineageIds={lineageIds}
                                />
                            ))}
                        </div>
                    )}

                    {/* Render lineage continuation flat (no extra margin or line) */}
                    {lineageChild && (
                        <BranchNode
                            node={lineageChild}
                            level={level} // keep level same for lineage
                            activeLeafId={activeLeafId}
                            onSelect={onSelect}
                            lineageIds={lineageIds}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default function RoomPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const { user, isAuthenticated, loadFromStorage } = useAuthStore();
    const roomStore = useRoomStore();
    const chatStore = useChatStore();
    const notesStore = useNotesStore();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [requestAi, setRequestAi] = useState(true);
    const [activePanel, setActivePanel] = useState<'members' | 'notes' | 'branches'>('branches');
    const [deleteThreadTarget, setDeleteThreadTarget] = useState<string | null>(null);
    const [deleteNoteTarget, setDeleteNoteTarget] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<any>(null);
    const [editNoteTitle, setEditNoteTitle] = useState('');
    const [editNoteContent, setEditNoteContent] = useState('');

    // Model selection for thread creation
    const [modelCatalog, setModelCatalog] = useState<any>({});
    const [selectedProvider, setSelectedProvider] = useState('openrouter');
    const [selectedModel, setSelectedModel] = useState('google/gemini-2.0-flash-exp:free');

    // Branch inline UI
    const [branchingMessageId, setBranchingMessageId] = useState<string | null>(null);
    const [branchInput, setBranchInput] = useState('');

    // Resizable sidebar widths
    const [leftWidth, setLeftWidth] = useState(200);
    const [rightWidth, setRightWidth] = useState(260);
    const resizingRef = useRef<'left' | 'right' | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ─── Init ───
    useEffect(() => {
        loadFromStorage();
        api.getModels().then(({ models }) => setModelCatalog(models)).catch(() => { });
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        const socket = getSocket();

        socket.emit('room:join', { roomSlug: slug }, (response) => {
            if (response.success) {
                roomStore.setRoom(response.room!);
                roomStore.setMembers(response.members || []);
                roomStore.setThreads(response.threads || []);
                notesStore.setNotes(response.notes || []);

                if (response.threads && response.threads.length > 0) {
                    chatStore.setActiveThread(response.threads[0].id);
                    loadThreadMessages(response.threads[0].id);
                }
            } else {
                toast.error(response.error || 'Failed to join room');
                router.push('/dashboard');
            }
            setLoading(false);
        });

        socket.on('room:member_joined', (member) => roomStore.addMember(member));
        socket.on('room:member_left', ({ userId }) => roomStore.removeMember(userId));
        socket.on('room:presence', (data) => roomStore.setOnlineUsers(data.onlineUserIds));
        socket.on('room:typing', ({ userId, username, isTyping }) => roomStore.setTypingUser(userId, username, isTyping));
        socket.on('chat:message', (message) => chatStore.addMessage(message));
        socket.on('chat:stream_start', ({ messageId }) => {
            chatStore.setAiResponding(true);
            chatStore.appendStreamToken(messageId, '');
        });
        socket.on('chat:stream_token', ({ messageId, token }) => chatStore.appendStreamToken(messageId, token));
        socket.on('chat:stream_end', ({ messageId }) => {
            chatStore.clearStreamingMessage(messageId);
            chatStore.setAiResponding(false);
        });
        socket.on('chat:stream_error', ({ messageId, error }) => {
            chatStore.clearStreamingMessage(messageId);
            chatStore.setAiResponding(false);
            toast.error(error || 'AI response failed');
        });
        socket.on('notes:updated', (note) => notesStore.addOrUpdateNote(note));
        socket.on('notes:deleted', ({ noteId }) => notesStore.removeNote(noteId));
        socket.on('room:thread_created', ({ thread }) => roomStore.addThread(thread));
        socket.on('room:thread_deleted', ({ threadId }) => {
            roomStore.removeThread(threadId);
            if (chatStore.activeThreadId === threadId) {
                chatStore.clearChat();
                toast.info('This thread has been deleted');
            }
        });

        return () => {
            socket.emit('room:leave');
            socket.off('room:member_joined');
            socket.off('room:member_left');
            socket.off('room:presence');
            socket.off('room:typing');
            socket.off('chat:message');
            socket.off('chat:stream_start');
            socket.off('chat:stream_token');
            socket.off('chat:stream_end');
            socket.off('chat:stream_error');
            socket.off('notes:updated');
            socket.off('notes:deleted');
            socket.off('room:thread_created');
            socket.off('room:thread_deleted');
            roomStore.clearRoom();
            chatStore.clearChat();
        };
    }, [isAuthenticated, slug]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatStore.messages, chatStore.streamingMessages, chatStore.activeLeafId]);

    // ─── Branching Helpers ───
    const getActiveLineage = useCallback(() => {
        const leafId = chatStore.activeLeafId;
        if (!leafId) return chatStore.messages;

        const path: MessageNode[] = [];
        let currentId: string | null = leafId;
        const allMsgs = chatStore.messages;

        while (currentId) {
            const msg = allMsgs.find(m => m.id === currentId);
            if (!msg) break;
            path.unshift(msg);
            currentId = msg.parentId;
        }
        return path;
    }, [chatStore.messages, chatStore.activeLeafId]);

    const handleSwitchBranch = (currentMsg: MessageNode, direction: number) => {
        const siblings = chatStore.messages.filter(m => m.parentId === currentMsg.parentId);
        const currentIndex = siblings.findIndex(m => m.id === currentMsg.id);
        const nextIndex = (currentIndex + direction + siblings.length) % siblings.length;
        const nextLeafId = findDeepestLeaf(siblings[nextIndex].id, chatStore.messages);
        chatStore.setActiveLeaf(nextLeafId);
    };

    const findDeepestLeaf = (msgId: string, messages: MessageNode[]): string => {
        const children = messages.filter(m => m.parentId === msgId);
        if (children.length === 0) return msgId;
        // Prefer original path (first child) or just deepest one
        return findDeepestLeaf(children[0].id, messages);
    };

    // ─── Resizable sidebar handlers ───
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingRef.current === 'left') {
                setLeftWidth(Math.max(140, Math.min(400, e.clientX)));
            } else if (resizingRef.current === 'right') {
                setRightWidth(Math.max(200, Math.min(450, window.innerWidth - e.clientX)));
            }
        };
        const handleMouseUp = () => {
            resizingRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startResize = (side: 'left' | 'right') => {
        resizingRef.current = side;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const loadThreadMessages = async (threadId: string) => {
        chatStore.setActiveThread(threadId);
        chatStore.setMessages([]);
        try {
            const { messages } = await api.getThreadMessages(threadId);
            chatStore.setMessages(messages);
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };

    // ─── Send Message ───
    const handleSend = useCallback(() => {
        const content = messageInput.trim();
        if (!content || !chatStore.activeThreadId) return;

        const socket = getSocket();
        const messages = chatStore.messages;
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        socket.emit(
            'chat:send_message',
            {
                threadId: chatStore.activeThreadId,
                parentId: chatStore.activeLeafId || null,
                content,
                requestAiResponse: requestAi,
            },
            (response) => {
                if (!response.success) {
                    toast.error(response.error || 'Failed to send message');
                }
            }
        );

        setMessageInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [messageInput, chatStore.activeThreadId, chatStore.messages, requestAi]);

    // ─── Branch (inline, no prompt) ───
    const handleBranchSubmit = (messageId: string) => {
        if (!branchInput.trim() || !chatStore.activeThreadId) return;
        const socket = getSocket();
        socket.emit('chat:branch_message', {
            threadId: chatStore.activeThreadId,
            branchFromMessageId: messageId,
            content: branchInput.trim(),
            branchLabel: 'Branch',
        }, (response) => {
            if (!response.success) toast.error(response.error || 'Branch failed');
            else toast.success('Branch created!');
        });
        setBranchingMessageId(null);
        setBranchInput('');
    };

    // ─── Create Thread (with model) ───
    const handleCreateThread = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newThreadTitle.trim()) return;
        try {
            const { thread } = await api.createThread({
                roomSlug: slug,
                title: newThreadTitle.trim(),
                modelConfig: {
                    modelId: selectedModel,
                    provider: selectedProvider,
                },
            });
            roomStore.addThread(thread);
            chatStore.setActiveThread(thread.id);
            chatStore.setMessages([]);
            setShowNewThreadModal(false);
            setNewThreadTitle('');
            toast.success('Thread created!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to create thread');
        }
    };

    // ─── Delete Thread ───
    const handleDeleteThread = async () => {
        if (!deleteThreadTarget) return;
        try {
            await api.deleteThread(deleteThreadTarget);
            roomStore.removeThread(deleteThreadTarget);
            if (chatStore.activeThreadId === deleteThreadTarget) {
                chatStore.clearChat();
            }
            toast.success('Thread deleted');
            setDeleteThreadTarget(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete thread');
        }
    };

    // ─── Note CRUD (fixed) ───
    const handleCreateNote = async () => {
        if (!newNoteTitle.trim()) return;
        try {
            const { note } = await api.createNote({
                roomSlug: slug,
                title: newNoteTitle.trim(),
                content: newNoteContent.trim() || '',
            });
            notesStore.addOrUpdateNote(note);
            setShowNoteModal(false);
            setNewNoteTitle('');
            setNewNoteContent('');
            toast.success('Note created');
        } catch (err: any) {
            toast.error(err.message || 'Failed to create note');
        }
    };

    const handleDeleteNote = async () => {
        if (!deleteNoteTarget) return;
        try {
            await api.deleteNote(deleteNoteTarget);
            notesStore.removeNote(deleteNoteTarget);
            toast.success('Note deleted');
            setDeleteNoteTarget(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete note');
        }
    };

    const handleSaveNote = async () => {
        if (!editingNote) return;
        try {
            const { note } = await api.updateNote(editingNote.id, {
                title: editNoteTitle,
                content: editNoteContent,
            });
            notesStore.addOrUpdateNote(note);
            toast.success('Note saved');
            setEditingNote(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to save note');
        }
    };

    // ─── Keyboard ───
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (value: string) => {
        setMessageInput(value);
        const socket = getSocket();
        socket.emit('room:typing', { isTyping: value.length > 0 });
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
        }
    };

    const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${slug}` : '';
    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success('Invite link copied!');
    };

    // Helper: extract note content text
    const getNoteText = (note: any): string => {
        if (typeof note.content === 'string') return note.content;
        if (typeof note.content === 'object' && note.content?.text) return note.content.text;
        return '';
    };

    // Helper: get thread model display name
    const getThreadModel = (thread: ConversationThread): string => {
        const mc = thread.modelConfig as any;
        if (!mc?.modelId) return 'No model';
        const id = mc.modelId as string;
        return id.includes('/') ? id.split('/').pop()! : id;
    };

    if (loading) {
        return (
            <div className="loading-page">
                <span className="spinner" style={{ width: 40, height: 40 }} />
                <p style={{ color: 'var(--text-secondary)' }}>Connecting to room...</p>
            </div>
        );
    }

    const isHost = roomStore.currentRoom?.hostId === user?.id;
    const typingUsersArr = Array.from(roomStore.typingUsers.entries()).filter(([uid]) => uid !== user?.id);
    const activeThread = roomStore.threads.find(t => t.id === chatStore.activeThreadId);

    // Available models for the selected provider
    const providerModels = modelCatalog[selectedProvider] || [];

    const getTypingText = () => {
        const names = typingUsersArr.map(([, name]) => name);
        if (names.length === 0) return '';
        if (names.length === 1) return `${names[0]} is typing...`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
        if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing...`;
        return 'Multiple people are typing...';
    };

    return (
        <div className="room-layout">
            {/* ── Header ── */}
            <header className="room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn-icon-ghost" onClick={() => router.push('/dashboard')}>
                        <ChevronLeft size={20} />
                    </button>
                    <a href="/dashboard" className="logo">
                        <div className="logo-icon" style={{ width: 28, height: 28 }}>
                            <Zap size={14} />
                        </div>
                    </a>
                    <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>
                        {roomStore.currentRoom?.name || 'Room'}
                    </h1>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                        {roomStore.onlineUserIds.length} online
                    </span>
                    {activeThread && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.6rem', gap: '3px' }}>
                            <Bot size={10} /> {getThreadModel(activeThread)}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowInviteModal(true)}>
                        <Link2 size={14} /> Invite
                    </button>
                    <button className="btn-icon-ghost" onClick={() => router.push('/settings')}>
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            <div className="room-body">
                {/* ── Left Sidebar (threads + members) ── */}
                <aside className="room-sidebar" style={{ width: leftWidth, minWidth: 140 }}>
                    {/* Threads */}
                    <div className="sidebar-section" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="sidebar-section-title">
                                <Hash size={12} style={{ marginRight: '4px' }} />
                                Threads
                            </span>
                            <button className="btn-icon-ghost" style={{ width: 24, height: 24 }} onClick={() => setShowNewThreadModal(true)}>
                                <Plus size={16} />
                            </button>
                        </div>
                        {roomStore.threads.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '8px' }}>
                                No threads yet. Create one to start.
                            </p>
                        ) : (
                            roomStore.threads.map((thread) => {
                                // Role-based: thread creator can delete own, host can delete any
                                const canDelete = isHost; // TODO: track creatorId on thread for member self-delete
                                return (
                                    <div
                                        key={thread.id}
                                        className={`sidebar-item ${chatStore.activeThreadId === thread.id ? 'active' : ''}`}
                                        onClick={() => {
                                            chatStore.setActiveThread(thread.id);
                                            loadThreadMessages(thread.id);
                                        }}
                                    >
                                        <MessageSquare size={14} />
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {thread.title}
                                        </span>
                                        {canDelete && (
                                            <div className="sidebar-item-actions">
                                                <button
                                                    className="sidebar-action-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteThreadTarget(thread.id);
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Members */}
                    <div className="sidebar-section" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <span className="sidebar-section-title">
                            <Users size={12} style={{ marginRight: '4px' }} />
                            Members ({roomStore.members.length})
                        </span>
                        {roomStore.members.map((member) => (
                            <div key={member.id} className="member-item">
                                <div className="member-avatar">
                                    {member.user.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="member-info">
                                    <div className="member-name">
                                        {member.user.username}
                                        {member.role === 'HOST' && (
                                            <Crown size={12} color="var(--accent-warning)" style={{ marginLeft: '6px' }} />
                                        )}
                                    </div>
                                </div>
                                <div className={`online-dot ${roomStore.onlineUserIds.includes(member.userId) ? 'online' : 'offline'}`} />
                            </div>
                        ))}
                    </div>

                    {/* Voice Channel */}
                    <div className="sidebar-section" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <VoiceChannel roomId={roomStore.currentRoom?.id || ''} userId={user?.id || ''} />
                    </div>
                </aside>

                {/* ── Left Resize Handle ── */}
                <div
                    className="resize-handle"
                    onMouseDown={() => startResize('left')}
                />

                {/* ── Main Chat Area ── */}
                <main className="room-main">
                    <div className="messages-container">
                        {chatStore.messages.length === 0 && chatStore.streamingMessages.size === 0 ? (
                            <div className="empty-state" style={{ flex: 1 }}>
                                <div className="empty-state-icon" style={{ opacity: 0.3 }}>
                                    <MessageSquare size={48} />
                                </div>
                                <div className="empty-state-title">Start a Conversation</div>
                                <div className="empty-state-text">
                                    Send a message to begin. Toggle AI responses with the <Bot size={14} style={{ verticalAlign: 'middle' }} /> button.
                                </div>
                            </div>
                        ) : (
                            <>
                                {getActiveLineage().map((msg) => {
                                    const siblings = chatStore.messages.filter(m => m.parentId === msg.parentId);
                                    const siblingIndex = siblings.findIndex(m => m.id === msg.id);

                                    return (
                                        <div key={msg.id} className="message-wrapper">
                                            <div className={`message-row ${msg.authorType === 'USER' ? 'is-user' : ''}`}>
                                                <div
                                                    className={`message-bubble ${msg.authorType === 'USER' ? 'message-user' : msg.authorType === 'AI' ? 'message-ai' : 'message-system'}`}
                                                >
                                                    <div className="message-header">
                                                        <span className="message-author">
                                                            {msg.authorType === 'USER'
                                                                ? msg.authorName || 'User'
                                                                : msg.authorType === 'AI'
                                                                    ? <><Bot size={14} /> AI</>
                                                                    : 'System'}
                                                        </span>
                                                        {msg.modelId && (
                                                            <span className="message-model-badge">
                                                                {msg.modelId.split('/').pop()}
                                                            </span>
                                                        )}
                                                        <span className="message-time">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], {
                                                                hour: '2-digit', minute: '2-digit',
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="message-content">{msg.content}</div>

                                                    {msg.metadata?.tokensUsed && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                                                            {msg.metadata.tokensUsed} tokens · {msg.metadata.latencyMs}ms
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="message-side-actions" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {siblings.length > 1 && (
                                                        <div className="branch-pager" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>
                                                            <button onClick={() => handleSwitchBranch(msg, -1)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px' }}>&lt;</button>
                                                            <span>{siblingIndex + 1}/{siblings.length}</span>
                                                            <button onClick={() => handleSwitchBranch(msg, 1)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px' }}>&gt;</button>
                                                        </div>
                                                    )}
                                                    <button
                                                        className="branch-btn"
                                                        title="Branch from this message"
                                                        onClick={() => {
                                                            setBranchingMessageId(branchingMessageId === msg.id ? null : msg.id);
                                                            setBranchInput('');
                                                        }}
                                                    >
                                                        <GitBranch size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {branchingMessageId === msg.id && (
                                                <div className="branch-inline" style={{ marginLeft: msg.authorType === 'USER' ? 'auto' : '0', width: 'fit-content', display: 'flex', gap: '8px', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginTop: '8px' }}>
                                                    <input
                                                        className="input"
                                                        style={{ fontSize: '0.8rem', padding: '6px 10px', width: '250px' }}
                                                        placeholder="Branch message..."
                                                        value={branchInput}
                                                        onChange={(e) => setBranchInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleBranchSubmit(msg.id);
                                                            if (e.key === 'Escape') setBranchingMessageId(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleBranchSubmit(msg.id)}
                                                        disabled={!branchInput.trim()}
                                                    >
                                                        Branch
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {Array.from(chatStore.streamingMessages.entries())
                                    .filter(([id]) => !chatStore.messages.some(m => m.id === id))
                                    .map(([id, content]) => (
                                        <div key={id} className="message-row">
                                            <div className="message-bubble message-ai">
                                                <div className="message-header">
                                                    <span className="message-author"><Bot size={14} /> AI</span>
                                                    <span className="badge badge-secondary" style={{ fontSize: '0.6rem' }}>Streaming</span>
                                                </div>
                                                <div className="message-content">
                                                    {content}
                                                    <span className="streaming-cursor" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                {typingUsersArr.length > 0 && (
                                    <div className="typing-indicator" style={{ marginBottom: '12px' }}>
                                        <div className="typing-dots"><span /><span /><span /></div>
                                        {getTypingText()}
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Chat Input — compact */}
                    <div className="chat-input-container" style={{ padding: '8px 16px' }}>
                        <div className="chat-input-wrapper">
                            <button
                                className={`btn btn-icon ${requestAi ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                                onClick={() => setRequestAi(!requestAi)}
                                title={requestAi ? 'AI will respond' : 'AI response off'}
                            >
                                <Bot size={14} />
                            </button>
                            <textarea
                                ref={textareaRef}
                                className="chat-textarea"
                                rows={1}
                                style={{ maxHeight: '80px', fontSize: '0.85rem' }}
                                placeholder={
                                    chatStore.activeThreadId
                                        ? 'Type a message... (Shift+Enter for new line)'
                                        : 'Select or create a thread first'
                                }
                                value={messageInput}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={!chatStore.activeThreadId}
                            />
                            <button
                                className="chat-send-btn"
                                style={{ width: 32, height: 32 }}
                                onClick={handleSend}
                                disabled={!messageInput.trim() || !chatStore.activeThreadId}
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </main>

                {/* ── Right Resize Handle ── */}
                <div
                    className="resize-handle"
                    onMouseDown={() => startResize('right')}
                />

                {/* ── Right Panel ── */}
                <aside className="room-panel" style={{ width: rightWidth, minWidth: 200 }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                        <button
                            className="btn btn-ghost"
                            style={{
                                flex: 1, borderRadius: 0,
                                borderBottom: activePanel === 'branches' ? '2px solid var(--accent-primary)' : 'none',
                                color: activePanel === 'branches' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                padding: '8px 4px'
                            }}
                            onClick={() => setActivePanel('branches')}
                        >
                            <GitBranch size={14} style={{ marginRight: '4px' }} /> Branches
                        </button>
                        <button
                            className="btn btn-ghost"
                            style={{
                                flex: 1, borderRadius: 0,
                                borderBottom: activePanel === 'members' ? '2px solid var(--accent-primary)' : 'none',
                                color: activePanel === 'members' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                padding: '8px 4px'
                            }}
                            onClick={() => setActivePanel('members')}
                        >
                            <Users size={14} style={{ marginRight: '4px' }} /> Members
                        </button>
                        <button
                            className="btn btn-ghost"
                            style={{
                                flex: 1, borderRadius: 0,
                                borderBottom: activePanel === 'notes' ? '2px solid var(--accent-primary)' : 'none',
                                color: activePanel === 'notes' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                padding: '8px 4px'
                            }}
                            onClick={() => setActivePanel('notes')}
                        >
                            <StickyNote size={14} style={{ marginRight: '4px' }} /> Notes
                        </button>
                    </div>

                    {activePanel === 'branches' && (
                        <div className="sidebar-section">
                            <span className="sidebar-section-title">
                                Conversation Tree
                            </span>
                            {chatStore.messages.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '12px' }}>
                                    No messages in this thread yet.
                                </p>
                            ) : (() => {
                                const lineage = getActiveLineage();
                                const lineageIds = new Set(lineage.map(m => m.id));
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {buildMessageTree(chatStore.messages).map(root => (
                                            <BranchNode
                                                key={root.msg.id}
                                                node={root}
                                                activeLeafId={chatStore.activeLeafId}
                                                onSelect={(id) => chatStore.setActiveLeaf(id)}
                                                lineageIds={lineageIds}
                                            />
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {activePanel === 'members' && (
                        <div className="sidebar-section">
                            <span className="sidebar-section-title">Online ({roomStore.onlineUserIds.length})</span>
                            {roomStore.members
                                .sort((a, b) => {
                                    const aOnline = roomStore.onlineUserIds.includes(a.userId) ? 0 : 1;
                                    const bOnline = roomStore.onlineUserIds.includes(b.userId) ? 0 : 1;
                                    return aOnline - bOnline;
                                })
                                .map((member) => (
                                    <div key={member.id} className="member-item" style={{ justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="member-avatar">{member.user.username?.[0]?.toUpperCase() || '?'}</div>
                                            <div>
                                                <div className="member-name">{member.user.username}</div>
                                                <div className="member-role">{member.role}</div>
                                            </div>
                                        </div>
                                        <div className={`online-dot ${roomStore.onlineUserIds.includes(member.userId) ? 'online' : 'offline'}`} />
                                    </div>
                                ))}
                        </div>
                    )}

                    {activePanel === 'notes' && (
                        <div className="sidebar-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span className="sidebar-section-title" style={{ margin: 0 }}>
                                    Notes ({notesStore.notes.length})
                                </span>
                                <button className="btn btn-sm btn-secondary" onClick={() => setShowNoteModal(true)}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            {notesStore.notes.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No notes yet. Create one!</p>
                            ) : (
                                notesStore.notes.map((note) => (
                                    <div key={note.id} className="note-card">
                                        <div className="note-card-header">
                                            <div className="note-title">
                                                {note.isPinned && <Pin size={12} color="var(--accent-warning)" style={{ marginRight: '4px' }} />}
                                                {note.title}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="sidebar-action-btn"
                                                    onClick={() => {
                                                        setEditingNote(note);
                                                        setEditNoteTitle(note.title);
                                                        setEditNoteContent(getNoteText(note));
                                                    }}
                                                >
                                                    <Edit size={12} />
                                                </button>
                                                {(isHost || note.authorId === user?.id) && (
                                                    <button
                                                        className="sidebar-action-btn"
                                                        onClick={() => setDeleteNoteTarget(note.id)}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Show content preview */}
                                        {getNoteText(note) && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-tertiary)',
                                                lineHeight: 1.5,
                                                overflow: 'hidden',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                marginTop: '4px',
                                            }}>
                                                {getNoteText(note)}
                                            </div>
                                        )}
                                        <div className="note-meta">
                                            <span>{note.authorName || 'Unknown'}</span>
                                            <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </aside>
            </div >

            {/* ── Invite Modal ── */}
            {
                showInviteModal && (
                    <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h2 className="modal-title"><Link2 size={20} style={{ marginRight: '8px' }} /> Invite People</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                                Share this link with others to invite them to the room:
                            </p>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input className="input" value={inviteLink} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
                                <button className="btn btn-primary" onClick={copyInviteLink}>
                                    <Copy size={16} /> Copy
                                </button>
                            </div>
                            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setShowInviteModal(false)}>
                                Done
                            </button>
                        </div>
                    </div>
                )
            }

            {/* ── New Note Modal (with title + content) ── */}
            {
                showNoteModal && (
                    <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h2 className="modal-title"><StickyNote size={20} style={{ marginRight: '8px' }} /> New Note</h2>
                            <div className="form-group">
                                <label className="form-label" htmlFor="noteTitle">Title</label>
                                <input id="noteTitle" className="input" placeholder="Note title..." value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="noteContent">Content</label>
                                <textarea
                                    id="noteContent"
                                    className="input"
                                    placeholder="Write your note content here..."
                                    value={newNoteContent}
                                    onChange={(e) => setNewNoteContent(e.target.value)}
                                    rows={4}
                                    style={{ resize: 'vertical', minHeight: '80px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNoteModal(false)}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateNote} disabled={!newNoteTitle.trim()}>Create</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── New Thread Modal (with model selection) ── */}
            {
                showNewThreadModal && (
                    <div className="modal-overlay" onClick={() => setShowNewThreadModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h2 className="modal-title"><MessageSquare size={20} style={{ marginRight: '8px' }} /> New Thread</h2>
                            <form onSubmit={handleCreateThread}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="threadTitle">Thread Name</label>
                                    <input id="threadTitle" className="input" placeholder="e.g. Brainstorm, Code Review..." value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <Bot size={12} style={{ marginRight: '4px' }} /> AI Provider
                                    </label>
                                    <select
                                        className="input"
                                        value={selectedProvider}
                                        onChange={(e) => {
                                            setSelectedProvider(e.target.value);
                                            const models = modelCatalog[e.target.value];
                                            if (models?.length) setSelectedModel(models[0].id);
                                        }}
                                    >
                                        {Object.keys(modelCatalog).map((p) => (
                                            <option key={p} value={p}>
                                                {PROVIDER_META[p]?.name || p}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <Sparkles size={12} style={{ marginRight: '4px' }} /> Model
                                    </label>
                                    <select
                                        className="input"
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                    >
                                        {providerModels.map((m: any) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} {m.free ? '(Free)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                        <Key size={10} style={{ marginRight: '3px' }} />
                                        Free models work without API keys. Premium models need a key in Settings.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNewThreadModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!newThreadTitle.trim()}>Create Thread</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* ── Note Editor ── */}
            {
                editingNote && (
                    <div className="note-editor">
                        <div className="note-editor-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <button className="btn-icon-ghost" onClick={() => setEditingNote(null)}>
                                    <X size={20} />
                                </button>
                                <input
                                    className="note-editor-title-input"
                                    value={editNoteTitle}
                                    onChange={(e) => setEditNoteTitle(e.target.value)}
                                    placeholder="Note title"
                                />
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>
                                <Check size={14} /> Save
                            </button>
                        </div>
                        <div className="note-editor-content">
                            <textarea
                                className="note-editor-textarea"
                                placeholder="Start writing your note..."
                                value={editNoteContent}
                                onChange={(e) => setEditNoteContent(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                )
            }

            {/* ── Delete Thread Confirm ── */}
            <ConfirmDialog
                open={!!deleteThreadTarget}
                title="Delete Thread"
                message="Are you sure? All messages in this thread will be permanently deleted."
                confirmLabel="Delete Thread"
                variant="danger"
                onConfirm={handleDeleteThread}
                onCancel={() => setDeleteThreadTarget(null)}
            />

            {/* ── Delete Note Confirm ── */}
            <ConfirmDialog
                open={!!deleteNoteTarget}
                title="Delete Note"
                message="This note will be permanently removed from the room."
                confirmLabel="Delete Note"
                variant="danger"
                onConfirm={handleDeleteNote}
                onCancel={() => setDeleteNoteTarget(null)}
            />
        </div >
    );
}
