'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import NavbarDropdown from '@/components/NavbarDropdown';
import type { LLMProvider } from '@airoom/shared';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/cropImage';
import {
    Zap, ChevronLeft, Key, Plus, Trash2, Shield, Globe, Bot,
    Search, Sparkles, AlertTriangle, Check, Clock, Settings as SettingsIcon,
    User, Mail, Edit, Lock,
} from '@/components/Icons';

const PROVIDERS: { id: LLMProvider; name: string; icon: React.FC<any>; color: string }[] = [
    { id: 'openrouter', name: 'OpenRouter', icon: Globe, color: 'var(--accent-primary)' },
    { id: 'groq', name: 'Groq', icon: Zap, color: '#f55036' },
    { id: 'gemini', name: 'Google Gemini', icon: Sparkles, color: '#4285f4' },
    { id: 'openai', name: 'OpenAI', icon: Bot, color: '#10a37f' },
    { id: 'anthropic', name: 'Anthropic', icon: Shield, color: '#d4a27f' },
    { id: 'deepseek', name: 'DeepSeek', icon: Search, color: '#2563eb' },
    { id: 'together', name: 'Together AI', icon: Sparkles, color: '#6366f1' },
];

export default function SettingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, loadFromStorage, setAuth } = useAuthStore();
    const toast = useToast();
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openrouter');
    const [apiKeyValue, setApiKeyValue] = useState('');
    const [keyLabel, setKeyLabel] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [deleteKeyTarget, setDeleteKeyTarget] = useState<any>(null);

    // Profile form
    const [profileNickname, setProfileNickname] = useState('');
    const [profileBio, setProfileBio] = useState('');
    const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    useEffect(() => {
        loadFromStorage();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadKeys();
            // Initialize profile form
            setProfileNickname(user?.nickname || '');
            setProfileBio(user?.bio || '');
            setProfileAvatarUrl(user?.avatarUrl || '');
        } else {
            setLoading(false);
        }
    }, [isAuthenticated]);

    const loadKeys = async () => {
        try {
            const { keys } = await api.getKeys();
            setKeys(keys);
        } catch (err) {
            console.error('Failed to load keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            const { user: updatedUser } = await api.updateProfile({
                nickname: profileNickname || null,
                bio: profileBio || null,
                avatarUrl: profileAvatarUrl || null,
            });
            // Update local store
            const token = localStorage.getItem('airoom_token');
            if (token) setAuth(updatedUser, token);
            toast.success('Profile updated!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setAdding(true);
        try {
            await api.addKey({
                provider: selectedProvider,
                apiKey: apiKeyValue,
                label: keyLabel || 'Default',
            });
            setShowAddModal(false);
            setApiKeyValue('');
            setKeyLabel('');
            toast.success('API key added successfully');
            loadKeys();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteKey = async () => {
        if (!deleteKeyTarget) return;
        try {
            await api.deleteKey(deleteKeyTarget.id);
            setKeys(keys.filter((k) => k.id !== deleteKeyTarget.id));
            toast.success('API key removed');
            setDeleteKeyTarget(null);
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete key');
        }
    };

    if (!isAuthenticated && !loading) {
        router.push('/login');
        return null;
    }

    const displayName = user?.nickname || user?.username || 'User';
    const initials = displayName[0]?.toUpperCase() || '?';

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <a href="/dashboard" className="logo">
                        <div className="logo-icon" style={{ width: 28, height: 28 }}>
                            <Zap size={14} />
                        </div>
                        <span className="logo-text">AIRoom</span>
                    </a>
                    <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>
                        <ChevronLeft size={14} /> Dashboard
                    </button>
                </div>
                <NavbarDropdown />
            </nav>

            <div className="settings-container animate-fade-in">
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SettingsIcon size={28} /> Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    Manage your profile, preferences, and API keys
                </p>

                {/* ─── Profile Section ─── */}
                <div className="settings-section">
                    <h2 className="settings-section-title">
                        <User size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                        Profile
                    </h2>

                    {/* Avatar */}
                    <div className="avatar-upload-section">
                        <div className="avatar-preview-lg">
                            {profileAvatarUrl ? (
                                <img src={profileAvatarUrl} alt={displayName} />
                            ) : (
                                initials
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>{user?.username}</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                <Mail size={10} style={{ marginRight: '3px' }} />
                                {user?.email}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                <Clock size={10} style={{ marginRight: '3px' }} />
                                Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'recently'}
                            </p>
                        </div>
                    </div>

                    {/* Profile form */}
                    <div className="settings-form-group">
                        <label className="form-label">
                            <Edit size={12} style={{ marginRight: '4px' }} /> Nickname
                        </label>
                        <input
                            className="input"
                            placeholder="How you want to be called (optional)"
                            value={profileNickname}
                            onChange={(e) => setProfileNickname(e.target.value)}
                            maxLength={50}
                        />
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Displayed instead of your username across the app
                        </p>
                    </div>

                    <div className="settings-form-group">
                        <label className="form-label">About</label>
                        <textarea
                            className="input"
                            placeholder="Tell others about yourself (optional)"
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            maxLength={300}
                            rows={3}
                            style={{ resize: 'vertical', minHeight: '72px' }}
                        />
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'right' }}>
                            {profileBio.length}/300
                        </p>
                    </div>

                    <div className="settings-form-group">
                        <label className="form-label">Profile Picture</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="file"
                                id="avatarFileInput"
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 2 * 1024 * 1024) {
                                        toast.error('File must be under 2MB');
                                        return;
                                    }
                                    const reader = new FileReader();
                                    reader.addEventListener('load', () => {
                                        setImageSrc(reader.result?.toString() || null);
                                        setIsCropModalOpen(true);
                                    });
                                    reader.readAsDataURL(file);
                                    e.target.value = ''; // Reset input
                                }}
                            />
                            <button
                                className="avatar-upload-btn"
                                onClick={() => document.getElementById('avatarFileInput')?.click()}
                                disabled={uploadingAvatar}
                            >
                                {uploadingAvatar ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Choose File'}
                            </button>
                            {profileAvatarUrl && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={async () => {
                                        try {
                                            const { user: updated } = await api.deleteAvatar();
                                            setProfileAvatarUrl('');
                                            const token = localStorage.getItem('airoom_token');
                                            if (token) setAuth(updated, token);
                                            toast.success('Avatar removed');
                                        } catch (err: any) {
                                            toast.error(err.message || 'Removal failed');
                                        }
                                    }}
                                >
                                    <Trash2 size={14} style={{ marginRight: '4px' }} /> Remove
                                </button>
                            )}
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                JPG, PNG, WebP — max 2MB
                            </p>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                    >
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>


                {/* ─── Account Section ─── */}
                <div className="settings-section">
                    <h2 className="settings-section-title">
                        <Lock size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                        Account
                    </h2>
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Username</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.username}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Email</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.email}</div>
                            </div>
                        </div>
                        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordForm ? '16px' : '4px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Password</div>
                                {!showPasswordForm && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowPasswordForm(true)}
                                    >
                                        Change Password
                                    </button>
                                )}
                            </div>

                            {showPasswordForm ? (
                                <form className="animate-fade-in" onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (newPassword !== confirmPassword) {
                                        toast.error('New passwords do not match');
                                        return;
                                    }
                                    setChangingPassword(true);
                                    try {
                                        await api.changePassword({ oldPassword, newPassword });
                                        toast.success('Password updated successfully');
                                        setOldPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setShowPasswordForm(false);
                                    } catch (err: any) {
                                        toast.error(err.message || 'Failed to update password');
                                    } finally {
                                        setChangingPassword(false);
                                    }
                                }}>
                                    <div className="settings-form-group">
                                        <label className="form-label">Current Password</label>
                                        <input type="password" required className="input" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="form-label">New Password</label>
                                        <input type="password" required className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} />
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="form-label">Confirm New Password</label>
                                        <input type="password" required className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={changingPassword}
                                            style={{ flex: 1 }}
                                        >
                                            {changingPassword ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Update Password'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => setShowPasswordForm(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                    ••••••••••••
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── API Keys ─── */}
                <div className="settings-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="settings-section-title" style={{ border: 'none', margin: 0, padding: 0 }}>
                            <Key size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                            API Keys (BYOK)
                        </h2>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                            <Plus size={14} /> Add Key
                        </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '8px 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={14} color="var(--accent-success)" />
                        Encrypted with AES-256-GCM — only decrypted during API calls
                    </p>

                    {keys.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px' }}>
                            <div className="empty-state-icon" style={{ opacity: 0.3 }}><Key size={48} /></div>
                            <div className="empty-state-title">No API keys configured</div>
                            <div className="empty-state-text">Add your API keys to use premium models. Free models work without keys.</div>
                        </div>
                    ) : (
                        keys.map((key) => {
                            const provider = PROVIDERS.find((p) => p.id === key.provider);
                            const ProviderIcon = provider?.icon || Key;
                            return (
                                <div key={key.id} className="key-item">
                                    <div className="key-info">
                                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${provider?.color || 'var(--accent-primary)'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: provider?.color || 'var(--accent-primary)' }}>
                                            <ProviderIcon size={18} />
                                        </div>
                                        <div>
                                            <div className="key-provider">{provider?.name || key.provider}</div>
                                            <div className="key-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {key.label} <Check size={12} color="var(--accent-success)" />
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => setDeleteKeyTarget(key)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ─── Providers ─── */}
                <div className="settings-section">
                    <h2 className="settings-section-title">
                        <Bot size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                        Supported Providers
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {PROVIDERS.map((p) => {
                            const ProviderIcon = p.icon;
                            const keyCount = keys.filter((k) => k.provider === p.id).length;
                            return (
                                <div key={p.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color }}>
                                        <ProviderIcon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: keyCount > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)' }}>
                                            {keyCount > 0 ? <><Check size={10} /> {keyCount} key(s)</> : 'No key'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Add Key Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title"><Key size={20} style={{ marginRight: '8px' }} /> Add API Key</h2>
                        {error && (
                            <div style={{ background: 'rgba(225, 112, 85, 0.15)', color: 'var(--accent-danger)', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={14} /> {error}
                            </div>
                        )}
                        <form onSubmit={handleAddKey}>
                            <div className="form-group">
                                <label className="form-label">Provider</label>
                                <select className="input" value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as LLMProvider)}>
                                    {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label"><Key size={12} style={{ marginRight: '4px' }} /> API Key</label>
                                <input type="password" className="input" placeholder="sk-..." value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Label (optional)</label>
                                <input type="text" className="input" placeholder="e.g. Personal, Work" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adding}>{adding ? 'Adding...' : 'Add Key'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Key Confirm ── */}
            <ConfirmDialog
                open={!!deleteKeyTarget}
                title="Delete API Key"
                message="Are you sure? Any threads using this key will fall back to free models until mapped to a new key."
                confirmLabel="Delete Key"
                variant="danger"
                onConfirm={handleDeleteKey}
                onCancel={() => setDeleteKeyTarget(null)}
            />

            {/* ── Avatar Cropper Modal ── */}
            {isCropModalOpen && imageSrc && (
                <div className="modal-overlay">
                    <div className="modal" style={{ width: '400px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', width: '100%', height: '300px', background: '#222' }}>
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(croppedArea, croppedAreaPixels) => {
                                    setCroppedAreaPixels(croppedAreaPixels);
                                }}
                            />
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label className="form-label">Zoom</label>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsCropModalOpen(false)}>Cancel</button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    disabled={uploadingAvatar}
                                    onClick={async () => {
                                        try {
                                            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
                                            if (!croppedImage) throw new Error('Failed to crop image');
                                            setUploadingAvatar(true);
                                            setIsCropModalOpen(false);

                                            const { avatarUrl, user: updated } = await api.uploadAvatar(croppedImage);
                                            setProfileAvatarUrl(avatarUrl);
                                            const token = localStorage.getItem('airoom_token');
                                            if (token) setAuth(updated, token);
                                            toast.success('Avatar uploaded!');
                                        } catch (err: any) {
                                            toast.error(err.message || 'Upload failed');
                                        } finally {
                                            setUploadingAvatar(false);
                                        }
                                    }}
                                >
                                    Crop & Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
