import { Socket, Server } from 'socket.io';
import {
    getRouterRtpCapabilities,
    createWebRtcTransport,
    connectTransport,
    createProducer,
    createConsumer,
    resumeConsumer,
    pauseProducer,
    resumeProducer,
    closeProducer,
    getRoomProducers,
    cleanupPeer,
} from '../services/media';

/**
 * Register mediasoup signaling events on a socket.
 * These handle the WebRTC negotiation between client and SFU.
 */
export function setupMediaHandlers(
    io: Server,
    socket: Socket,
    userId: string,
    roomId: string
) {
    // ── Get Router RTP Capabilities ──
    // Client needs this to configure its mediasoup Device
    socket.on('media:getRouterCapabilities', async (data: any, callback: Function) => {
        try {
            const rtpCapabilities = await getRouterRtpCapabilities(roomId);
            callback({ rtpCapabilities });
        } catch (err: any) {
            console.error('getRouterCapabilities error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Create Send Transport ──
    socket.on('media:createSendTransport', async (data: any, callback: Function) => {
        try {
            const transportOptions = await createWebRtcTransport(roomId, userId);
            callback({ transportOptions });
        } catch (err: any) {
            console.error('createSendTransport error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Create Receive Transport ──
    socket.on('media:createRecvTransport', async (data: any, callback: Function) => {
        try {
            const transportOptions = await createWebRtcTransport(roomId, userId);
            callback({ transportOptions });
        } catch (err: any) {
            console.error('createRecvTransport error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Connect Transport (DTLS handshake) ──
    socket.on('media:connectTransport', async (
        data: { transportId: string; dtlsParameters: any },
        callback: Function
    ) => {
        try {
            await connectTransport(data.transportId, data.dtlsParameters);
            callback({ connected: true });
        } catch (err: any) {
            console.error('connectTransport error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Produce (start sending media) ──
    socket.on('media:produce', async (
        data: { transportId: string; kind: any; rtpParameters: any; appData?: any },
        callback: Function
    ) => {
        try {
            const producerId = await createProducer(
                data.transportId,
                userId,
                roomId,
                data.kind,
                data.rtpParameters,
                data.appData
            );

            // Notify all other peers in the room about the new producer
            socket.to(roomId).emit('media:newProducer', {
                producerId,
                peerId: userId,
                kind: data.kind,
                appData: data.appData,
            });

            callback({ producerId });
        } catch (err: any) {
            console.error('produce error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Consume (start receiving media from a producer) ──
    socket.on('media:consume', async (
        data: { transportId: string; producerId: string; rtpCapabilities: any },
        callback: Function
    ) => {
        try {
            const consumerData = await createConsumer(
                data.transportId,
                data.producerId,
                userId,
                roomId,
                data.rtpCapabilities
            );

            if (!consumerData) {
                callback({ error: 'Cannot consume this producer' });
                return;
            }

            callback({ consumerData });
        } catch (err: any) {
            console.error('consume error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Resume Consumer (client is ready to receive media) ──
    socket.on('media:resumeConsumer', async (
        data: { consumerId: string },
        callback: Function
    ) => {
        try {
            await resumeConsumer(data.consumerId);
            callback({ resumed: true });
        } catch (err: any) {
            console.error('resumeConsumer error:', err.message);
            callback({ error: err.message });
        }
    });

    // ── Pause/Resume Producer ──
    socket.on('media:pauseProducer', async (data: { producerId: string }, callback: Function) => {
        try {
            await pauseProducer(data.producerId);
            socket.to(roomId).emit('media:producerPaused', {
                producerId: data.producerId,
                peerId: userId,
            });
            callback({ paused: true });
        } catch (err: any) {
            callback({ error: err.message });
        }
    });

    socket.on('media:resumeProducer', async (data: { producerId: string }, callback: Function) => {
        try {
            await resumeProducer(data.producerId);
            socket.to(roomId).emit('media:producerResumed', {
                producerId: data.producerId,
                peerId: userId,
            });
            callback({ resumed: true });
        } catch (err: any) {
            callback({ error: err.message });
        }
    });

    // ── Close Producer (stop sharing media) ──
    socket.on('media:closeProducer', async (data: { producerId: string }, callback: Function) => {
        try {
            closeProducer(data.producerId);
            socket.to(roomId).emit('media:producerClosed', {
                producerId: data.producerId,
                peerId: userId,
            });
            callback({ closed: true });
        } catch (err: any) {
            callback({ error: err.message });
        }
    });

    // ── Get existing producers in room (for new peers to consume) ──
    socket.on('media:getProducers', async (data: any, callback: Function) => {
        try {
            const roomProducers = getRoomProducers(roomId)
                .filter((p) => p.peerId !== userId); // Don't send own producers
            callback({ producers: roomProducers });
        } catch (err: any) {
            callback({ error: err.message });
        }
    });
}

/**
 * Clean up all media resources for a disconnecting peer.
 */
export function handleMediaDisconnect(
    io: Server,
    socket: Socket,
    userId: string,
    roomId: string
) {
    // Notify room that this peer's producers are gone
    const roomProducers = getRoomProducers(roomId)
        .filter((p) => p.peerId === userId);

    for (const p of roomProducers) {
        socket.to(roomId).emit('media:producerClosed', {
            producerId: p.producerId,
            peerId: userId,
        });
    }

    // Clean up all tracks
    cleanupPeer(userId);
}
