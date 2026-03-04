import os from 'os';
import { env } from './env';
import type { types as mediasoupTypes } from 'mediasoup';

/**
 * mediasoup configuration for WebRTC SFU.
 * One Worker per CPU core, each Router handles one room.
 */

export const mediasoupConfig = {
    // Number of workers = CPU cores (capped at 4 for dev)
    numWorkers: Math.min(os.cpus().length, 4),

    // Worker settings
    worker: {
        rtcMinPort: env.MEDIASOUP_MIN_PORT,
        rtcMaxPort: env.MEDIASOUP_MAX_PORT,
        logLevel: 'warn' as mediasoupTypes.WorkerLogLevel,
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
        ] as mediasoupTypes.WorkerLogTag[],
    },

    // Router media codecs
    router: {
        mediaCodecs: [
            {
                kind: 'audio' as mediasoupTypes.MediaKind,
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: 'video' as mediasoupTypes.MediaKind,
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000,
                },
            },
            {
                kind: 'video' as mediasoupTypes.MediaKind,
                mimeType: 'video/VP9',
                clockRate: 90000,
                parameters: {
                    'profile-id': 2,
                    'x-google-start-bitrate': 1000,
                },
            },
            {
                kind: 'video' as mediasoupTypes.MediaKind,
                mimeType: 'video/h264',
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '4d0032',
                    'level-asymmetry-allowed': 1,
                    'x-google-start-bitrate': 1000,
                },
            },
        ] as mediasoupTypes.RtpCodecCapability[],
    },

    // WebRTC transport settings
    webRtcTransport: {
        listenIps: [
            {
                ip: env.MEDIASOUP_LISTEN_IP,
                announcedIp: env.MEDIASOUP_ANNOUNCED_IP || undefined,
            },
        ],
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxSctpMessageSize: 262144,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    },
};
