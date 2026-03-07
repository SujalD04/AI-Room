'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import NavbarDropdown from '@/components/NavbarDropdown';
import { Plus, Users, Link2, Crown, Trash2, ExternalLink, Zap, Layout, Sparkles } from '@/components/Icons';

export default function DashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, loadFromStorage } = useAuthStore();
    const toast = useToast();
    const [rooms, setRooms] = useState<any[]>([]);
    const [totalTokens, setTotalTokens] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadFromStorage();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadRooms();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated]);

    const loadRooms = async () => {
        try {
            const { rooms, totalTokens } = await api.getRooms();
            setRooms(rooms);
            setTotalTokens(totalTokens);
        } catch (err) {
            console.error('Failed to load rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        setCreating(true);

        try {
            const { room } = await api.createRoom({ name: newRoomName.trim() });
            setShowCreateModal(false);
            setNewRoomName('');
            toast.success('Room created successfully!');
            router.push(`/room/${room.slug}`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to create room');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.deleteRoom(deleteTarget.slug);
            setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            toast.success('Room deleted successfully');
            setDeleteTarget(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete room');
        } finally {
            setDeleting(false);
        }
    };

    if (!isAuthenticated && !loading) {
        router.push('/login');
        return null;
    }

    if (loading) {
        return (
            <div className="loading-page">
                <span className="spinner" style={{ width: 40, height: 40 }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading workspace...</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Nav */}
            <nav
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 32px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                }}
            >
                <a href="/dashboard"
                    className="logo"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        textDecoration: "none"
                    }}
                >
                    <img
                        src="/logo.png"
                        alt="AIRoom Logo"
                        style={{
                            height: "32px",
                            width: "auto",
                            objectFit: "contain"
                        }}
                    />
                    {/* <div className="logo-icon" style={{ width: 28, height: 28 }}>
                        <Zap size={14} />
                    </div>
                    <span className="logo-text">AIRoom</span> */}
                </a>
                <NavbarDropdown />
            </nav>

            {/* Dashboard */}
            <div className="dashboard-container animate-fade-in" style={{ padding: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
                    <div>
                        <div className="dashboard-header" style={{ marginBottom: '24px' }}>
                            <div>
                                <h1 className="dashboard-title">
                                    <Layout size={28} style={{ marginRight: '10px', verticalAlign: 'text-bottom' }} />
                                    Your Rooms
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                                    Manage your AI workspace rooms
                                </p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                                <Plus size={18} /> Create Room
                            </button>
                        </div>

                        {/* Workspace Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                            {[
                                { label: 'Active Rooms', value: rooms.length, icon: Layout, color: 'var(--accent-primary)' },
                                { label: 'Total Members', value: rooms.reduce((acc, r) => acc + (r._count?.members || 0), 0), icon: Users, color: 'var(--accent-secondary)' },
                                {
                                    label: 'Total Tokens Usage',
                                    value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens,
                                    icon: Zap,
                                    color: 'var(--accent-warning)'
                                },
                            ].map((stat, i) => (
                                <div key={i} className="card glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                                        <stat.icon size={22} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stat.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {rooms.length === 0 ? (
                            <div className="empty-state card glass" style={{ padding: '64px 32px' }}>
                                <div className="empty-state-icon" style={{ opacity: 0.3 }}>
                                    <Layout size={48} />
                                </div>
                                <div className="empty-state-title">No rooms yet</div>
                                <div className="empty-state-text">
                                    Create your first room to start collaborating with AI models and your team.
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: '24px' }}
                                    onClick={() => setShowCreateModal(true)}
                                >
                                    <Plus size={18} /> Create Your First Room
                                </button>
                            </div>
                        ) : (
                            <div className="rooms-grid">
                                {rooms.map((room) => (
                                    <div key={room.id} className="room-card card glass">
                                        <div style={{ cursor: 'pointer' }} onClick={() => router.push(`/room/${room.slug}`)}>
                                            <div className="room-card-name" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{room.name}</div>
                                            <div className="room-card-meta" style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Users size={14} /> {room._count?.members || 0}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Link2 size={14} /> {room.slug}
                                                </span>
                                                {room.hostId === user?.id && (
                                                    <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>
                                                        <Crown size={10} /> Host
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="room-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => router.push(`/room/${room.slug}`)}>
                                                <ExternalLink size={14} /> Open
                                            </button>
                                            {room.hostId === user?.id && (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--accent-danger)' }}
                                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(room); }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Recent Activity */}
                    <div className="animate-slide-right">
                        <div className="card glass" style={{ height: 'fit-content', position: 'sticky', top: '24px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={16} color="var(--accent-primary)" />
                                Recent Activity
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {rooms.slice(0, 5).map((room, i) => (
                                    <div key={i} className="activity-item" style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => router.push(`/room/${room.slug}`)}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{room.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Last active 2h ago</div>
                                    </div>
                                ))}
                                {rooms.length === 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
                                        No recent activity
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '24px', padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--gradient-primary)', color: 'white' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Pro Workspace</h4>
                                <p style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '12px' }}>You are currently on the free plan.</p>
                                <button className="btn btn-sm" style={{ width: '100%', background: 'white', color: 'var(--accent-primary)', border: 'none' }}>
                                    Upgrade Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">
                            <Plus size={22} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                            Create a New Room
                        </h2>
                        <form onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="roomName">Room Name</label>
                                <input id="roomName" type="text" className="input input-lg" placeholder="e.g. AI Research Lab" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} required autoFocus />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>{creating ? 'Creating...' : 'Create Room'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete Room"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? All threads, messages, and notes will be permanently lost.`}
                confirmLabel="Delete Room"
                variant="danger"
                loading={deleting}
                onConfirm={handleDeleteRoom}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
