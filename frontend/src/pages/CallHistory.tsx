import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { PhoneCall, Search, RefreshCw, Loader2, Calendar, Clock, User, ExternalLink, Play, Pause, X, Trash2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
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
  user_id?: { _id: string; name?: string; username: string; email: string } | null;
  forwardedToUser?: { _id: string; name?: string; username: string; email: string } | null;
  forwardedToNumber?: string | null;
  forwardedToExtensionLabel?: string | null;
  lead_id?: { _id: string; name: string } | null;
  
  // AI Call Fields
  aiHandled?: boolean;
  retellCallId?: string;
  transcript?: string;
  callSummary?: string;
  userSentiment?: 'positive' | 'neutral' | 'negative' | null;
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAiCall, setSelectedAiCall] = useState<CallItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const limit = 20;

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
                Review and audit all team member inbound and outbound call logs, durations, and audio recordings.
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
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3 w-[130px]">Phone Number</th>
                    <th className="py-2.5 px-3">Associated Lead</th>
                    <th className="py-2.5 px-3 w-[120px] text-center">Status</th>
                    <th className="py-2.5 px-3 w-[80px] text-center">Duration</th>
                    <th className="py-2.5 px-4 w-[160px]">Date & Time</th>
                    <th className="py-2.5 px-4 w-[120px] text-center">Audio</th>
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

                        {/* Team Member */}
                        <td className="py-2 px-3 font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            {/* Initiator */}
                            {call.aiHandled ? (
                              <button
                                onClick={() => setSelectedAiCall(call)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all shadow-sm active:scale-95"
                                title="Click to view AI receptionist audit logs"
                              >
                                🤖 AI Voice
                              </button>
                            ) : call.user_id ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-foreground cursor-help border-b border-dotted border-muted-foreground/30 hover:text-primary transition-colors">
                                    {call.user_id.name || call.user_id.username}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-2.5 max-w-xs shadow-lg bg-popover text-popover-foreground rounded-lg border border-border">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                      {call.forwardedToUser || call.forwardedToNumber || call.forwardedToExtensionLabel ? "Initiating Agent" : "Team Member"}
                                    </p>
                                    <p className="font-semibold">{call.user_id.name || call.user_id.username}</p>
                                    <p className="text-xs text-muted-foreground font-normal">{call.user_id.email}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : call.forwardedToExtensionLabel ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-foreground cursor-help border-b border-dotted border-muted-foreground/30 hover:text-primary transition-colors">
                                    {call.forwardedToExtensionLabel}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-2.5 max-w-xs shadow-lg bg-popover text-popover-foreground rounded-lg border border-border">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">IVR Extension / Department</p>
                                    <p className="font-semibold">{call.forwardedToExtensionLabel}</p>
                                    {call.forwardedToNumber && (
                                      <p className="text-xs text-muted-foreground font-normal">
                                        Forwarded number: {formatPhoneNumber(call.forwardedToNumber)}
                                      </p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground/60 italic font-normal">
                                {call.direction === 'inbound' ? 'Unrouted / System' : 'System Outbound'}
                              </span>
                            )}

                            {/* Forwarded Target */}
                            {(call.user_id || (!call.user_id && !call.forwardedToExtensionLabel)) && (call.forwardedToUser || call.forwardedToNumber || call.forwardedToExtensionLabel) && (
                              <>
                                <span className="text-muted-foreground/60 font-bold select-none">➜</span>
                                {call.forwardedToUser ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-blue-500 cursor-help border-b border-dotted border-blue-500/30 hover:text-blue-600 transition-colors">
                                        {call.forwardedToUser.name || call.forwardedToUser.username}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-2.5 max-w-xs shadow-lg bg-popover text-popover-foreground rounded-lg border border-border">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Forwarded Target</p>
                                        <p className="font-semibold">{call.forwardedToUser.name || call.forwardedToUser.username}</p>
                                        <p className="text-xs text-muted-foreground font-normal">{call.forwardedToUser.email}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : call.forwardedToExtensionLabel ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-blue-500 cursor-help border-b border-dotted border-blue-500/30 hover:text-blue-600 transition-colors">
                                        {call.forwardedToExtensionLabel}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-2.5 max-w-xs shadow-lg bg-popover text-popover-foreground rounded-lg border border-border">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Forwarded Extension</p>
                                        <p className="font-semibold">{call.forwardedToExtensionLabel}</p>
                                        {call.forwardedToNumber && (
                                          <p className="text-xs text-muted-foreground font-normal">
                                            Phone: {formatPhoneNumber(call.forwardedToNumber)}
                                          </p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-blue-500 font-semibold" title="Forwarded phone number">
                                    {formatPhoneNumber(call.forwardedToNumber || '')}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
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

          {/* Retell AI Details Dialog */}
          {selectedAiCall && (
            <AlertDialog open={!!selectedAiCall} onOpenChange={(open) => { if(!open) setSelectedAiCall(null); }}>
              <AlertDialogContent className="bg-background border border-border shadow-2xl rounded-2xl max-w-2xl p-6 overflow-hidden flex flex-col max-h-[90vh] z-[99999]">
                <AlertDialogHeader className="flex flex-row items-center justify-between border-b border-border pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <span>🤖</span>
                    </span>
                    <div>
                      <AlertDialogTitle className="text-base font-bold text-foreground">
                        AI Receptionist Call Audit
                      </AlertDialogTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                        Call ID: {selectedAiCall.retellCallId || selectedAiCall.callSid}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAiCall(null)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X size={16} />
                  </button>
                </AlertDialogHeader>

                <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1.5 scrollbar-thin">
                  {/* Summary & Sentiment Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border bg-card/60 flex flex-col justify-between h-20">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sentiment</span>
                      <span className={`text-xs font-semibold mt-1 w-fit px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        selectedAiCall.userSentiment === 'positive' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : selectedAiCall.userSentiment === 'negative'
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                      }`}>
                        {selectedAiCall.userSentiment === 'positive' ? '🟢 Positive' : selectedAiCall.userSentiment === 'negative' ? '🔴 Negative' : '🟡 Neutral'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border bg-card/60 flex flex-col justify-between h-20 sm:col-span-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Summary</span>
                      <p className="text-xs text-foreground font-semibold mt-1 leading-relaxed line-clamp-3">
                        {selectedAiCall.callSummary || 'No summary generated for this call.'}
                      </p>
                    </div>
                  </div>

                  {/* Transcript Scroll */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span>📄</span> Conversation Transcript
                    </h3>
                    <div className="bg-slate-950/90 dark:bg-slate-950/80 border border-border/80 rounded-xl p-4 max-h-[350px] overflow-y-auto space-y-3 font-mono text-[11px] leading-relaxed">
                      {selectedAiCall.transcript ? (
                        selectedAiCall.transcript.split('\n').map((line, idx) => {
                          const isAi = line.toLowerCase().startsWith('agent:') || line.toLowerCase().startsWith('ai:') || line.toLowerCase().startsWith('assistant:');
                          const isUser = line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('caller:') || line.toLowerCase().startsWith('customer:');
                          
                          let cleanLine = line;
                          if (isAi) cleanLine = line.replace(/^(agent|ai|assistant):\s*/i, '');
                          if (isUser) cleanLine = line.replace(/^(user|caller|customer):\s*/i, '');

                          return (
                            <div key={idx} className={`flex flex-col ${isAi ? 'items-start' : isUser ? 'items-end' : 'items-start'}`}>
                              <span className="text-[9px] text-muted-foreground/60 mb-0.5">
                                {isAi ? '🤖 AI Receptionist' : isUser ? '📞 Caller' : 'System'}
                              </span>
                              <div className={`p-2.5 rounded-xl max-w-[85%] whitespace-pre-wrap ${
                                isAi 
                                  ? 'bg-slate-800 text-slate-100 rounded-tl-none' 
                                  : isUser 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-slate-900 text-slate-450'
                              }`}>
                                {cleanLine}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-10 italic">No transcript recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                <AlertDialogFooter className="border-t border-border pt-3 shrink-0 flex items-center justify-between gap-3">
                  {selectedAiCall.recordingUrl ? (
                    <audio src={selectedAiCall.recordingUrl} controls className="h-9 max-w-full flex-1 border border-border/40 rounded-lg p-0.5 bg-card" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">No recording audio.</span>
                  )}
                  <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-xs font-semibold border border-border">
                    Close Audit
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
