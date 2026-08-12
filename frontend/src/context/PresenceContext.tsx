import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresenceInfo {
  status: PresenceStatus;
  lastActiveAt?: string | null;
}

interface PresenceContextType {
  presenceMap: Record<string, UserPresenceInfo>;
  getPresence: (userId?: string) => UserPresenceInfo;
  myStatus: PresenceStatus;
  setMyStatus: (status: PresenceStatus) => void;
}

const PresenceContext = createContext<PresenceContextType>({
  presenceMap: {},
  getPresence: () => ({ status: 'offline' }),
  myStatus: 'offline',
  setMyStatus: () => {},
});

export const usePresence = () => useContext(PresenceContext);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no activity -> 'away'
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds heartbeat
const SLEEP_DRIFT_THRESHOLD_MS = 5 * 1000; // If timer drifts > 5s, system likely slept

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const socket = useSocket();
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceInfo>>({});
  const [myStatus, setMyStatusState] = useState<PresenceStatus>('online');

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const myStatusRef = useRef<PresenceStatus>('online');
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());

  myStatusRef.current = myStatus;

  // Emit status change to Socket.IO
  const emitStatus = useCallback((status: PresenceStatus) => {
    if (!socket?.connected || !currentUser?._id) return;
    setMyStatusState(status);
    myStatusRef.current = status;
    socket.emit('presence:status_change', {
      userId: currentUser._id,
      status,
    });
  }, [socket, currentUser?._id]);

  const setMyStatus = useCallback((status: PresenceStatus) => {
    emitStatus(status);
  }, [emitStatus]);

  // Reset idle timer whenever user interacts
  const handleUserActivity = useCallback(() => {
    lastActiveTimestampRef.current = Date.now();

    // If previously away, mark as online immediately upon activity
    if (myStatusRef.current === 'away' && document.visibilityState === 'visible') {
      emitStatus('online');
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      // User has been idle for 5 minutes
      emitStatus('away');
    }, IDLE_TIMEOUT_MS);
  }, [emitStatus]);

  // Socket Connection and Presence Tracking Lifecycle
  useEffect(() => {
    if (!currentUser?._id || !socket) {
      setPresenceMap({});
      return;
    }

    const handleConnect = () => {
      console.log('⚡ Initializing presence on shared Socket.IO connection');
      socket.emit('presence:init', {
        userId: currentUser._id,
        status: document.visibilityState === 'hidden' ? 'away' : 'online',
      });
    };

    // If already connected when effect mounts, initialize immediately
    if (socket.connected) {
      handleConnect();
    }

    // Receive full sync dictionary on connect or reconnect
    const handlePresenceSync = (allPresence: Record<string, UserPresenceInfo>) => {
      setPresenceMap(prev => ({
        ...prev,
        ...allPresence,
      }));
    };

    // Receive real-time updates for single users
    const handlePresenceUpdate = (data: { userId: string; status: PresenceStatus; lastActiveAt?: string }) => {
      if (!data?.userId) return;
      setPresenceMap(prev => ({
        ...prev,
        [data.userId]: {
          status: data.status,
          lastActiveAt: data.lastActiveAt || new Date().toISOString(),
        },
      }));
    };

    socket.on('connect', handleConnect);
    socket.on('presence:sync', handlePresenceSync);
    socket.on('presence:update', handlePresenceUpdate);

    // --- User Activity & Sleep Listeners ---
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const debouncedActivityHandler = () => {
      handleUserActivity();
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, debouncedActivityHandler, { passive: true });
    });

    // Tab Visibility Change (Switching tabs, minimizing window, or screen lock)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden or screen locked -> set to away after 30 seconds
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            emitStatus('away');
          }
        }, 30000);
      } else {
        // Tab visible again -> restore online
        handleUserActivity();
        emitStatus('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Sleep / Wake Clock Drift Detection & Heartbeat Interval
    lastTickRef.current = Date.now();
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastTick = now - lastTickRef.current;
      lastTickRef.current = now;

      // Detect if computer just woke up from OS Sleep mode
      if (timeSinceLastTick > HEARTBEAT_INTERVAL_MS + SLEEP_DRIFT_THRESHOLD_MS) {
        console.log('🌙 System wake-up detected from sleep mode. Resyncing presence...');
        if (socket.connected) {
          socket.emit('presence:init', {
            userId: currentUser._id,
            status: document.visibilityState === 'hidden' ? 'away' : 'online',
          });
        }
      }

      // Regular heartbeat
      if (socket.connected && currentUser?._id) {
        socket.emit('presence:heartbeat', {
          userId: currentUser._id,
          status: myStatusRef.current,
        });
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Initial idle timer setup
    handleUserActivity();

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, debouncedActivityHandler);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      clearInterval(heartbeatInterval);

      // Clean up event listeners from shared socket
      socket.off('connect', handleConnect);
      socket.off('presence:sync', handlePresenceSync);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [currentUser?._id, socket, emitStatus, handleUserActivity]);

  const getPresence = useCallback((userId?: string): UserPresenceInfo => {
    if (!userId) return { status: 'offline' };
    return presenceMap[String(userId)] || { status: 'offline' };
  }, [presenceMap]);

  return (
    <PresenceContext.Provider value={{ presenceMap, getPresence, myStatus, setMyStatus }}>
      {children}
    </PresenceContext.Provider>
  );
};

export default PresenceContext;
