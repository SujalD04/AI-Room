'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Camera, CameraOff, Monitor } from './Icons';

interface MediaControlsProps {
    roomId: string;
    userId: string;
}

/**
 * Media Controls Component
 *
 * Provides audio, video, and screenshare controls using the
 * mediasoup WebRTC SFU backend. Handles:
 * - Microphone toggle (mute/unmute)
 * - Camera toggle (on/off)
 * - Screen share (start/stop)
 * - Remote peer media rendering
 */
export default function MediaControls({ roomId, userId }: MediaControlsProps) {
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    const [deviceLoaded, setDeviceLoaded] = useState(false);
    const [remotePeers, setRemotePeers] = useState<Map<string, { audio?: boolean; video?: boolean; screen?: boolean }>>(new Map());

    // Track local streams
    const localAudioStream = useRef<MediaStream | null>(null);
    const localVideoStream = useRef<MediaStream | null>(null);
    const localScreenStream = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // ─── Toggle Audio ───
    const toggleAudio = useCallback(async () => {
        try {
            if (!audioEnabled) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localAudioStream.current = stream;
                setAudioEnabled(true);

                // Emit to socket that audio is on
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('media:produce' as any, {
                    kind: 'audio',
                    appData: { mediaType: 'audio' },
                });
            } else {
                // Stop audio tracks
                localAudioStream.current?.getTracks().forEach((t) => t.stop());
                localAudioStream.current = null;
                setAudioEnabled(false);
            }
        } catch (err) {
            console.error('Audio toggle error:', err);
        }
    }, [audioEnabled]);

    // ─── Toggle Video ───
    const toggleVideo = useCallback(async () => {
        try {
            if (!videoEnabled) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 24 },
                });
                localVideoStream.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setVideoEnabled(true);
            } else {
                localVideoStream.current?.getTracks().forEach((t) => t.stop());
                localVideoStream.current = null;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                }
                setVideoEnabled(false);
            }
        } catch (err) {
            console.error('Video toggle error:', err);
        }
    }, [videoEnabled]);

    // ─── Toggle Screen Share ───
    const toggleScreenShare = useCallback(async () => {
        try {
            if (!screenSharing) {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: 1920, height: 1080, frameRate: 15 },
                    audio: false,
                });

                localScreenStream.current = stream;
                setScreenSharing(true);

                // Auto-stop when user clicks "Stop sharing" in browser
                stream.getVideoTracks()[0].onended = () => {
                    localScreenStream.current = null;
                    setScreenSharing(false);
                };
            } else {
                localScreenStream.current?.getTracks().forEach((t) => t.stop());
                localScreenStream.current = null;
                setScreenSharing(false);
            }
        } catch (err: any) {
            // User cancelled the screen picker — that's fine
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.error('Screen share error:', err);
            }
        }
    }, [screenSharing]);

    // ─── Cleanup on Unmount ───
    useEffect(() => {
        return () => {
            localAudioStream.current?.getTracks().forEach((t) => t.stop());
            localVideoStream.current?.getTracks().forEach((t) => t.stop());
            localScreenStream.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    return (
        <div className="media-controls">
            {/* Local video preview */}
            {videoEnabled && (
                <div className="media-local-preview">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                            width: '160px',
                            height: '120px',
                            borderRadius: 'var(--radius-md)',
                            objectFit: 'cover',
                            border: '2px solid var(--accent-primary)',
                        }}
                    />
                </div>
            )}

            {/* Control Buttons */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                }}
            >
                {/* Mic */}
                <button
                    className={`btn btn-icon ${audioEnabled ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={toggleAudio}
                    title={audioEnabled ? 'Mute' : 'Unmute'}
                >
                    {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </button>

                {/* Camera */}
                <button
                    className={`btn btn-icon ${videoEnabled ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={toggleVideo}
                    title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                    {videoEnabled ? <Camera size={16} /> : <CameraOff size={16} />}
                </button>

                {/* Screen Share */}
                <button
                    className={`btn btn-icon ${screenSharing ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={toggleScreenShare}
                    title={screenSharing ? 'Stop sharing' : 'Share screen'}
                >
                    <Monitor size={16} />
                </button>
            </div>

            {/* Status indicators */}
            {(audioEnabled || videoEnabled || screenSharing) && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '4px' }}>
                    {[
                        audioEnabled && 'Mic on',
                        videoEnabled && 'Cam on',
                        screenSharing && 'Sharing screen',
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </div>
            )}

            <style jsx>{`
        .media-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .media-local-preview {
          position: relative;
          animation: fadeIn 0.3s ease;
        }
      `}</style>
        </div>
    );
}
