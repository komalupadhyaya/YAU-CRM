import React, { useEffect, useRef, useState } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, PhoneOff, Mic, MicOff, Volume2, X, Minimize2, Maximize2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialerStore } from '../store/dialerStore';
import api from '../api/api';

export default function Dialer() {
    const { currentUser } = useAuth();
    const { isOpen, phoneNumber, leadId, contactName, isReadOnly, closeDialer, setPhoneNumber, openDialer } = useDialerStore();

    // UI States
    const [isMinimized, setIsMinimized] = useState(false);
    const [deviceStatus, setDeviceStatus] = useState<'offline' | 'registering' | 'ready' | 'error'>('offline');

    // Draggable position state for Dialer widget
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Track if a real drag occurred to prevent click trigger
    const [dragged, setDragged] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent<any>) => {
        const target = e.target as HTMLElement;
        if (!isMinimized && (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea'))) {
            return;
        }
        setIsDragging(true);
        setDragged(false);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        e.preventDefault();
    };

    const handleTouchStart = (e: React.TouchEvent<any>) => {
        const target = e.target as HTMLElement;
        if (!isMinimized && (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea'))) {
            return;
        }
        setIsDragging(true);
        setDragged(false);
        const touch = e.touches[0];
        dragStartPos.current = { x: touch.clientX, y: touch.clientY };
        dragStart.current = {
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const rawX = e.clientX - dragStart.current.x;
            const rawY = e.clientY - dragStart.current.y;

            const rect = containerRef.current?.getBoundingClientRect();
            const width = rect ? rect.width : (isMinimized ? 56 : 320);
            const height = rect ? rect.height : (isMinimized ? 56 : 520);
            const padding = 8;

            const minX = padding + 24 + width - window.innerWidth;
            const maxX = 24 - padding;
            const minY = padding + 24 + height - window.innerHeight;
            const maxY = 24 - padding;

            const boundedX = Math.max(minX, Math.min(maxX, rawX));
            const boundedY = Math.max(minY, Math.min(maxY, rawY));

            setPosition({ x: boundedX, y: boundedY });

            if (Math.abs(e.clientX - dragStartPos.current.x) > 5 || Math.abs(e.clientY - dragStartPos.current.y) > 5) {
                setDragged(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            const rawX = touch.clientX - dragStart.current.x;
            const rawY = touch.clientY - dragStart.current.y;

            const rect = containerRef.current?.getBoundingClientRect();
            const width = rect ? rect.width : (isMinimized ? 56 : 320);
            const height = rect ? rect.height : (isMinimized ? 56 : 520);
            const padding = 8;

            const minX = padding + 24 + width - window.innerWidth;
            const maxX = 24 - padding;
            const minY = padding + 24 + height - window.innerHeight;
            const maxY = 24 - padding;

            const boundedX = Math.max(minX, Math.min(maxX, rawX));
            const boundedY = Math.max(minY, Math.min(maxY, rawY));

            setPosition({ x: boundedX, y: boundedY });

            if (Math.abs(touch.clientX - dragStartPos.current.x) > 5 || Math.abs(touch.clientY - dragStartPos.current.y) > 5) {
                setDragged(true);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);

    // Ensure the dialer is maximized when opened
    useEffect(() => {
        if (isOpen) {
            setIsMinimized(false);
        }
    }, [isOpen]);

    // Ensure the dialer does not go offscreen when toggling minimization states
    useEffect(() => {
        if (!containerRef.current) return;
        
        const adjustPosition = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            
            const padding = 8;
            const width = rect.width;
            const height = rect.height;
            
            const minX = padding + 24 + width - window.innerWidth;
            const maxX = 24 - padding;
            const minY = padding + 24 + height - window.innerHeight;
            const maxY = 24 - padding;
            
            setPosition(prev => ({
                x: Math.max(minX, Math.min(maxX, prev.x)),
                y: Math.max(minY, Math.min(maxY, prev.y))
            }));
        };

        // Delay slightly to allow element to resize and calculate correct client boundaries
        const timer = setTimeout(adjustPosition, 100);
        return () => clearTimeout(timer);
    }, [isMinimized]);
    const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'ringing' | 'active' | 'incoming'>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [incomingCallData, setIncomingCallData] = useState<{ from: string; call: Call | null }>({ from: '', call: null });

    // Twilio SDK Refs
    const deviceRef = useRef<Device | null>(null);
    const callRef = useRef<Call | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    // Guard to ensure Device is initialized only once per session, after first user gesture
    const deviceInitializedRef = useRef<boolean>(false);

    // Lazy-initialize Twilio Device only after the first user gesture.
    // This satisfies browser autoplay policies (Chrome/Edge) which block HTMLAudioElement.play()
    // if called programmatically before any user interaction on the page.
    useEffect(() => {
        if (!currentUser) {
            // On logout: clean up device and reset the initialized flag
            deviceInitializedRef.current = false;
            cleanupDevice();
            return;
        }

        const handleFirstGesture = () => {
            if (!deviceInitializedRef.current) {
                deviceInitializedRef.current = true;
                initializeDevice();
            }
            // Self-remove after first trigger
            document.removeEventListener('click', handleFirstGesture);
            document.removeEventListener('keydown', handleFirstGesture);
            document.removeEventListener('touchstart', handleFirstGesture);
        };

        document.addEventListener('click', handleFirstGesture);
        document.addEventListener('keydown', handleFirstGesture);
        document.addEventListener('touchstart', handleFirstGesture);

        return () => {
            document.removeEventListener('click', handleFirstGesture);
            document.removeEventListener('keydown', handleFirstGesture);
            document.removeEventListener('touchstart', handleFirstGesture);
            cleanupDevice();
        };
    }, [currentUser]);

    // Handle token refresh or initialization
    const initializeDevice = async () => {
        try {
            setDeviceStatus('registering');
            const res = await api.get('/voice/token');
            const { token } = res.data;

            if (!token) {
                setDeviceStatus('error');
                return;
            }

            // Instantiate Twilio Device with disableAudioContextSounds to prevent browser autoplay errors
            const device = new Device(token, {
                codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
                disableAudioContextSounds: true
            });

            // Register Event Listeners
            device.on('registered', () => {
                setDeviceStatus('ready');
                console.log('Twilio Device registered successfully.');
            });

            device.on('unregistered', () => {
                setDeviceStatus('offline');
            });

            device.on('error', (error) => {
                console.error('Twilio Device Error:', error);
                setDeviceStatus('error');
            });

            device.on('incoming', (call: Call) => {
                console.log('Incoming call received from:', call.parameters.From);
                callRef.current = call;
                setIncomingCallData({ from: call.parameters.From || 'Unknown Caller', call });
                setCallStatus('incoming');
                openDialer(call.parameters.From || 'Unknown Caller');
                setIsMinimized(false); // Pop up dialer for incoming calls
                
                // Bind call events
                bindCallEvents(call);
            });

            // Register the device
            await device.register();
            deviceRef.current = device;
        } catch (err) {
            console.error('Failed to initialize Twilio Voice Device:', err);
            setDeviceStatus('error');
        }
    };

    const cleanupDevice = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (callRef.current) {
            callRef.current.disconnect();
            callRef.current = null;
        }
        if (deviceRef.current) {
            deviceRef.current.unregister();
            deviceRef.current.destroy();
            deviceRef.current = null;
        }
        setDeviceStatus('offline');
        setCallStatus('idle');
    };

    // Bind events to active call
    const bindCallEvents = (call: Call) => {
        const sid = (call as any).sid || (call.parameters && call.parameters.CallSid);
        if (sid) {
            useDialerStore.setState({ activeCallSid: sid });
            console.log("☎️ Dialer activeCallSid stored:", sid);
        }

        call.on('accept', () => {
            setCallStatus('active');
            setIsMuted(false);
            startCallTimer();
            const acceptSid = (call as any).sid || (call.parameters && call.parameters.CallSid);
            if (acceptSid) {
                useDialerStore.setState({ activeCallSid: acceptSid });
                console.log("☎️ Dialer activeCallSid updated on accept:", acceptSid);
            }
        });

        call.on('disconnect', () => {
            const finalSid = (call as any).sid || (call.parameters && call.parameters.CallSid);
            if (finalSid) {
                useDialerStore.setState({ activeCallSid: finalSid });
                console.log("☎️ Dialer activeCallSid updated on disconnect:", finalSid);
            }
            setCallStatus('idle');
            setCallDuration(0);
            if (timerRef.current) clearInterval(timerRef.current);
            callRef.current = null;
            setIncomingCallData({ from: '', call: null });
        });

        call.on('reject', () => {
            const finalSid = (call as any).sid || (call.parameters && call.parameters.CallSid);
            if (finalSid) {
                useDialerStore.setState({ activeCallSid: finalSid });
                console.log("☎️ Dialer activeCallSid updated on reject:", finalSid);
            }
            setCallStatus('idle');
            callRef.current = null;
            setIncomingCallData({ from: '', call: null });
        });

        call.on('cancel', () => {
            const finalSid = (call as any).sid || (call.parameters && call.parameters.CallSid);
            if (finalSid) {
                useDialerStore.setState({ activeCallSid: finalSid });
                console.log("☎️ Dialer activeCallSid updated on cancel:", finalSid);
            }
            setCallStatus('idle');
            callRef.current = null;
            setIncomingCallData({ from: '', call: null });
        });

        call.on('volume', (inputVolume, outputVolume) => {
            // Can be used for audio level indicators if needed
        });
    };

    // Timer helpers
    const startCallTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Call Actions
    const handleMakeCall = async () => {
        if (!deviceRef.current || deviceStatus !== 'ready') {
            alert('Softphone is not ready. Attempting to reconnect...');
            initializeDevice();
            return;
        }

        if (!phoneNumber) {
            alert('Please enter a phone number.');
            return;
        }

        let cleanPhone = phoneNumber.replace(/[^\d+]/g, ''); // Keep digits and '+'
        if (cleanPhone && !cleanPhone.startsWith('+')) {
            if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
                cleanPhone = '+' + cleanPhone;
            } else if (cleanPhone.length === 10) {
                cleanPhone = '+1' + cleanPhone;
            }
        }

        if (cleanPhone !== phoneNumber) {
            setPhoneNumber(cleanPhone);
        }

        try {
            setCallStatus('connecting');
            
            // Connect call via Twilio Device
            const call = await deviceRef.current.connect({
                params: {
                    To: cleanPhone,
                    leadId: leadId // Send leadId to associate call log on backend
                }
            });

            callRef.current = call;
            bindCallEvents(call);
        } catch (err) {
            console.error('Failed to make outbound call:', err);
            setCallStatus('idle');
        }
    };

    const handleHangUp = () => {
        if (callRef.current) {
            callRef.current.disconnect();
        } else if (deviceRef.current) {
            deviceRef.current.disconnectAll();
        }
        setCallStatus('idle');
    };

    const handleAcceptIncoming = () => {
        if (incomingCallData.call) {
            incomingCallData.call.accept();
        }
    };

    const handleRejectIncoming = () => {
        if (incomingCallData.call) {
            incomingCallData.call.reject();
            setCallStatus('idle');
        }
    };

    const handleToggleMute = () => {
        if (callRef.current) {
            const nextMuted = !isMuted;
            callRef.current.mute(nextMuted);
            setIsMuted(nextMuted);
        }
    };

    const handleDigitClick = (digit: string) => {
        // Append digit to phone number if idle
        if (callStatus === 'idle') {
            if (!isReadOnly) {
                setPhoneNumber(phoneNumber + digit);
            }
        } else if (callRef.current && callStatus === 'active') {
            // Send DTMF tone during live call
            callRef.current.sendDigits(digit);
        }
    };

    const handleBackspace = () => {
        if (callStatus === 'idle' && phoneNumber.length > 0 && !isReadOnly) {
            setPhoneNumber(phoneNumber.slice(0, -1));
        }
    };

    if (!currentUser) return null;
    if (!isOpen) return null;

    // Determine Status Badge Colors
    const getStatusColor = () => {
        switch (deviceStatus) {
            case 'ready': return 'bg-emerald-500';
            case 'registering': return 'bg-amber-500 animate-pulse';
            case 'error': return 'bg-rose-500';
            default: return 'bg-zinc-500';
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`fixed bottom-6 right-6 z-[45] sm:z-[9999] font-sans ${isDragging ? 'select-none' : ''}`}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {isMinimized ? (
                // Minimized Floating Action Button (FAB)
                <button
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onClick={(e) => {
                        if (dragged) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        setIsMinimized(false);
                    }}
                    className={`w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-white border border-zinc-800/80 cursor-grab active:cursor-grabbing ${
                        callStatus === 'incoming' 
                            ? 'bg-rose-500 animate-bounce' 
                            : callStatus === 'active' 
                                ? 'bg-emerald-500 animate-pulse' 
                                : 'bg-primary hover:bg-primary/90'
                    }`}
                >
                    <Phone className="w-6 h-6" />
                    {callStatus === 'active' && (
                        <span className="absolute -top-1 -right-1 bg-zinc-900 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-500">
                            {formatDuration(callDuration)}
                        </span>
                    )}
                    {callStatus === 'incoming' && (
                        <span className="absolute -top-1 -right-1 bg-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-ping">
                            !
                        </span>
                    )}
                </button>
            ) : (
                // Maximized Dialer Card (Glassmorphic & Premium)
                <div className="w-80 bg-zinc-950/95 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300">
                    {/* Header */}
                    <div 
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className={`p-4 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/30 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
                            <span className="text-xs font-semibold text-zinc-400 capitalize">
                                {callStatus !== 'idle' ? `${callStatus}...` : `Phone: ${deviceStatus}`}
                            </span>
                            {deviceStatus === 'error' && (
                                <button onClick={initializeDevice} title="Retry Connection">
                                    <RefreshCw className="w-3 h-3 text-zinc-500 hover:text-white" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsMinimized(true)} 
                                className="text-zinc-500 hover:text-white transition-colors"
                                title="Minimize"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={closeDialer} 
                                className="text-zinc-500 hover:text-rose-500 transition-colors"
                                title="Close Phone"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Dialer Screen */}
                    <div className="p-6 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900/40 to-transparent">
                        {callStatus === 'incoming' ? (
                            // Incoming Call UI
                            <div className="text-center w-full py-4 animate-fade-in">
                                <div className="text-sm text-primary font-bold tracking-widest uppercase mb-2">Incoming Call</div>
                                <div className="text-xl font-extrabold text-white mb-6 truncate px-4">{incomingCallData.from}</div>
                                <div className="flex justify-center gap-6">
                                    <button
                                        onClick={handleAcceptIncoming}
                                        className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105"
                                        title="Answer"
                                    >
                                        <Phone className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleRejectIncoming}
                                        className="w-14 h-14 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105"
                                        title="Decline"
                                    >
                                        <PhoneOff className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Standard Dialing / Active Call UI
                            <div className="w-full text-center">
                                {callStatus === 'active' || callStatus === 'connecting' || callStatus === 'ringing' ? (
                                    // Active Call Info
                                    <div className="mb-4">
                                        <div className="text-xs text-zinc-500 font-medium truncate mb-1">
                                            {contactName ? `Calling ${contactName}` : 'Outbound Call'}
                                        </div>
                                        <div className="text-xl font-bold text-white mb-2">{phoneNumber}</div>
                                        <div className="text-2xl font-mono font-semibold text-emerald-400">
                                            {callStatus === 'active' ? formatDuration(callDuration) : 'Connecting...'}
                                        </div>
                                    </div>
                                ) : (
                                    // Dial input screen
                                    <div className="relative w-full mb-4">
                                        <input
                                            id="dialerPhoneInput"
                                            name="dialerPhoneInput"
                                            type="text"
                                            value={phoneNumber}
                                           
                                            onChange={(e) => {
                                                const cleanValue = e.target.value.replace(/[^\d+\-()*#\s]/g, '');
                                                setPhoneNumber(cleanValue);
                                            }}
                                            placeholder="Enter phone number..."
                                            readOnly={isReadOnly}
                                            disabled={isReadOnly}
                                            className={`w-full bg-zinc-900/80 border border-zinc-800 text-center text-xl font-bold py-3 px-4 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 transition-colors ${
                                                isReadOnly ? 'opacity-70 cursor-not-allowed select-none' : ''
                                            }`}
                                            aria-label="Phone Number"
                                        />
                                        {phoneNumber && !isReadOnly && (
                                            <button
                                                onClick={handleBackspace}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                            >
                                                ⌫
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Dial Pad Grid */}
                                <div className="grid grid-cols-3 gap-3 mb-6 max-w-[240px] mx-auto">
                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => {
                                        const isDisabledDigit = callStatus === 'idle' && isReadOnly;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => !isDisabledDigit && handleDigitClick(key)}
                                                disabled={isDisabledDigit}
                                                className={`w-14 h-14 bg-zinc-900 text-white font-semibold text-lg rounded-full flex flex-col items-center justify-center border border-zinc-800/40 transition-colors shadow-sm ${
                                                    isDisabledDigit 
                                                        ? 'opacity-40 cursor-not-allowed' 
                                                        : 'hover:bg-zinc-800 active:bg-zinc-700'
                                                }`}
                                            >
                                                <span>{key}</span>
                                                {/* Subtle letters below numbers like actual phones */}
                                                {key === '2' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">ABC</span>}
                                                {key === '3' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">DEF</span>}
                                                {key === '4' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">GHI</span>}
                                                {key === '5' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">JKL</span>}
                                                {key === '6' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">MNO</span>}
                                                {key === '7' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">PQRS</span>}
                                                {key === '8' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">TUV</span>}
                                                {key === '9' && <span className="text-[9px] text-zinc-500 -mt-1 font-normal">WXYZ</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Call Controls */}
                                <div className="flex items-center justify-center gap-4 border-t border-zinc-900 pt-4 w-full">
                                    {/* Mute Button */}
                                    {(callStatus === 'active' || callStatus === 'connecting') && (
                                        <button
                                            onClick={handleToggleMute}
                                            className={`p-3 rounded-full border transition-colors ${
                                                isMuted 
                                                    ? 'bg-rose-500/20 border-rose-500 text-rose-500 hover:bg-rose-500/30' 
                                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                                            }`}
                                            title={isMuted ? 'Unmute' : 'Mute'}
                                        >
                                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                        </button>
                                    )}

                                    {/* Call / Hang Up Button */}
                                    {callStatus === 'idle' ? (
                                        <button
                                            onClick={handleMakeCall}
                                            className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 rounded-full flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105"
                                            title="Call"
                                        >
                                            <Phone className="w-6 h-6" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleHangUp}
                                            className="w-14 h-14 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 rounded-full flex items-center justify-center text-white shadow-lg transition-transform transform hover:scale-105"
                                            title="Hang Up"
                                        >
                                            <PhoneOff className="w-6 h-6" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
