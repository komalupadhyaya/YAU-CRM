import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { PhoneCall, Search, RefreshCw, Loader2, Calendar, Clock, User, ExternalLink, Play, Pause, X, Trash2, PhoneIncoming, PhoneOutgoing, Sparkles, Bot, Copy, Check, FileText, Headphones, MessageSquare, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface CallItem {
  _id: string;
  callSid: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  duration: number;
  recordingUrl?: string;
  status: string;
  timestamp: string;
  source?: string;
  retellCallId?: string;
  transcript?: string;
  aiSummary?: string;
  callerSentiment?: string;
  user_id?: { _id: string; name?: string; username: string; email: string } | null;
  forwardedToUser?: { _id: string; name?: string; username: string; email: string } | null;
  forwardedToNumber?: string | null;
  forwardedToExtensionLabel?: string | null;
  lead_id?: { _id: string; name: string } | null;
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const limit = 20;

  // AI Modal States
  const [selectedAiCall, setSelectedAiCall] = useState<CallItem | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [modalTab, setModalTab] = useState<'summary' | 'transcript'>('summary');
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (modalTab === 'transcript' && aiDialogOpen) {
      const timer = setTimeout(() => {
        if (transcriptContainerRef.current) {
          transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modalTab, aiDialogOpen, selectedAiCall]);

  // Global Floating Audio Dock States
  const [playingCall, setPlayingCall] = useState<CallItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchCallHistory = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await api.get("/voice/history", {
        params: {
          page,
          limit,
          search
        }
      });
      setCalls(res.data.calls);
      setTotalPages(res.data.pages);
      setTotalCalls(res.data.total);
    } catch (err: any) {
      toast.error("Failed to load call history.");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  const handleRefresh = () => {
    fetchCallHistory(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "Unknown";
    if (phone.startsWith("client:")) return phone.replace("client:", "");
    const clean = phone.replace(/[^\d]/g, "");
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length === 11 && clean.startsWith("1")) {
      return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  const formatDuration = (secs: number) => {
    if (!secs) return "0s";
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Playback Control Actions
  const handlePlayRow = (call: CallItem) => {
    if (!call.recordingUrl) return;

    if (playingCall?._id === call._id) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play().catch(e => console.warn(e));
        }
      }
    } else {
      setPlayingCall(call);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (audioRef.current && playingCall?.recordingUrl) {
      audioRef.current.src = playingCall.recordingUrl;
      audioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  }, [playingCall]);

  const handleDeleteCallConfirm = async (id: string) => {
    try {
      await api.delete(`/voice/history/${id}`);
      toast.success("Call log deleted successfully.");
      setCalls(prev => prev.filter(c => c._id !== id));
      setTotalCalls(prev => prev - 1);
    } catch (err: any) {
      toast.error("Failed to delete call log.");
      console.error(err);
    }
  };

  const handleDeleteAllConfirm = async () => {
    try {
      await api.delete("/voice/history");
      toast.success("All call logs deleted successfully.");
      setCalls([]);
      setTotalCalls(0);
    } catch (err: any) {
      toast.error("Failed to delete all call logs.");
      console.error(err);
    }
  };

  const closeAudioDock = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingCall(null);
    setIsPlaying(false);
  };

  const handleCopyTranscript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const parseTranscriptTurns = (transcriptText: string) => {
    const rawLines = transcriptText.split('\n').map(l => l.trim()).filter(Boolean);
    const turns: Array<{ role: 'agent' | 'user'; text: string }> = [];
    let currentTurn: { role: 'agent' | 'user'; text: string } | null = null;

    for (const line of rawLines) {
      const isAgent = /^agent:|^assistant:|^bot:|^ai:/i.test(line);
      const isUser = /^user:|^caller:|^customer:|^human:/i.test(line);
      const cleanContent = line.replace(/^(agent|assistant|bot|ai|user|caller|customer|human):\s*/i, '').trim();

      if (isAgent) {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = { role: 'agent', text: cleanContent };
      } else if (isUser) {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = { role: 'user', text: cleanContent };
      } else {
        if (currentTurn) {
          currentTurn.text += '\n' + line;
        } else {
          // If transcript starts without a prefix, default to AI agent
          currentTurn = { role: 'agent', text: line };
        }
      }
    }

    if (currentTurn) {
      turns.push(currentTurn);
    }

    return turns;
  };

  const renderFormattedTranscript = (transcriptText?: string) => {
    if (!transcriptText || !transcriptText.trim()) {
      return (
        <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
          <FileText size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">No transcription text available for this call.</p>
        </div>
      );
    }

    const turns = parseTranscriptTurns(transcriptText);
    return (
      <div className="space-y-3">
        {turns.map((turn, idx) => {
          if (turn.role === 'agent') {
            return (
              <div key={idx} className="flex flex-col items-start max-w-[85%] mr-auto space-y-1">
                <span className="text-[10px] font-bold text-purple-500 mb-0.5 ml-1 flex items-center gap-1">
                  <Bot size={11} /> AI Agent
                </span>
                <div className="p-3 rounded-2xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap shadow-xs">
                  {turn.text}
                </div>
              </div>
            );
          } else {
            return (
              <div key={idx} className="flex flex-col items-end max-w-[85%] ml-auto space-y-1">
                <span className="text-[10px] font-bold text-blue-500 mb-0.5 mr-1 flex items-center gap-1">
                  <User size={11} /> Caller
                </span>
                <div className="p-3 rounded-2xl rounded-tr-sm bg-blue-500/10 border border-blue-500/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap shadow-xs">
                  {turn.text}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-4 max-w-7xl mx-auto pb-24 px-4 sm:px-6 relative">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <PhoneCall size={16} className="text-primary" />
                </span>
                Call History
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Review and audit all team member inbound and outbound call logs, durations, recordings, and Retell AI insights.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={loading || refreshing || calls.length === 0}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                    title="Delete all call history logs permanently"
                  >
                    <Trash2 size={12} />
                    Delete All
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background border border-border shadow-2xl rounded-2xl max-w-md p-6">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-bold text-foreground">
                      Permanently delete all call history?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      This action is <strong className="text-destructive font-semibold">permanent and irreversible</strong>. It will completely wipe all call records and recordings from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6 flex gap-2">
                    <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-semibold px-4 py-2 rounded-lg text-xs">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllConfirm}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold px-4 py-2 rounded-lg text-xs border border-transparent"
                    >
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                title="Refresh history logs"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {/* Controls Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Quick Metrics */}
            <div className="flex flex-wrap gap-2.5 text-xs font-semibold text-muted-foreground">
              <div className="bg-card px-3 py-1.5 border rounded-lg shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Total Logs: <span className="text-foreground font-bold">{totalCalls}</span>
              </div>
              <div className="bg-card px-3 py-1.5 border rounded-lg shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Outgoing: <span className="text-foreground font-bold">{calls.filter(c => c.direction === 'outbound').length}</span>
              </div>
              <div className="bg-card px-3 py-1.5 border rounded-lg shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Incoming: <span className="text-foreground font-bold">{calls.filter(c => c.direction === 'inbound').length}</span>
              </div>
            </div>

            {/* Search bar */}
            <div className="w-full sm:w-72 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Search size={14} />
              </span>
              <input
                id="call-history-search"
                name="call-history-search"
                type="text"
                placeholder="Search user, lead, or number..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          {/* Call Logs Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto min-w-[700px] xl:min-w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-[90px] text-center">Direction</th>
                    <th className="py-2.5 px-3 w-[140px]">Phone Number</th>
                    <th className="py-2.5 px-3">Associated Lead</th>
                    <th className="py-2.5 px-3 w-[120px] text-center">Status</th>
                    <th className="py-2.5 px-3 w-[80px] text-center">Duration</th>
                    <th className="py-2.5 px-4 w-[160px]">Date & Time</th>
                    <th className="py-2.5 px-4 w-[110px] text-center">Audio</th>
                    <th className="py-2.5 px-3 w-[110px] text-center">AI Details</th>
                    <th className="py-2.5 px-4 w-[60px] text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-border/20">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="animate-spin text-primary" />
                          <p className="text-xs font-medium">Loading call records...</p>
                        </div>
                      </td>
                    </tr>
                  ) : calls.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <p className="text-xs font-medium">No call logs found.</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {search ? "Try adjusting your search criteria." : "Call logs will appear here automatically."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => (
                      <tr key={call._id} className="hover:bg-accent/10 transition-colors">
                        {/* Direction Badge */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border ${
                                call.direction === 'inbound'
                                  ? call.duration > 0
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : call.duration > 0
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                {call.direction === 'inbound' ? (
                                  <PhoneIncoming size={15} />
                                ) : (
                                  <PhoneOutgoing size={15} />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="p-2 shadow-lg bg-popover text-popover-foreground rounded-lg border border-border">
                              <p className="text-xs font-semibold">
                                {call.direction === 'inbound'
                                  ? call.duration > 0 ? "Incoming Call (Answered)" : "Incoming Call (Missed)"
                                  : call.duration > 0 ? "Outgoing Call (Answered)" : "Outgoing Call (Declined / No Answer)"
                                }
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>

                        {/* Phone Number */}
                        <td className="py-2 px-3 font-mono font-semibold whitespace-nowrap text-foreground">
                          {formatPhoneNumber(call.direction === 'inbound' ? call.fromNumber : call.toNumber)}
                        </td>

                        {/* Associated Lead */}
                        <td className="py-2 px-3 font-medium whitespace-nowrap">
                          {call.lead_id ? (
                            <Link
                              to={`/lead/${call.lead_id._id}`}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold"
                            >
                              {call.lead_id.name}
                              <ExternalLink size={10} className="opacity-60 shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground/30 italic">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          {call.duration > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[9px] bg-red-500/10 text-red-500 border border-red-500/20">
                              Not Answered / Declined
                            </span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground font-mono font-semibold text-center">
                          {formatDuration(call.duration)}
                        </td>

                        {/* Date & Time */}
                        <td className="py-2 px-4 text-muted-foreground font-medium whitespace-nowrap">
                          {new Date(call.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>

                        {/* Audio Cell */}
                        <td className="py-2 px-4 whitespace-nowrap text-center">
                          {call.recordingUrl ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePlayRow(call)}
                                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${playingCall?._id === call._id
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                                  }`}
                              >
                                {playingCall?._id === call._id && isPlaying ? (
                                  <>
                                    <Pause size={12} className="animate-pulse" />
                                    Playing
                                  </>
                                ) : (
                                  <>
                                    <Play size={12} />
                                    Listen
                                  </>
                                )}
                              </button>
                              <a
                                href={call.recordingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95"
                                title="Open recording in new tab"
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 italic text-xs">None</span>
                          )}
                        </td>

                        {/* AI Insights Cell (Between Audio and Delete) */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          {call.aiSummary || call.transcript || call.source === 'retell' || call.retellCallId ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAiCall(call);
                                    setAiDialogOpen(true);
                                    setCopiedTranscript(false);
                                  }}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer group"
                                  title="View AI Call Details & Transcript"
                                >
                                  <Sparkles size={13} className="text-purple-500 group-hover:rotate-12 transition-transform shrink-0" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="p-4 w-96 max-w-md shadow-2xl bg-popover text-popover-foreground rounded-2xl border border-purple-500/20 backdrop-blur-md">
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                      <Sparkles size={13} className="text-purple-500 animate-pulse" /> Retell AI Voice Call
                                    </span>
                                    {call.callerSentiment && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        call.callerSentiment.toLowerCase().includes('pos')
                                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                          : call.callerSentiment.toLowerCase().includes('neg')
                                          ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                          : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                      }`}>
                                        {call.callerSentiment}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                                    <span>Duration: <strong className="text-foreground">{formatDuration(call.duration)}</strong></span>
                                    <span>•</span>
                                    <span>{new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>

                                  {call.aiSummary ? (
                                    <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15 max-h-48 overflow-y-auto">
                                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                        {call.aiSummary}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">No AI summary generated for this call.</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground/30 italic text-xs">-</span>
                          )}
                        </td>

                        {/* Delete Cell */}
                        <td className="py-2 px-4 whitespace-nowrap text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 active:scale-95"
                                title="Delete call log"
                              >
                                <Trash2 size={12} />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-background border border-border shadow-2xl rounded-2xl max-w-sm p-6">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base font-bold text-foreground">
                                  Delete this call log?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                  This will permanently remove this record from your history. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-5 flex gap-2">
                                <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-semibold px-3 py-1.5 rounded-lg text-xs">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCallConfirm(call._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold px-3 py-1.5 rounded-lg text-xs border border-transparent"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Section */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 pt-3 px-2">
              <span className="text-xs text-muted-foreground font-medium">
                Showing page <span className="font-bold text-foreground">{page}</span> of <span className="font-bold text-foreground">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-card border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-card border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Global Floating Audio Dock */}
          {playingCall && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 md:px-0">
              <div className="bg-background/95 backdrop-blur border border-primary/20 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-300">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-wider">
                    Playing Call Recording
                  </p>
                  <p className="text-[11px] font-semibold text-foreground truncate mt-0.5">
                    {playingCall.user_id && playingCall.forwardedToUser ? (
                      <span>{playingCall.user_id.name || playingCall.user_id.username} ➜ {playingCall.forwardedToUser.name || playingCall.forwardedToUser.username}</span>
                    ) : playingCall.user_id ? (
                      <span>{playingCall.user_id.name || playingCall.user_id.username}</span>
                    ) : (
                      <span>System Outbound / Inbound</span>
                    )}
                    <span className="text-muted-foreground text-[10px] ml-1.5">
                      ({formatPhoneNumber(playingCall.direction === 'inbound' ? playingCall.fromNumber : playingCall.toNumber)})
                    </span>
                  </p>
                </div>

                {/* Audio Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <audio
                    ref={audioRef}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    controls
                    className="h-8 w-44 md:w-52 accent-primary"
                  />

                  <button
                    onClick={closeAudioDock}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Close player"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Call Details Modal */}
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogContent className="max-w-2xl sm:max-w-3xl bg-card border-border shadow-2xl rounded-2xl p-0 overflow-hidden text-foreground">
              <DialogHeader className="p-5 pb-3 border-b border-border bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
                <div className="flex items-center justify-between gap-3 pr-6">
                  <DialogTitle className="text-lg font-bold flex flex-wrap items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 shadow-xs">
                      <Sparkles size={16} />
                    </span>
                    <span>Retell AI Call Details</span>

                    {selectedAiCall?.callerSentiment && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border shadow-2xs ${
                        selectedAiCall.callerSentiment.toLowerCase().includes('pos')
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : selectedAiCall.callerSentiment.toLowerCase().includes('neg')
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        Sentiment: {selectedAiCall.callerSentiment}
                      </span>
                    )}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                  <span>Phone: <strong className="text-foreground">{formatPhoneNumber(selectedAiCall?.direction === 'inbound' ? selectedAiCall?.fromNumber || '' : selectedAiCall?.toNumber || '')}</strong></span>
                  <span>•</span>
                  <span>Duration: <strong className="text-foreground">{formatDuration(selectedAiCall?.duration || 0)}</strong></span>
                  <span>•</span>
                  <span>Time: <strong className="text-foreground">{selectedAiCall?.timestamp ? new Date(selectedAiCall.timestamp).toLocaleString() : 'N/A'}</strong></span>
                </DialogDescription>
              </DialogHeader>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* 2-Mode Segmented Pill Toggle */}
                <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalTab('summary')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ease-out active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${
                      modalTab === 'summary'
                        ? 'bg-card text-foreground shadow-xs border border-border/50 scale-[1.01]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Bot size={14} className={modalTab === 'summary' ? "text-purple-600 dark:text-purple-400 transition-transform duration-300" : "transition-transform duration-300"} />
                    <span>Recording & AI Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('transcript')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ease-out active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${
                      modalTab === 'transcript'
                        ? 'bg-card text-foreground shadow-xs border border-border/50 scale-[1.01]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare size={14} className={modalTab === 'transcript' ? "text-blue-500 transition-transform duration-300" : "transition-transform duration-300"} />
                    <span>Full Call Transcript</span>
                  </button>
                </div>

                {modalTab === 'summary' ? (
                  <div className="space-y-4 animate-in fade-in-0 slide-in-from-left-3 duration-300 ease-out fill-mode-both">
                    {/* Audio Player if recording available */}
                    {selectedAiCall?.recordingUrl ? (
                      <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Headphones size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">Call Audio Recording</p>
                            <p className="text-[10px] text-muted-foreground">{formatDuration(selectedAiCall.duration)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <audio controls src={selectedAiCall.recordingUrl} className="h-8 max-w-full sm:w-60 accent-primary" />
                          <a
                            href={selectedAiCall.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            title="Open audio in new tab"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-muted/20 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                        No audio recording available for this call.
                      </div>
                    )}

                    {/* AI Summary Card */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        <Bot size={14} />
                        <span>AI Call Summary</span>
                      </div>
                      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-foreground leading-relaxed shadow-xs">
                        {selectedAiCall?.aiSummary ? (
                          <p className="whitespace-pre-wrap">{selectedAiCall.aiSummary}</p>
                        ) : (
                          <p className="text-muted-foreground italic">No AI summary generated for this call.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Full Transcript Tab */
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-right-3 duration-300 ease-out fill-mode-both">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <MessageSquare size={14} />
                      <span>Full Call Transcript</span>
                    </div>

                    <div ref={transcriptContainerRef} className="p-3.5 rounded-xl bg-muted/30 border border-border max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                      {renderFormattedTranscript(selectedAiCall?.transcript)}
                    </div>
                  </div>
                )}

                {/* Technical Meta Footer */}
                {selectedAiCall?.retellCallId && (
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-[10px] text-muted-foreground gap-2">
                    <span>Retell Call ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">{selectedAiCall.retellCallId}</code></span>
                    <span>Source: <span className="font-semibold uppercase text-foreground">{selectedAiCall.source || 'retell'}</span></span>
                  </div>
                )}
              </div>

              <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-end">
                <button
                  onClick={() => setAiDialogOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all shadow-2xs"
                >
                  Close
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
