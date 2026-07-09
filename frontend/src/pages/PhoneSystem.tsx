import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { Phone, Music, Voicemail, HelpCircle, Save, Plus, Trash2, Volume2, Upload, AlertCircle, ToggleLeft, ToggleRight, Check } from 'lucide-react';
import api from '../api/api';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Extension {
    _id?: string;
    digit: number;
    label: string;
    forwardTo: string;
}

interface PhoneConfig {
    greeting: {
        type: 'text-to-speech' | 'audio-file';
        message: string;
        audioFileUrl?: string;
    };
    holdMusic: {
        enabled?: boolean;
        audioFileUrl?: string;
    };
    extensions: Extension[];
    // Controls whether extension labels are read aloud after the greeting
    announceExtensions: boolean;
    voicemail: {
        enabled: boolean;
        useAudioFile?: boolean;
        ttsMessage?: string;
        audioFileUrl?: string;
        emailNotification: string;
        emailNotificationEnabled?: boolean;
    };
    callRouting: {
        defaultForwardTo: string;
    };
}

export default function PhoneSystem() {
    const [activeTab, setActiveTab] = useState<'greeting' | 'extensions' | 'holdMusic' | 'voicemail' | 'forwarding'>('greeting');
    const [config, setConfig] = useState<PhoneConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Temp form state for adding extension
    const [newExt, setNewExt] = useState({ digit: 1, label: '', forwardTo: '' });
    const [newForwardTo, setNewForwardTo] = useState('');

    // File upload states
    const [uploadingFile, setUploadingFile] = useState<string | null>(null);

    // File delete confirmation states
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/voice/config');
            setConfig(res.data);
        } catch (err) {
            console.error('Failed to fetch phone config:', err);
            toast.error('Failed to load phone system configuration.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async (updatedConfig = config, showToast = true) => {
        if (!updatedConfig) return;
        try {
            setSaving(true);
            const res = await api.put('/voice/config', updatedConfig);
            setConfig(res.data);
            if (showToast) {
                toast.success('Phone system configuration saved successfully.');
            }
        } catch (err) {
            console.error('Failed to save phone config:', err);
            toast.error('Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldPath: string) => {
        if (!e.target.files || e.target.files.length === 0 || !config) return;
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append('file', file);

        let uploadToastId: string | number | null = null;
        try {
            setUploadingFile(fieldPath);
            uploadToastId = toast.info(`Uploading ${file.name}...`);
            const res = await api.post('/voice/upload-audio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { url } = res.data;

            // Deep clone and update the specific field
            const newConfig = { ...config };
            if (fieldPath === 'greeting.audioFileUrl') {
                newConfig.greeting = { ...newConfig.greeting, audioFileUrl: url };
            } else if (fieldPath === 'holdMusic.audioFileUrl') {
                newConfig.holdMusic = { ...newConfig.holdMusic, audioFileUrl: url };
            } else if (fieldPath === 'voicemail.audioFileUrl') {
                newConfig.voicemail = { ...newConfig.voicemail, audioFileUrl: url };
            }

            setConfig(newConfig);
            // Save automatically on upload (suppress save toast)
            await handleSaveConfig(newConfig, false);
            if (uploadToastId) toast.dismiss(uploadToastId);
            toast.success('Audio file uploaded and saved.');
        } catch (err) {
            if (uploadToastId) toast.dismiss(uploadToastId);
            console.error('File upload failed:', err);
            toast.error('Failed to upload audio file.');
        } finally {
            setUploadingFile(null);
        }
    };

    const handleRemoveAudio = (fieldPath: string) => {
        setFieldToDelete(fieldPath);
        setConfirmDeleteOpen(true);
    };

    const executeDeleteAudio = async () => {
        if (!config || !fieldToDelete) return;

        try {
            const newConfig = { ...config };
            if (fieldToDelete === 'greeting.audioFileUrl') {
                newConfig.greeting = { ...newConfig.greeting, audioFileUrl: '' };
            } else if (fieldToDelete === 'holdMusic.audioFileUrl') {
                newConfig.holdMusic = { ...newConfig.holdMusic, audioFileUrl: '' };
            } else if (fieldToDelete === 'voicemail.audioFileUrl') {
                newConfig.voicemail = { ...newConfig.voicemail, audioFileUrl: '' };
            }

            setConfig(newConfig);
            // Save configuration without triggering generic save toast
            await handleSaveConfig(newConfig, false);
            toast.success('Audio file deleted permanently from server.');
        } catch (err) {
            console.error('Failed to delete audio file:', err);
            toast.error('Failed to delete audio file.');
        } finally {
            setFieldToDelete(null);
            setConfirmDeleteOpen(false);
        }
    };

    // Extension Handlers
    const handleAddExtension = () => {
        if (!config) return;
        if (!newExt.label || !newExt.forwardTo) {
            toast.error('Please enter a label and forwarding destination.');
            return;
        }

        // Check if digit already exists
        const exists = config.extensions.some(e => e.digit === newExt.digit);
        if (exists) {
            toast.error(`Extension for digit ${newExt.digit} already exists.`);
            return;
        }

        // Normalize phone number to E.164 format if it's not a browser client email
        let forwardTo = newExt.forwardTo.trim();
        if (!forwardTo.includes('@')) {
            const digitsOnly = forwardTo.replace(/\D/g, '');
            if (digitsOnly.length === 10) {
                forwardTo = `+1${digitsOnly}`;
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
                forwardTo = `+${digitsOnly}`;
            } else if (!forwardTo.startsWith('+')) {
                forwardTo = `+${digitsOnly}`;
            }
            if (!forwardTo.match(/^\+\d{10,15}$/)) {
                toast.error('Invalid phone number format. Use E.164 format like +12015551234 or a 10-digit US number.');
                return;
            }
        }

        const updatedExtensions = [...config.extensions, { ...newExt, forwardTo }];
        const newConfig = { ...config, extensions: updatedExtensions };
        setConfig(newConfig);
        handleSaveConfig(newConfig);

        // Reset form
        setNewExt({ digit: (newExt.digit % 9) + 1, label: '', forwardTo: '' });
    };

    const handleDeleteExtension = (digit: number) => {
        if (!config) return;
        const updatedExtensions = config.extensions.filter((ext) => ext.digit !== digit);
        const newConfig = { ...config, extensions: updatedExtensions };
        setConfig(newConfig);
        handleSaveConfig(newConfig);
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                    Loading Phone System Settings...
                </div>
            </AppLayout>
        );
    }

    if (!config) return null;

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-5">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                            <Phone className="w-8 h-8 text-primary" />
                            Phone System (PBX)
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure your company's virtual receptionist, IVR menu extensions, hold music, and voicemail routing.
                        </p>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar Tabs */}
                    <div className="flex flex-col space-y-1 bg-card border border-border/60 p-2 rounded-xl h-fit">
                        <button
                            onClick={() => setActiveTab('greeting')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'greeting' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Volume2 className="w-4 h-4" />
                            Virtual Receptionist
                        </button>
                        <button
                            onClick={() => setActiveTab('extensions')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'extensions' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            IVR Menu Extensions
                        </button>
                        <button
                            onClick={() => setActiveTab('holdMusic')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'holdMusic' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Music className="w-4 h-4" />
                            Hold Music
                        </button>
                        <button
                            onClick={() => setActiveTab('voicemail')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'voicemail' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Voicemail className="w-4 h-4" />
                            Voicemail Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('forwarding')}
                            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'forwarding' ? 'bg-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Phone className="w-4 h-4" />
                            Fallback Forwarding
                        </button>
                    </div>

                    {/* Tab Content Panels */}
                    <div className="md:col-span-3 bg-card/50 border border-border/60 rounded-xl p-6">

                        {/* TAB 1: GREETING */}
                        {activeTab === 'greeting' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-1">Virtual Receptionist Greeting</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Configure the message played to callers when they dial your main business number.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Greeting Type</div>
                                        <div className="relative p-1 bg-muted/40 border border-border/60 rounded-xl flex gap-1">
                                            {[
                                                { value: 'text-to-speech', label: '🔊 Text to Speech (AI Voice)' },
                                                { value: 'audio-file', label: '🎵 Upload Audio File (MP3)' }
                                            ].map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setConfig({
                                                        ...config,
                                                        greeting: { ...config.greeting, type: value as 'text-to-speech' | 'audio-file' }
                                                    })}
                                                    className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                                        config.greeting.type === value
                                                            ? 'bg-primary text-primary-foreground shadow-md'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {config.greeting.type === 'text-to-speech' ? (
                                        <div className="space-y-2">
                                            <label htmlFor="greeting-message" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Greeting Message</label>
                                            <textarea
                                                id="greeting-message"
                                                name="greeting-message"
                                                value={config.greeting.message}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    greeting: { ...config.greeting, message: e.target.value }
                                                })}
                                                rows={4}
                                                className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                                                placeholder="Enter the greeting script. Example: Thank you for calling. Press 1 for sales..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-4 p-4 bg-muted/30 border border-border/40 rounded-lg">
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audio File</label>
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        onChange={(e) => handleFileUpload(e, 'greeting.audioFileUrl')}
                                                        className="hidden"
                                                        id="greeting-upload"
                                                        disabled={uploadingFile !== null}
                                                    />
                                                    <label
                                                        htmlFor="greeting-upload"
                                                        className={`flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-accent text-foreground rounded-lg cursor-pointer font-medium transition-colors ${uploadingFile === 'greeting.audioFileUrl' ? 'opacity-50 pointer-events-none' : ''
                                                            }`}
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        {uploadingFile === 'greeting.audioFileUrl' ? 'Uploading...' : 'Choose MP3 File'}
                                                    </label>
                                                </div>
                                                {config.greeting.audioFileUrl && (
                                                    <div className="flex items-center gap-2">
                                                        <audio src={config.greeting.audioFileUrl} controls className="h-9 max-w-xs" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAudio('greeting.audioFileUrl')}
                                                            className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                            title="Delete permanently"
                                                        >
                                                            <Trash2 className="w-4.5 h-4.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {config.greeting.audioFileUrl && (
                                                <p className="text-[10px] text-muted-foreground/80 truncate max-w-md">
                                                    Current File: <a href={config.greeting.audioFileUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">{config.greeting.audioFileUrl}</a>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Announce Extensions Toggle */}
                                <div className="border border-border/60 rounded-xl p-4 bg-muted/30">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Volume2 className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm font-semibold text-foreground">Announce IVR Extension Labels After Greeting</span>
                                                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${config.announceExtensions
                                                        ? 'bg-primary/15 text-primary'
                                                        : 'bg-accent/50 text-muted-foreground'
                                                    }`}>
                                                    {config.announceExtensions ? 'ON' : 'OFF'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground/80 leading-relaxed">
                                                {config.announceExtensions ? (
                                                    <span><span className="text-primary font-medium">ON</span> — After the greeting, the system will also read each extension aloud (e.g. <em>"Press 1 for Priyanshu, Press 2 for Chirag"</em>).</span>
                                                ) : (
                                                    <span><span className="text-muted-foreground font-medium">OFF</span> — Only the Greeting Message is heard. The greeting itself should tell the caller what to press.</span>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            id="toggle-announce-extensions"
                                            onClick={() => setConfig({ ...config, announceExtensions: !config.announceExtensions })}
                                            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 ${config.announceExtensions
                                                    ? 'bg-primary focus:ring-primary'
                                                    : 'bg-accent/80 focus:ring-zinc-500'
                                                }`}
                                            aria-label={config.announceExtensions ? 'Disable extension announcement' : 'Enable extension announcement'}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${config.announceExtensions ? 'translate-x-6' : 'translate-x-0'
                                                }`} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveConfig()}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-semibold transition-colors shadow-lg"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Greeting Settings'}
                                </button>
                            </div>
                        )}

                        {/* TAB 2: EXTENSIONS */}
                        {activeTab === 'extensions' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-1">IVR Menu Extensions</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Set up number routing (e.g. Press 1 for Sales) to forward calls to external phones or specific reps in the CRM.
                                    </p>
                                </div>

                                {/* Extensions List */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Extensions</h3>
                                    {config.extensions.length === 0 ? (
                                        <div className="text-center py-6 border border-dashed border-border rounded-lg text-sm text-muted-foreground/80">
                                            No extensions configured yet. Use the form below to add one.
                                        </div>
                                    ) : (
                                        <div className="border border-border bg-muted/10 rounded-lg overflow-hidden divide-y divide-zinc-850">
                                            {[...config.extensions].sort((a, b) => a.digit - b.digit).map((ext) => (
                                                <div key={ext.digit} className="flex items-center justify-between p-4 hover:bg-accent/20 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                                                            {ext.digit}
                                                        </span>
                                                        <div>
                                                            <div className="text-sm font-semibold text-foreground">{ext.label}</div>
                                                            <div className="text-xs text-muted-foreground/80">
                                                                Forwarding to: <span className="font-mono text-muted-foreground">{ext.forwardTo}</span>
                                                                {ext.forwardTo.includes('@') && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">CRM Browser Phone</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteExtension(ext.digit)}
                                                        className="text-muted-foreground/80 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                                                        title="Delete Extension"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Extension Form */}
                                <div className="p-4 bg-muted/20 border border-border/60 rounded-xl space-y-4">
                                    <h3 className="text-sm font-bold text-foreground">Add New Extension Route</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                        <div>
                                            <label htmlFor="ext-digit" className="block text-[10px] uppercase font-bold text-muted-foreground/80 mb-1">Digit (1-9)</label>
                                            <select
                                                id="ext-digit"
                                                name="ext-digit"
                                                value={newExt.digit}
                                                onChange={(e) => setNewExt({ ...newExt, digit: Number(e.target.value) })}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                                    <option key={num} value={num}>Digit {num}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label htmlFor="ext-label" className="block text-[10px] uppercase font-bold text-muted-foreground/80 mb-1">Menu Label (e.g. Sales Dept)</label>
                                            <input
                                                id="ext-label"
                                                name="ext-label"
                                                type="text"
                                                value={newExt.label}
                                                onChange={(e) => setNewExt({ ...newExt, label: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                                                placeholder="e.g. Sales Department"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="ext-forwardTo" className="block text-[10px] uppercase font-bold text-muted-foreground/80 mb-1">Forward To (Phone or Rep Email)</label>
                                            <input
                                                id="ext-forwardTo"
                                                name="ext-forwardTo"
                                                type="text"
                                                value={newExt.forwardTo}
                                                onChange={(e) => setNewExt({ ...newExt, forwardTo: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                                                placeholder="e.g. +14105550001 or rep@yausport.com"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddExtension}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        <Plus className="w-4.5 h-4.5" />
                                        Add & Save Extension
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: HOLD MUSIC */}
                        {activeTab === 'holdMusic' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-1">Hold Music</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Configure what callers hear while waiting to be connected to an extension.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Enable / Disable Switch */}
                                    <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">Play Custom Hold Music</div>
                                            <div className="text-xs text-muted-foreground/80">
                                                Turn ON to play custom uploaded MP3 audio. Turn OFF to play the default ringtone instead.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                holdMusic: { ...config.holdMusic, enabled: config.holdMusic?.enabled === false ? true : false }
                                            })}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {config.holdMusic?.enabled !== false ? (
                                                <ToggleRight className="w-10 h-10 text-primary" />
                                            ) : (
                                                <ToggleLeft className="w-10 h-10 text-muted-foreground/60" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Upload/Playback controls */}
                                    <div className={`space-y-4 p-4 bg-muted/30 border border-border/40 rounded-lg transition-all duration-200 ${
                                        config.holdMusic?.enabled === false ? 'opacity-40 pointer-events-none' : ''
                                    }`}>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hold Music File (MP3)</label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="audio/*"
                                                    onChange={(e) => handleFileUpload(e, 'holdMusic.audioFileUrl')}
                                                    className="hidden"
                                                    id="holdmusic-upload"
                                                    disabled={uploadingFile !== null || config.holdMusic?.enabled === false}
                                                />
                                                <label
                                                    htmlFor="holdmusic-upload"
                                                    className={`flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-accent text-foreground rounded-lg cursor-pointer font-medium transition-colors ${
                                                        uploadingFile === 'holdMusic.audioFileUrl' || config.holdMusic?.enabled === false ? 'opacity-50 pointer-events-none' : ''
                                                    }`}
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    {uploadingFile === 'holdMusic.audioFileUrl' ? 'Uploading...' : 'Choose MP3 File'}
                                                </label>
                                            </div>
                                            {config.holdMusic?.audioFileUrl && (
                                                <div className="flex items-center gap-2">
                                                    <audio src={config.holdMusic.audioFileUrl} controls className="h-9 max-w-xs" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAudio('holdMusic.audioFileUrl')}
                                                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                        title="Delete permanently"
                                                        disabled={config.holdMusic?.enabled === false}
                                                    >
                                                        <Trash2 className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {config.holdMusic?.audioFileUrl && (
                                            <p className="text-[10px] text-muted-foreground/80 truncate max-w-md">
                                                Current File: <a href={config.holdMusic.audioFileUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">{config.holdMusic.audioFileUrl}</a>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveConfig()}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-semibold transition-colors shadow-lg"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Hold Music Settings'}
                                </button>
                            </div>
                        )}

                        {/* TAB 4: VOICEMAIL */}
                        {activeTab === 'voicemail' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-1">Voicemail Settings</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Enable voicemail and configure where to send email notifications with voicemail recording links.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Enable / Disable Switch */}
                                    <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">Enable Company Voicemail</div>
                                            <div className="text-xs text-muted-foreground/80">Route calls to voicemail when reps do not answer.</div>
                                        </div>
                                        <button
                                            onClick={() => setConfig({
                                                ...config,
                                                voicemail: { ...config.voicemail, enabled: !config.voicemail.enabled }
                                            })}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {config.voicemail.enabled ? (
                                                <ToggleRight className="w-10 h-10 text-primary" />
                                            ) : (
                                                <ToggleLeft className="w-10 h-10 text-muted-foreground/60" />
                                            )}
                                        </button>
                                    </div>

                                    {config.voicemail.enabled && (
                                        <>
                                            {/* ── Greeting Type: Pill Choice Bar ── */}
                                            <div className="space-y-4 mt-2">
                                                <div>
                                                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Voicemail Greeting Type</div>
                                                    <div className="relative p-1 bg-muted/40 border border-border/60 rounded-xl flex gap-1">
                                                        {[
                                                            { value: false, label: '🔊 Text-to-Speech' },
                                                            { value: true, label: '🎵 Upload MP3' }
                                                        ].map(({ value, label }) => (
                                                            <button
                                                                key={label}
                                                                type="button"
                                                                onClick={() => setConfig({
                                                                    ...config,
                                                                    voicemail: { ...config.voicemail, useAudioFile: value }
                                                                })}
                                                                className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                                                                    config.voicemail.useAudioFile === value
                                                                        ? 'bg-primary text-primary-foreground shadow-md'
                                                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Text-to-Speech Panel */}
                                                {!config.voicemail.useAudioFile && (
                                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <label htmlFor="voicemail-tts" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Greeting Message (Text-to-Speech)</label>
                                                        <textarea
                                                            id="voicemail-tts"
                                                            name="voicemail-tts"
                                                            value={config.voicemail.ttsMessage || ''}
                                                            onChange={(e) => setConfig({
                                                                ...config,
                                                                voicemail: { ...config.voicemail, ttsMessage: e.target.value }
                                                            })}
                                                            className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary/60 min-h-[80px]"
                                                            placeholder="The department is busy. If you would like to leave a voicemail, please press 1."
                                                        />
                                                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            This message will be read aloud by an automated voice when a caller reaches voicemail.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Upload MP3 Panel */}
                                                {config.voicemail.useAudioFile && (
                                                    <div className="space-y-3 p-4 bg-muted/30 border border-border/40 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="text-xs text-muted-foreground/80">Upload an MP3 file to play as the voicemail greeting instead of Text-to-Speech.</div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept="audio/*"
                                                                    onChange={(e) => handleFileUpload(e, 'voicemail.audioFileUrl')}
                                                                    className="hidden"
                                                                    id="voicemail-upload"
                                                                    disabled={uploadingFile !== null}
                                                                />
                                                                <label
                                                                    htmlFor="voicemail-upload"
                                                                    className={`flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-accent text-foreground rounded-lg cursor-pointer font-medium transition-colors ${uploadingFile === 'voicemail.audioFileUrl' ? 'opacity-50 pointer-events-none' : ''}`}
                                                                >
                                                                    <Upload className="w-4 h-4" />
                                                                    {uploadingFile === 'voicemail.audioFileUrl' ? 'Uploading...' : 'Choose MP3 File'}
                                                                </label>
                                                            </div>
                                                            {config.voicemail.audioFileUrl && (
                                                                <div className="flex items-center gap-2">
                                                                    <audio src={config.voicemail.audioFileUrl} controls className="h-9 max-w-xs" />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveAudio('voicemail.audioFileUrl')}
                                                                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                                        title="Delete permanently"
                                                                    >
                                                                        <Trash2 className="w-4.5 h-4.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {config.voicemail.audioFileUrl && (
                                                            <p className="text-[10px] text-muted-foreground/80 truncate max-w-md">
                                                                Current File: <a href={config.voicemail.audioFileUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">{config.voicemail.audioFileUrl}</a>
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* ── Email Notifications Toggle ── */}
                                            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl">
                                                <div>
                                                    <div className="text-sm font-semibold text-foreground">Voicemail Email Notifications</div>
                                                    <div className="text-xs text-muted-foreground/80">Receive an email with a recording link every time a voicemail is left.</div>
                                                </div>
                                                <button
                                                    onClick={() => setConfig({
                                                        ...config,
                                                        voicemail: { ...config.voicemail, emailNotificationEnabled: !config.voicemail.emailNotificationEnabled }
                                                    })}
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {config.voicemail.emailNotificationEnabled ? (
                                                        <ToggleRight className="w-10 h-10 text-primary" />
                                                    ) : (
                                                        <ToggleLeft className="w-10 h-10 text-muted-foreground/60" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Email Address Input (visible when enabled) */}
                                            {config.voicemail.emailNotificationEnabled && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <label htmlFor="voicemail-email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send Voicemail Notifications To (Email)</label>
                                                    <input
                                                        id="voicemail-email"
                                                        name="voicemail-email"
                                                        type="email"
                                                        value={config.voicemail.emailNotification}
                                                        onChange={(e) => setConfig({
                                                            ...config,
                                                            voicemail: { ...config.voicemail, emailNotification: e.target.value }
                                                        })}
                                                        className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
                                                        placeholder="e.g. admin@yausports.com"
                                                    />
                                                    <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Requires SMTP credentials to be configured in the server environment.
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleSaveConfig()}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-semibold transition-colors shadow-lg"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Voicemail Settings'}
                                </button>
                            </div>
                        )}

                        {/* TAB 5: FALLBACK FORWARDING */}
                        {activeTab === 'forwarding' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-1">Fallback / Default Forwarding</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Configure what happens if a caller does not press any extension key within the timeout period.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {config.callRouting?.defaultForwardTo && (
                                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                    <Phone className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">Active Fallback Route</p>
                                                    <p className="text-sm font-semibold text-foreground font-mono">{config.callRouting.defaultForwardTo}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newConfig = { ...config, callRouting: { ...config.callRouting, defaultForwardTo: '' } };
                                                    setConfig(newConfig);
                                                    handleSaveConfig(newConfig);
                                                }}
                                                className="text-muted-foreground/80 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                                                title="Remove Fallback Route"
                                            >
                                                <Trash2 className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label htmlFor="default-forwardTo" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update Default Forwarding Number or Client Email</label>
                                        <input
                                            id="default-forwardTo"
                                            name="default-forwardTo"
                                            type="text"
                                            value={newForwardTo}
                                            onChange={(e) => setNewForwardTo(e.target.value)}
                                            className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary/60 font-mono"
                                            placeholder="e.g. +14105550001 or rep@yausport.com"
                                        />
                                        <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            If left blank, calls will be routed directly to voicemail if enabled.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (newForwardTo) {
                                            const newConfig = {
                                                ...config,
                                                callRouting: { ...(config.callRouting || {}), defaultForwardTo: newForwardTo }
                                            };
                                            setConfig(newConfig);
                                            handleSaveConfig(newConfig).then(() => setNewForwardTo(''));
                                        } else {
                                            handleSaveConfig();
                                        }
                                    }}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-semibold transition-colors shadow-lg"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Fallback Routing'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent className="bg-background border border-border text-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                            Delete Audio File?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-xs">
                            This action will permanently delete this audio file from the server's filesystem. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-4 py-2 text-xs border border-border">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDeleteAudio}
                            className="bg-rose-600 hover:bg-rose-700 text-foreground rounded-lg px-4 py-2 text-xs font-semibold"
                        >
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
