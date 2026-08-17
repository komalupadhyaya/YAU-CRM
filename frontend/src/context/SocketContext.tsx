import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // If no user is logged in, disconnect any active socket
    if (!currentUser?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : '') ||
      (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

    const socketInstance: Socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to Master Socket.IO server:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.IO server:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('⚠️ Socket.IO connection warning:', error.message);
    });

    // ── AI Real-Time Event Toasts ─────────────────────────────────────
    socketInstance.on('ai:scored', (data: any) => {
      console.log('⚡ Received AI Scored Event:', data);
      const badge = data.score === 'Hot' ? '🔴 Hot' : data.score === 'Warm' ? '🟡 Warm' : '🔵 Cold';
      toast.info(`Claude AI Scored Lead: ${badge}`, {
        description: `Lead: "${data.leadName || 'New Lead'}" — ${data.reason}`,
        duration: 5000
      });
    });

    socketInstance.on('ai:reply_assistant', (data: any) => {
      if (data.autoSent) {
        toast.success(`Claude AI Auto-Replied to SMS from ${data.leadName}! 📱`, {
          description: `"${data.text}"`
        });
      } else {
        toast.info(`Claude AI Drafted Reply for ${data.leadName} 📝`, {
          description: `Review and approve in CRM.`
        });
      }
    });

    socketInstance.on('ai:initial_contact', (data: any) => {
      toast.success(`Claude AI Contact Message Sent for ${data.leadName}! 🚀`, {
        description: data.text
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [currentUser?._id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext).socket;
export const useSocketContext = () => useContext(SocketContext);

export default SocketContext;
