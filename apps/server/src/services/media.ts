import * as mediasoup from 'mediasoup';
import { types as mediasoupTypes } from 'mediasoup';
import { mediasoupConfig } from '../config/mediasoup';

/**
 * Media Service — manages mediasoup Workers, Routers, and Transports.
 * One Router per room, isolating media streams.
 */

// Pool of workers (round-robin assignment)
let workers: mediasoupTypes.Worker[] = [];
let nextWorkerIdx = 0;

// Room ID → Router mapping
const roomRouters = new Map<string, mediasoupTypes.Router>();

// Transport tracking: transportId → Transport
const transports = new Map<string, mediasoupTypes.WebRtcTransport>();

// Producer tracking: producerId → { producer, peerId, roomId }
const producers = new Map<string, {
    producer: mediasoupTypes.Producer;
    peerId: string;
    roomId: string;
}>();

// Consumer tracking: consumerId → { consumer, peerId, roomId }
const consumers = new Map<string, {
    consumer: mediasoupTypes.Consumer;
    peerId: string;
    roomId: string;
}>();

// Per-peer tracking: peerId → { transportIds, producerIds, consumerIds }
const peerMedia = new Map<string, {
    transportIds: Set<string>;
    producerIds: Set<string>;
    consumerIds: Set<string>;
}>();

/**
 * Initialize mediasoup Workers.
 * Call this once during server startup.
 */
export async function initMediasoup(): Promise<void> {
    const { numWorkers, worker: workerSettings } = mediasoupConfig;

    console.log(`🎥 Creating ${numWorkers} mediasoup Worker(s)...`);

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({
            rtcMinPort: workerSettings.rtcMinPort,
            rtcMaxPort: workerSettings.rtcMaxPort,
            logLevel: workerSettings.logLevel,
            logTags: workerSettings.logTags,
        });

        worker.on('died', () => {
            console.error(`❌ mediasoup Worker died [pid:${worker.pid}], restarting...`);
            setTimeout(async () => {
                const idx = workers.indexOf(worker);
                if (idx >= 0) {
                    const newWorker = await mediasoup.createWorker({
                        rtcMinPort: workerSettings.rtcMinPort,
                        rtcMaxPort: workerSettings.rtcMaxPort,
                        logLevel: workerSettings.logLevel,
                        logTags: workerSettings.logTags,
                    });
                    workers[idx] = newWorker;
                }
            }, 2000);
        });

        workers.push(worker);
        console.log(`   Worker ${i + 1} created [pid:${worker.pid}]`);
    }
}

/**
 * Get the next Worker using round-robin.
 */
function getNextWorker(): mediasoupTypes.Worker {
    const worker = workers[nextWorkerIdx];
    nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
    return worker;
}

/**
 * Get or create a Router for a room.
 */
export async function getOrCreateRouter(roomId: string): Promise<mediasoupTypes.Router> {
    let router = roomRouters.get(roomId);
    if (router && !router.closed) return router;

    const worker = getNextWorker();
    router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
    });

    roomRouters.set(roomId, router);
    console.log(`🎥 Router created for room: ${roomId}`);
    return router;
}

/**
 * Get the RTP capabilities of a room's Router.
 */
export async function getRouterRtpCapabilities(roomId: string) {
    const router = await getOrCreateRouter(roomId);
    return router.rtpCapabilities;
}

/**
 * Create a WebRTC Transport for a peer (send or receive).
 */
export async function createWebRtcTransport(
    roomId: string,
    peerId: string
): Promise<{
    id: string;
    iceParameters: mediasoupTypes.IceParameters;
    iceCandidates: mediasoupTypes.IceCandidate[];
    dtlsParameters: mediasoupTypes.DtlsParameters;
    sctpParameters?: mediasoupTypes.SctpParameters;
}> {
    const router = await getOrCreateRouter(roomId);

    const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

    // Set max incoming bitrate
    if (mediasoupConfig.webRtcTransport.maxIncomingBitrate) {
        try {
            await transport.setMaxIncomingBitrate(mediasoupConfig.webRtcTransport.maxIncomingBitrate);
        } catch (err) {
            // Ignore if not supported
        }
    }

    // Track transport
    transports.set(transport.id, transport);
    if (!peerMedia.has(peerId)) {
        peerMedia.set(peerId, { transportIds: new Set(), producerIds: new Set(), consumerIds: new Set() });
    }
    peerMedia.get(peerId)!.transportIds.add(transport.id);

    transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
            transport.close();
            transports.delete(transport.id);
            peerMedia.get(peerId)?.transportIds.delete(transport.id);
        }
    });

    transport.on('@close', () => {
        transports.delete(transport.id);
        peerMedia.get(peerId)?.transportIds.delete(transport.id);
    });

    return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
    };
}

/**
 * Connect a WebRTC Transport (complete DTLS handshake).
 */
export async function connectTransport(
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
    const transport = transports.get(transportId);
    if (!transport) throw new Error('Transport not found');
    await transport.connect({ dtlsParameters });
}

/**
 * Create a Producer (start sending media).
 */
export async function createProducer(
    transportId: string,
    peerId: string,
    roomId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters,
    appData?: Record<string, any>
): Promise<string> {
    const transport = transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { peerId, roomId, ...appData },
    });

    producers.set(producer.id, { producer, peerId, roomId });
    peerMedia.get(peerId)?.producerIds.add(producer.id);

    producer.on('transportclose', () => {
        producers.delete(producer.id);
        peerMedia.get(peerId)?.producerIds.delete(producer.id);
    });

    return producer.id;
}

/**
 * Create a Consumer (start receiving media from a producer).
 */
export async function createConsumer(
    transportId: string,
    producerId: string,
    peerId: string,
    roomId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
): Promise<{
    id: string;
    producerId: string;
    kind: mediasoupTypes.MediaKind;
    rtpParameters: mediasoupTypes.RtpParameters;
    appData: Record<string, unknown>;
} | null> {
    const router = roomRouters.get(roomId);
    if (!router) throw new Error('Router not found for room');

    // Check if the router can consume this producer
    if (!router.canConsume({ producerId, rtpCapabilities })) {
        console.warn(`Cannot consume producer ${producerId} for peer ${peerId}`);
        return null;
    }

    const transport = transports.get(transportId);
    if (!transport) throw new Error('Consumer transport not found');

    const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused — client will resume when ready
    });

    consumers.set(consumer.id, { consumer, peerId, roomId });
    peerMedia.get(peerId)?.consumerIds.add(consumer.id);

    consumer.on('transportclose', () => {
        consumers.delete(consumer.id);
        peerMedia.get(peerId)?.consumerIds.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
        consumers.delete(consumer.id);
        peerMedia.get(peerId)?.consumerIds.delete(consumer.id);
    });

    return {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        appData: consumer.appData as Record<string, unknown>,
    };
}

/**
 * Resume a paused Consumer.
 */
export async function resumeConsumer(consumerId: string): Promise<void> {
    const entry = consumers.get(consumerId);
    if (!entry) throw new Error('Consumer not found');
    await entry.consumer.resume();
}

/**
 * Pause/resume a Producer.
 */
export async function pauseProducer(producerId: string): Promise<void> {
    const entry = producers.get(producerId);
    if (!entry) throw new Error('Producer not found');
    await entry.producer.pause();
}

export async function resumeProducer(producerId: string): Promise<void> {
    const entry = producers.get(producerId);
    if (!entry) throw new Error('Producer not found');
    await entry.producer.resume();
}

/**
 * Close a Producer (stop sending media).
 */
export function closeProducer(producerId: string): void {
    const entry = producers.get(producerId);
    if (!entry) return;
    entry.producer.close();
    producers.delete(producerId);
    peerMedia.get(entry.peerId)?.producerIds.delete(producerId);
}

/**
 * Get all producers for a room (used when a new peer joins to consume existing streams).
 */
export function getRoomProducers(roomId: string): Array<{
    producerId: string;
    peerId: string;
    kind: mediasoupTypes.MediaKind;
    appData: Record<string, unknown>;
}> {
    const result: Array<{
        producerId: string;
        peerId: string;
        kind: mediasoupTypes.MediaKind;
        appData: Record<string, unknown>;
    }> = [];

    for (const [id, entry] of producers) {
        if (entry.roomId === roomId && !entry.producer.closed) {
            result.push({
                producerId: id,
                peerId: entry.peerId,
                kind: entry.producer.kind,
                appData: entry.producer.appData as Record<string, unknown>,
            });
        }
    }

    return result;
}

/**
 * Clean up all media resources for a peer (called on disconnect).
 */
export function cleanupPeer(peerId: string): void {
    const media = peerMedia.get(peerId);
    if (!media) return;

    // Close all consumers
    for (const consumerId of media.consumerIds) {
        const entry = consumers.get(consumerId);
        if (entry) {
            entry.consumer.close();
            consumers.delete(consumerId);
        }
    }

    // Close all producers
    for (const producerId of media.producerIds) {
        const entry = producers.get(producerId);
        if (entry) {
            entry.producer.close();
            producers.delete(producerId);
        }
    }

    // Close all transports
    for (const transportId of media.transportIds) {
        const transport = transports.get(transportId);
        if (transport) {
            transport.close();
            transports.delete(transportId);
        }
    }

    peerMedia.delete(peerId);
}

/**
 * Clean up a room Router (called when room is empty/deleted).
 */
export function cleanupRoom(roomId: string): void {
    const router = roomRouters.get(roomId);
    if (router && !router.closed) {
        router.close();
    }
    roomRouters.delete(roomId);
}
