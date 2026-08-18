import User from '../../models/user.model.js';

class PresenceService {
    constructor() {
        // userId -> Set<socketId>
        this.userSockets = new Map();
        // socketId -> { userId, status: 'online' | 'away' }
        this.socketUserMap = new Map();
        // userId -> { status: 'online' | 'away' | 'offline', lastActiveAt: Date }
        this.userPresenceMap = new Map();
        // userId -> Timeout
        this.disconnectTimers = new Map();
        this.io = null;
    }

    init(io) {
        this.io = io;

        io.on('connection', (socket) => {
            socket.on('presence:init', async (data) => {
                const { userId, status = 'online' } = data || {};
                if (!userId) return;
                this.handleUserConnect(socket, userId, status);
            });

            socket.on('presence:status_change', async (data) => {
                const { userId, status = 'online' } = data || {};
                if (!userId) return;
                this.handleStatusChange(socket, userId, status);
            });

            socket.on('presence:heartbeat', async (data) => {
                const { userId, status = 'online' } = data || {};
                if (!userId) return;
                this.handleHeartbeat(socket, userId, status);
            });

            socket.on('presence:logout', async (data) => {
                const mapping = this.socketUserMap.get(socket.id);
                const userId = data?.userId || mapping?.userId;
                if (!userId) return;
                this.handleExplicitLogout(userId);
            });

            socket.on('disconnect', () => {
                this.handleSocketDisconnect(socket);
            });
        });

        console.log('⚡ Presence Service initialized on Socket.IO');
    }

    handleExplicitLogout(userId) {
        const uid = String(userId);

        // Cancel any pending disconnect timer
        if (this.disconnectTimers.has(uid)) {
            clearTimeout(this.disconnectTimers.get(uid));
            this.disconnectTimers.delete(uid);
        }

        // Remove socket mappings
        if (this.userSockets.has(uid)) {
            for (const sockId of this.userSockets.get(uid)) {
                this.socketUserMap.delete(sockId);
            }
            this.userSockets.delete(uid);
        }

        const lastActiveAt = new Date();
        this.userPresenceMap.set(uid, {
            status: 'offline',
            lastActiveAt
        });

        this.broadcastPresence(uid, 'offline', lastActiveAt);
    }

    async handleUserConnect(socket, userId, status = 'online') {
        const uid = String(userId);

        // Cancel any pending disconnect timer for this user
        if (this.disconnectTimers.has(uid)) {
            clearTimeout(this.disconnectTimers.get(uid));
            this.disconnectTimers.delete(uid);
        }

        // Register socket
        if (!this.userSockets.has(uid)) {
            this.userSockets.set(uid, new Set());
        }
        this.userSockets.get(uid).add(socket.id);
        this.socketUserMap.set(socket.id, { userId: uid, status });

        // Evaluate overall user status across all active tabs
        const currentPresence = this.calculateUserStatus(uid);
        const lastActiveAt = new Date();

        this.userPresenceMap.set(uid, {
            status: currentPresence,
            lastActiveAt
        });

        // Broadcast to all clients
        this.broadcastPresence(uid, currentPresence, lastActiveAt);

        // Send full sync list to the newly connected socket
        socket.emit('presence:sync', this.getAllPresence());
    }

    async handleStatusChange(socket, userId, status) {
        const uid = String(userId);
        if (!this.socketUserMap.has(socket.id)) {
            this.handleUserConnect(socket, uid, status);
            return;
        }

        this.socketUserMap.set(socket.id, { userId: uid, status });
        const newStatus = this.calculateUserStatus(uid);
        const lastActiveAt = new Date();

        this.userPresenceMap.set(uid, {
            status: newStatus,
            lastActiveAt
        });

        this.broadcastPresence(uid, newStatus, lastActiveAt);
    }

    async handleHeartbeat(socket, userId, status = 'online') {
        const uid = String(userId);
        if (!this.socketUserMap.has(socket.id)) {
            this.handleUserConnect(socket, uid, status);
            return;
        }

        this.socketUserMap.set(socket.id, { userId: uid, status });
        const currentStatus = this.calculateUserStatus(uid);
        const lastActiveAt = new Date();

        this.userPresenceMap.set(uid, {
            status: currentStatus,
            lastActiveAt
        });

        this.broadcastPresence(uid, currentStatus, lastActiveAt);
    }

    handleSocketDisconnect(socket) {
        const mapping = this.socketUserMap.get(socket.id);
        if (!mapping) return;

        const { userId } = mapping;
        const uid = String(userId);

        this.socketUserMap.delete(socket.id);

        if (this.userSockets.has(uid)) {
            this.userSockets.get(uid).delete(socket.id);

            // If no more open sockets for this user, start 15s grace period before marking offline
            if (this.userSockets.get(uid).size === 0) {
                this.userSockets.delete(uid);

                const timer = setTimeout(async () => {
                    this.disconnectTimers.delete(uid);
                    const lastActiveAt = new Date();

                    this.userPresenceMap.set(uid, {
                        status: 'offline',
                        lastActiveAt
                    });

                    this.broadcastPresence(uid, 'offline', lastActiveAt);
                }, 15000); // 15-second grace period for tab refresh or brief network blips

                this.disconnectTimers.set(uid, timer);
            } else {
                // User still has other tabs open, recalculate status
                const currentStatus = this.calculateUserStatus(uid);
                const lastActiveAt = new Date();

                this.userPresenceMap.set(uid, {
                    status: currentStatus,
                    lastActiveAt
                });

                this.broadcastPresence(uid, currentStatus, lastActiveAt);
            }
        }
    }

    calculateUserStatus(userId) {
        const sockets = this.userSockets.get(userId);
        if (!sockets || sockets.size === 0) return 'offline';

        let hasOnline = false;
        for (const sockId of sockets) {
            const info = this.socketUserMap.get(sockId);
            if (info && info.status === 'online') {
                hasOnline = true;
                break;
            }
        }

        return hasOnline ? 'online' : 'away';
    }

    broadcastPresence(userId, status, lastActiveAt) {
        if (!this.io) return;

        const payload = {
            userId: String(userId),
            status,
            lastActiveAt: lastActiveAt.toISOString()
        };

        this.io.emit('presence:update', payload);

        // Async DB sync to persist last seen time
        User.findByIdAndUpdate(userId, {
            presenceStatus: status,
            lastActiveAt
        }).catch(err => console.error('Error persisting presence status to DB:', err.message));
    }

    getUserPresence(userId) {
        const uid = String(userId);
        return this.userPresenceMap.get(uid) || { status: 'offline', lastActiveAt: null };
    }

    getAllPresence() {
        const result = {};
        for (const [uid, data] of this.userPresenceMap.entries()) {
            result[uid] = {
                status: data.status,
                lastActiveAt: data.lastActiveAt ? data.lastActiveAt.toISOString() : null
            };
        }
        return result;
    }
}

export const presenceService = new PresenceService();
export default presenceService;
