'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores';
import { Phone, PhoneOff, Mic, MicOff, Camera, CameraOff, Monitor, Zap } from './Icons';

interface VoiceChannelProps {
    roomId: string;
    userId: string;
}

export default function VoiceChannel({ roomId, userId }: VoiceChannelProps) {
    const roomStore = useRoomStore();

    const [inVoice, setInVoice] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    const [echoTest, setEchoTest] = useState(false);

    // Voice channel members state { userId, audioOn, videoOn, screenOn }
    const [voiceMembers, setVoiceMembers] = useState<Map<string, any>>(new Map());

    // Mediasoup refs
    const deviceRef = useRef<Device | null>(null);
    const sendTransportRef = useRef<any>(null);
    const recvTransportRef = useRef<any>(null);

    // Track local streams
    const localAudioStream = useRef<MediaStream | null>(null);
    const localVideoStream = useRef<MediaStream | null>(null);
    const localScreenStream = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Track remote streams and consumers
    const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const consumersRef = useRef<Map<string, any>>(new Map()); // id -> consumer
    const remoteTracksRef = useRef<Map<string, { audio?: MediaStreamTrack, video?: MediaStreamTrack, screen?: MediaStreamTrack }>>(new Map());

    // ─── Socket Event Listeners ───
    useEffect(() => {
        if (!inVoice) return;
        // @ts-ignore - Allow dynamic media endpoints
        const socket: any = getSocket();

        const handleNewProducer = async ({ producerId, peerId, kind, appData }: any) => {
            if (peerId === userId && !echoTest) return; // Ignore self unless in echo test

            // Update member list
            setVoiceMembers(prev => {
                const next = new Map(prev);
                const mem = next.get(peerId) || { userId: peerId, audioOn: false, videoOn: false, screenOn: false };
                if (kind === 'audio') mem.audioOn = true;
                if (kind === 'video') {
                    if (appData?.isScreen) mem.screenOn = true;
                    else mem.videoOn = true;
                }
                next.set(peerId, mem);
                return next;
            });
            await consumeProducer(producerId, peerId, kind, appData);
        };

        const handleProducerClosed = ({ producerId, peerId }: any) => {
            // Find which kind was closed based on consumers
            let closedKind = 'unknown';
            let consumerIdToClose = null;
            for (const [cId, consumer] of consumersRef.current.entries()) {
                if (consumer.producerId === producerId) {
                    closedKind = consumer.kind;
                    consumerIdToClose = cId;
                    consumer.close();
                    break;
                }
            }
            if (consumerIdToClose) consumersRef.current.delete(consumerIdToClose);

            // Update UI
            setVoiceMembers(prev => {
                const next = new Map(prev);
                const mem = next.get(peerId);
                if (mem) {
                    if (closedKind === 'audio') mem.audioOn = false;
                    if (closedKind === 'video') {
                        mem.videoOn = false;
                        mem.screenOn = false;
                    }
                    next.set(peerId, mem);
                }
                return next;
            });

            // Remove video track from ref
            const peerTracks = remoteTracksRef.current.get(peerId);
            if (peerTracks) {
                if (closedKind === 'audio') delete peerTracks.audio;
                if (closedKind === 'video') {
                    delete peerTracks.video;
                    delete peerTracks.screen;
                }

                if (closedKind === 'video') {
                    const el = remoteVideoRefs.current.get(peerId);
                    if (el) el.srcObject = null;
                }
            }
        };

        const handlePeerDisconnected = ({ peerId }: any) => {
            setVoiceMembers(prev => {
                const next = new Map(prev);
                next.delete(peerId);
                return next;
            });
            const vEl = remoteVideoRefs.current.get(peerId);
            if (vEl) vEl.srcObject = null;
            const aEl = remoteAudioRefs.current.get(peerId);
            if (aEl) aEl.srcObject = null;
            remoteTracksRef.current.delete(peerId);
        };

        socket.on('media:newProducer', handleNewProducer);
        socket.on('media:producerClosed', handleProducerClosed);
        socket.on('media:peerDisconnected', handlePeerDisconnected);

        return () => {
            socket.off('media:newProducer', handleNewProducer);
            socket.off('media:producerClosed', handleProducerClosed);
            socket.off('media:peerDisconnected', handlePeerDisconnected);
        };
    }, [inVoice, echoTest]);


    // ─── Core Join Logic ───
    const joinVoice = async () => {
        try {
            // @ts-ignore
            const socket: any = getSocket();

            const { rtpCapabilities } = await new Promise<any>((resolve, reject) => {
                socket.emit('media:getRouterCapabilities', {}, (res: any) => res.error ? reject(res.error) : resolve(res));
            });

            const device = new Device();
            await device.load({ routerRtpCapabilities: rtpCapabilities });
            deviceRef.current = device;

            const sendParams = await new Promise<any>((resolve, reject) => {
                socket.emit('media:createSendTransport', {}, (res: any) => res.error ? reject(res.error) : resolve(res.transportOptions));
            });

            const sendTransport = device.createSendTransport(sendParams);

            sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
                socket.emit('media:connectTransport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
                    if (res.error) errback(res.error);
                    else callback();
                });
            });

            sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
                socket.emit('media:produce', {
                    transportId: sendTransport.id,
                    kind,
                    rtpParameters,
                    appData
                }, (res: any) => {
                    if (res.error) errback(res.error);
                    else callback({ id: res.producerId });
                });
            });

            sendTransportRef.current = sendTransport;

            const recvParams = await new Promise<any>((resolve, reject) => {
                socket.emit('media:createRecvTransport', {}, (res: any) => res.error ? reject(res.error) : resolve(res.transportOptions));
            });

            const recvTransport = device.createRecvTransport(recvParams);

            recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
                socket.emit('media:connectTransport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
                    if (res.error) errback(res.error);
                    else callback();
                });
            });

            recvTransportRef.current = recvTransport;

            setInVoice(true);

            setVoiceMembers(prev => {
                const next = new Map(prev);
                next.set(userId, { userId, audioOn: false, videoOn: false, screenOn: false });
                return next;
            });

            socket.emit('media:getProducers', {}, async (res: any) => {
                if (res.error || !res.producers) return;
                for (const p of res.producers) {
                    if (p.peerId === userId && !echoTest) continue;
                    setVoiceMembers(prev => {
                        const next = new Map(prev);
                        const mem = next.get(p.peerId) || { userId: p.peerId, audioOn: false, videoOn: false, screenOn: false };
                        if (p.kind === 'audio') mem.audioOn = true;
                        if (p.kind === 'video') {
                            if (p.appData?.isScreen) mem.screenOn = true;
                            else mem.videoOn = true;
                        }
                        next.set(p.peerId, mem);
                        return next;
                    });
                    await consumeProducer(p.id, p.peerId, p.kind, p.appData);
                }
            });

        } catch (err: any) {
            console.error('Join voice error:', err);
        }
    };

    const leaveVoice = () => {
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        localAudioStream.current?.getTracks().forEach(t => t.stop());
        localVideoStream.current?.getTracks().forEach(t => t.stop());
        localScreenStream.current?.getTracks().forEach(t => t.stop());
        localAudioStream.current = null;
        localVideoStream.current = null;
        localScreenStream.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        remoteVideoRefs.current.forEach(el => el.srcObject = null);
        remoteAudioRefs.current.forEach(el => el.srcObject = null);
        setAudioEnabled(false);
        setVideoEnabled(false);
        setScreenSharing(false);
        setInVoice(false);
        setVoiceMembers(new Map());
    };

    const consumeProducer = async (producerId: string, peerId: string, kind: string, appData: any) => {
        try {
            // @ts-ignore
            const socket: any = getSocket();
            const device = deviceRef.current;
            const recvTransport = recvTransportRef.current;

            if (!device || !recvTransport) return;

            const { consumerData } = await new Promise<any>((resolve, reject) => {
                socket.emit('media:consume', {
                    transportId: recvTransport.id,
                    producerId,
                    rtpCapabilities: device.rtpCapabilities
                }, (res: any) => res.error ? reject(res.error) : resolve(res));
            });

            const consumer = await recvTransport.consume(consumerData);
            consumersRef.current.set(consumer.id, consumer);

            const peerTracks = remoteTracksRef.current.get(peerId) || {};
            if (kind === 'audio') peerTracks.audio = consumer.track;
            else if (kind === 'video') {
                if (appData?.isScreen) peerTracks.screen = consumer.track;
                else peerTracks.video = consumer.track;
            }
            remoteTracksRef.current.set(peerId, peerTracks);

            if (kind === 'audio') {
                const el = remoteAudioRefs.current.get(peerId);
                if (el) {
                    el.srcObject = new MediaStream([consumer.track]);
                    el.play().catch(() => { });
                }
            } else if (kind === 'video') {
                const el = remoteVideoRefs.current.get(peerId);
                if (el) {
                    el.srcObject = new MediaStream([consumer.track]);
                    el.play().catch(() => { });
                }
            }

            socket.emit('media:resumeConsumer', { consumerId: consumer.id }, () => { });
        } catch (err) { }
    };

    const toggleAudio = async () => {
        if (!inVoice) return;
        try {
            if (!audioEnabled) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                localAudioStream.current = stream;
                await sendTransportRef.current.produce({ track: stream.getAudioTracks()[0], appData: { mediaType: 'audio' } });
                setAudioEnabled(true);
                setVoiceMembers(prev => {
                    const next = new Map(prev);
                    const mem = next.get(userId) || { userId, audioOn: false, videoOn: false, screenOn: false };
                    mem.audioOn = true;
                    next.set(userId, mem);
                    return next;
                });
            } else {
                localAudioStream.current?.getTracks().forEach(t => t.stop());
                localAudioStream.current = null;
                setAudioEnabled(false);
                setVoiceMembers(prev => {
                    const next = new Map(prev);
                    const mem = next.get(userId);
                    if (mem) { mem.audioOn = false; next.set(userId, mem); }
                    return next;
                });
            }
        } catch (err) { }
    };

    const toggleVideo = async () => {
        if (!inVoice) return;
        try {
            if (!videoEnabled) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, frameRate: 24 } });
                localVideoStream.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                await sendTransportRef.current.produce({ track: stream.getVideoTracks()[0], appData: { mediaType: 'camera' } });
                setVideoEnabled(true);
                setVoiceMembers(prev => {
                    const next = new Map(prev);
                    const mem = next.get(userId) || { userId, audioOn: false, videoOn: false, screenOn: false };
                    mem.videoOn = true;
                    next.set(userId, mem);
                    return next;
                });
            } else {
                localVideoStream.current?.getTracks().forEach(t => t.stop());
                localVideoStream.current = null;
                if (localVideoRef.current) localVideoRef.current.srcObject = null;
                setVideoEnabled(false);
                setVoiceMembers(prev => {
                    const next = new Map(prev);
                    const mem = next.get(userId);
                    if (mem) { mem.videoOn = false; next.set(userId, mem); }
                    return next;
                });
            }
        } catch (err) { }
    };

    const toggleScreen = async () => { /* Screen sharing logic */ };
    const toggleEchoTest = () => {
        setEchoTest(!echoTest);
        if (inVoice) {
            // Briefly leave and rejoin to apply echo test filter
            leaveVoice();
            setTimeout(joinVoice, 100);
        }
    };

    return (
        <div className="voice-channel-card card glass">
            <div className="voice-header">
                <div className="voice-title-group">
                    <div className={`status-indicator ${inVoice ? 'is-active' : ''}`} />
                    <h3>Voice Channel</h3>
                </div>
                {!inVoice ? (
                    <button className="join-btn" onClick={joinVoice}>Join</button>
                ) : (
                    <button className="leave-btn" onClick={leaveVoice} title="Leave Channel">
                        <PhoneOff size={16} />
                    </button>
                )}
            </div>

            {inVoice && (
                <div className="voice-body">
                    <div className="voice-toolbar">
                        <button
                            className={`tool-btn ${echoTest ? 'active' : ''}`}
                            onClick={toggleEchoTest}
                            title={echoTest ? "Echo Test Enabled" : "Enable Echo Test"}
                        >
                            <Zap size={14} />
                            <span>{echoTest ? "Echo On" : "Setup Mode"}</span>
                        </button>
                    </div>

                    <div className="voice-members-grid">
                        {Array.from(voiceMembers.values()).map(mem => {
                            const userObj = roomStore.members.find(m => m.userId === mem.userId)?.user;
                            const isSelf = mem.userId === userId;
                            const username = isSelf ? 'You' : (userObj?.username || 'Unknown');
                            const initial = username[0]?.toUpperCase();

                            return (
                                <div key={mem.userId} className="voice-member-card">
                                    <div className="avatar-wrapper">
                                        <div className={`avatar-large ${mem.audioOn ? 'speaking' : ''}`}>
                                            {initial}
                                        </div>
                                        <div className="status-badges">
                                            {!mem.audioOn && <div className="badge-icon mute"><MicOff size={10} /></div>}
                                            {mem.videoOn && <div className="badge-icon video"><Camera size={10} /></div>}
                                        </div>
                                    </div>
                                    <span className="member-name">{username}</span>

                                    {/* Media Elements */}
                                    {!isSelf ? (
                                        <>
                                            <audio ref={el => { if (el) remoteAudioRefs.current.set(mem.userId, el); }} autoPlay />
                                            {mem.videoOn && (
                                                <video
                                                    ref={el => { if (el) remoteVideoRefs.current.set(mem.userId, el); }}
                                                    autoPlay playsInline
                                                    className="remote-video"
                                                />
                                            )}
                                        </>
                                    ) : (
                                        echoTest && <audio ref={el => { if (el) remoteAudioRefs.current.set(userId, el); }} autoPlay muted={false} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Local Preview Area */}
                    {(videoEnabled || screenSharing) && (
                        <div className="compact-preview">
                            <video ref={localVideoRef} autoPlay muted playsInline />
                            <div className="preview-label">Live Preview</div>
                        </div>
                    )}

                    <div className="voice-action-bar">
                        <button className={`action-btn ${audioEnabled ? 'enabled' : ''}`} onClick={toggleAudio}>
                            {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                        <button className={`action-btn ${videoEnabled ? 'enabled' : ''}`} onClick={toggleVideo}>
                            {videoEnabled ? <Camera size={18} /> : <CameraOff size={18} />}
                        </button>
                        <button className={`action-btn ${screenSharing ? 'enabled' : ''}`} onClick={toggleScreen}>
                            <Monitor size={18} />
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .voice-channel-card {
                    background: rgba(23, 23, 33, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 12px;
                    margin: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    overflow: hidden;
                }

                .voice-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                }

                .voice-title-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #64748b;
                    flex-shrink: 0;
                    transition: all 0.3s;
                }

                .status-indicator.is-active {
                    background: #22c55e;
                    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
                }

                h3 {
                    margin: 0;
                    font-size: 0.8rem;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    color: rgba(255, 255, 255, 0.9);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .join-btn {
                    padding: 4px 12px;
                    background: var(--accent-primary);
                    color: white;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .join-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.3);
                }

                .leave-btn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .leave-btn:hover {
                    background: #ef4444;
                    color: white;
                }

                .voice-toolbar {
                    padding-bottom: 10px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .tool-btn {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 6px;
                    color: rgba(255, 255, 255, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tool-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .tool-btn.active {
                    background: rgba(168, 85, 247, 0.15);
                    border-color: #a855f7;
                    color: #d8b4fe;
                }

                .voice-members-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                    gap: 8px;
                    margin: 8px 0;
                }

                .voice-member-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 4px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.2s;
                    min-width: 0;
                }

                .voice-member-card:hover {
                    background: rgba(255, 255, 255, 0.08);
                    transform: translateY(-1px);
                }

                .avatar-wrapper {
                    position: relative;
                }

                .avatar-large {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, var(--accent-primary), #6366f1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    font-weight: 700;
                    color: white;
                    border: 2px solid transparent;
                    transition: all 0.3s;
                }

                .avatar-large.speaking {
                    border-color: #22c55e;
                    box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
                    animation: speaking-pulse 1.5s infinite;
                }

                @keyframes speaking-pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.03); }
                    100% { transform: scale(1); }
                }

                .status-badges {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    display: flex;
                    gap: 1px;
                }

                .badge-icon {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #1e1e2e;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .badge-icon.mute { color: #ef4444; }
                .badge-icon.video { color: #3b82f6; }

                .member-name {
                    font-size: 0.65rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.7);
                    width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-align: center;
                }

                .remote-video {
                    width: 100%;
                    height: 45px;
                    object-fit: cover;
                    border-radius: 6px;
                    margin-top: 4px;
                    background: #000;
                }

                .compact-preview {
                    position: relative;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    aspect-ratio: 16/9;
                    background: #000;
                }

                .compact-preview video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .preview-label {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 0.6rem;
                    color: white;
                }

                .voice-action-bar {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 100px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .action-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    transform: translateY(-1px);
                }

                .action-btn.enabled {
                    background: var(--accent-primary);
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 4px 10px rgba(var(--accent-primary-rgb), 0.3);
                }
            `}</style>
        </div>
    );
}
