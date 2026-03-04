'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, Check, AlertTriangle, Info } from './Icons';

// ─── Types ───
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    addToast: (type: ToastType, message: string, duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Fallback for components outside provider
        return {
            addToast: () => { },
            success: () => { },
            error: () => { },
            info: () => { },
            warning: () => { },
        };
    }
    return ctx;
}

const ICON_MAP = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
};

const COLOR_MAP = {
    success: 'var(--accent-success)',
    error: 'var(--accent-danger)',
    warning: 'var(--accent-warning)',
    info: 'var(--accent-primary)',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [exiting, setExiting] = useState(false);
    const IconComp = ICON_MAP[toast.type];

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    return (
        <div
            className={`toast-item ${exiting ? 'toast-exit' : 'toast-enter'}`}
            style={{ borderLeftColor: COLOR_MAP[toast.type] }}
        >
            <div className="toast-icon" style={{ color: COLOR_MAP[toast.type] }}>
                <IconComp size={16} />
            </div>
            <span className="toast-message">{toast.message}</span>
            <button
                className="toast-close"
                onClick={() => {
                    setExiting(true);
                    setTimeout(() => onRemove(toast.id), 300);
                }}
            >
                <X size={14} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts((prev) => [...prev, { id, type, message, duration }]);
    }, []);

    const ctx: ToastContextType = {
        addToast,
        success: (msg) => addToast('success', msg),
        error: (msg) => addToast('error', msg),
        info: (msg) => addToast('info', msg),
        warning: (msg) => addToast('warning', msg),
    };

    return (
        <ToastContext.Provider value={ctx}>
            {children}
            <div className="toast-container">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}
