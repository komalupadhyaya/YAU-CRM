import { useEffect, useState, useRef, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  Voicemail, Search, Trash2, Phone, Clock,
  Loader2, Inbox, AlertCircle, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal,
  Bot, Sparkles, FileText, Copy, MessageSquare, PhoneForwarded, Check, ExternalLink,
  User, Headphones, Play, Pause, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoicemailItem {
  _id: string;
  fromNumber: string;
  callerName?: string | null;
  recordingUrl: string;
  duration: number;
  callSid: string | null;
  retellCallId?: string | null;
  source?: 'retell' | 'twilio' | null;
  targetDepartment?: string | null;
  targetNumber?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
  callerSentiment?: string | null;
  lead_id?: string | null;
  ea_lead_id?: string | null;
  listenedAt: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  });
}

function formatPhoneNumber(raw: string): string {
  if (!raw) return "Unknown";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// ─── Voicemail Card ───────────────────────────────────────────────────────────

interface VoicemailCardProps {
  vm: VoicemailItem;
  playingVm: VoicemailItem | null;
  isPlaying: boolean;
  onPlayRow: (vm: VoicemailItem) => void;
  onDelete: (id: string) => void;
  onListened: (id: string) => void;
  onViewTranscript: (vm: VoicemailItem) => void;
}

function VoicemailTableRow({ vm, playingVm, isPlaying, onPlayRow, onDelete, onListened, onViewTranscript }: VoicemailCardProps) {
  const listened = !!vm.listenedAt;

  return (
    <tr className={`border-b border-border/50 hover:bg-accent/50 transition-colors ${!listened ? 'bg-primary/5 hover:bg-primary/10' : ''}`}>
      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap w-12 align-middle text-center">
        {!listened ? (
          <div className="flex items-center justify-center">
             <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm" title="Unread" />
          </div>
        ) : (
          <div className="flex items-center justify-center" title={`Listened ${formatRelativeTime(vm.listenedAt || new Date().toISOString())}`}>
             <CheckCircle2 className="w-4 h-4 text-muted-foreground/60" />
          </div>
        )}
      </td>

      {/* Caller */}
      <td className="px-4 py-3 align-middle text-center">
        <div className="flex items-center justify-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            listened ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
          }`}>
            <Phone className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className={`font-semibold text-sm tracking-wide ${listened ? "text-muted-foreground" : "text-foreground"}`}>
              {vm.callerName || formatPhoneNumber(vm.fromNumber)}
            </span>
            {vm.callerName && (
              <span className="text-xs text-muted-foreground font-mono">
                {formatPhoneNumber(vm.fromNumber)}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Department */}
      <td className="px-4 py-3 align-middle whitespace-nowrap min-w-[150px]">
        <div className="flex flex-col items-start gap-1">
          {vm.targetDepartment ? (
            <Badge variant="outline" className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
              <PhoneForwarded className="w-3 h-3" />
              <span>{vm.targetDepartment}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground bg-muted/60 border-border px-2 py-0.5 rounded-full">
              General Inbound
            </Badge>
          )}

          {vm.targetNumber && (
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 pl-0.5">
              <Phone className="w-2.5 h-2.5 text-muted-foreground/70" />
              {formatPhoneNumber(vm.targetNumber)}
            </span>
          )}
        </div>
      </td>

      {/* AI Summary with Full Hover Tooltip (Compact width) */}
      <td className="px-4 py-3 align-middle max-w-[220px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              onClick={() => (vm.aiSummary || vm.transcript) && onViewTranscript(vm)}
              className="cursor-pointer group rounded-lg p-1.5 -m-1.5 hover:bg-muted/50 transition-colors"
            >
              {vm.aiSummary ? (
                <p className="text-xs text-foreground/90 line-clamp-1 leading-relaxed group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                  {vm.aiSummary}
                </p>
              ) : vm.transcript ? (
                <p className="text-xs text-muted-foreground line-clamp-1 italic leading-relaxed truncate">
                  "{vm.transcript}"
                </p>
              ) : (
                <span className="text-xs text-muted-foreground italic">Standard Voicemail</span>
              )}
            </div>
          </TooltipTrigger>

          {(vm.aiSummary || vm.transcript) && (
            <TooltipContent 
              side="top" 
              align="start" 
              className="max-w-md p-4 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-xl space-y-2 text-foreground"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-purple-600 dark:text-purple-400">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Full AI Voicemail Summary</span>
                </div>
                {vm.targetDepartment && (
                  <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                    {vm.targetDepartment}
                  </Badge>
                )}
              </div>

              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {vm.aiSummary || vm.transcript}
              </p>

              <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Caller: {vm.callerName || formatPhoneNumber(vm.fromNumber)}</span>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </td>

      {/* Duration */}
      <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
        <span className="text-xs font-mono text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground/70" />
          {formatDuration(vm.duration)}
        </span>
      </td>

      {/* Date & Time */}
      <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground font-medium" title={formatAbsoluteTime(vm.createdAt)}>
            {formatRelativeTime(vm.createdAt)}
          </span>
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">
            {new Date(vm.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </td>

      {/* Audio */}
      <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
        {vm.recordingUrl ? (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onPlayRow(vm)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                playingVm?._id === vm._id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {playingVm?._id === vm._id && isPlaying ? (
                <>
                  <Pause size={12} className="animate-pulse" />
                  <span>Playing</span>
                </>
              ) : (
                <>
                  <Play size={12} />
                  <span>Listen</span>
                </>
              )}
            </button>
            <a
              href={vm.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Open recording in new tab"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/40 italic">No Audio</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          {(vm.transcript || vm.aiSummary) && (
            <button
              onClick={() => onViewTranscript(vm)}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="View Full Transcript & Summary"
            >
              <FileText size={16} />
            </button>
          )}

          {vm.fromNumber && (
            <a
              href={`tel:${vm.fromNumber}`}
              className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
              title={`Call Back: ${vm.fromNumber}`}
            >
              <Phone size={15} />
            </a>
          )}

          <button
            onClick={() => onDelete(vm._id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-muted-foreground/80 hover:text-rose-400 transition-colors"
            title="Delete voicemail"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoicemailInbox() {
  const [voicemails, setVoicemails] = useState<VoicemailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Global Floating Audio Dock States (matching Call History)
  const [playingVm, setPlayingVm] = useState<VoicemailItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const floatingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Transcript Dialog Modal State
  const [selectedVmForTranscript, setSelectedVmForTranscript] = useState<VoicemailItem | null>(null);
  const [modalTab, setModalTab] = useState<'summary' | 'transcript'>('summary');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

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
          currentTurn = { role: 'agent', text: line };
        }
      }
    }

    if (currentTurn) {
      turns.push(currentTurn);
    }

    return turns;
  };

  const renderFormattedTranscript = (transcriptText?: string | null) => {
    if (!transcriptText || !transcriptText.trim()) {
      return (
        <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
          <FileText size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">No transcription text available for this voice message.</p>
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

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const res = await api.get("/voice/voicemails");
      setVoicemails(res.data);
    } catch {
      toast.error("Failed to load voicemails.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleListened = useCallback(async (id: string) => {
    try {
      const res = await api.patch(`/voice/voicemails/${id}/listened`);
      setVoicemails(prev => prev.map(v => v._id === id ? res.data : v));
    } catch {
      // silent – non-critical
    }
  }, []);

  // Global Audio Dock Playback Controls
  const handlePlayRow = useCallback((vm: VoicemailItem) => {
    if (!vm.recordingUrl) return;

    if (!vm.listenedAt) {
      handleListened(vm._id);
    }

    if (playingVm?._id === vm._id) {
      if (floatingAudioRef.current) {
        if (isPlaying) {
          floatingAudioRef.current.pause();
        } else {
          floatingAudioRef.current.play().catch(e => console.warn(e));
        }
      }
    } else {
      setPlayingVm(vm);
      setIsPlaying(true);
    }
  }, [playingVm, isPlaying, handleListened]);

  const closeAudioDock = () => {
    if (floatingAudioRef.current) {
      floatingAudioRef.current.pause();
    }
    setPlayingVm(null);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (floatingAudioRef.current && playingVm?.recordingUrl) {
      floatingAudioRef.current.src = playingVm.recordingUrl;
      floatingAudioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  }, [playingVm]);

  const promptDelete = (id: string) => {
    setDeleteTargetId(id);
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/voice/voicemails/${deleteTargetId}`);
      setVoicemails(prev => prev.filter(v => v._id !== deleteTargetId));
      toast.success("Voicemail deleted.");
    } catch {
      toast.error("Failed to delete voicemail.");
    } finally {
      setDeleteTargetId(null);
      setConfirmOpen(false);
    }
  };

  const handleDeleteAllConfirm = async () => {
    try {
      await api.delete("/voice/voicemails");
      setVoicemails([]);
      toast.success("All voicemails deleted successfully.");
    } catch {
      toast.error("Failed to delete all voicemails.");
    }
  };

  const handleCopyTranscript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const filtered = voicemails.filter(v => {
    const q = search.toLowerCase();
    return (
      v.fromNumber.toLowerCase().includes(q) ||
      (v.callerName && v.callerName.toLowerCase().includes(q)) ||
      (v.targetDepartment && v.targetDepartment.toLowerCase().includes(q)) ||
      (v.aiSummary && v.aiSummary.toLowerCase().includes(q)) ||
      (v.transcript && v.transcript.toLowerCase().includes(q))
    );
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, voicemails]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedVoicemails = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");

      pages.push(totalPages);
    }
    return pages;
  };

  const unreadCount = voicemails.filter(v => !v.listenedAt).length;
  const aiMessageCount = voicemails.filter(v => v.source === 'retell' || Boolean(v.transcript || v.aiSummary)).length;
  const todayCount = voicemails.filter(v => {
    const d = new Date(v.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }).length;

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="space-y-6 mx-auto pb-12">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Voicemail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </span>
              Voicemail & AI Message Inbox
              {unreadCount > 0 && (
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-primary text-foreground ml-1">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground/80 text-sm mt-1.5 ml-0.5">
              Review inbound voicemails, AI-transcribed messages, and unattended call forward recordings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={loading || refreshing || voicemails.length === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                  title="Delete all voicemails permanently"
                >
                  <Trash2 size={12} />
                  Delete All
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background border border-border shadow-2xl rounded-2xl max-w-md p-6 text-foreground">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-lg font-bold text-foreground">
                    Permanently delete all voicemails?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    This action is <strong className="text-destructive font-semibold">permanent and irreversible</strong>. It will completely wipe all voicemail records and their audio recording references from the database.
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
              onClick={() => load(true)}
              disabled={refreshing}
              className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-all active:scale-95 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-all duration-300 group-active:-rotate-180 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Messages", value: voicemails.length, color: "text-foreground" },
            { label: "Unread", value: unreadCount, color: "text-primary" },
            { label: "AI Messages", value: aiMessageCount, color: "text-purple-500" },
            { label: "Today", value: todayCount, color: "text-sky-400" },
          ].map(s => (
            <div key={s.label} className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
          <input
            id="voicemail-search"
            name="voicemail-search"
            type="text"
            aria-label="Search voicemails by caller, name, department, or summary"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by caller name, number, department, or message text…"
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground/60">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground/60">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-muted-foreground">
                {search ? "No results found" : "No voicemails or AI messages yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search ? "Try a different search term." : "Messages left by callers will appear here automatically."}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border/80">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 w-12 text-center">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Caller</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Department</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 max-w-[220px]">AI Summary</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Duration</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Date & Time</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Audio</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVoicemails.map(vm => (
                    <VoicemailTableRow
                      key={vm._id}
                      vm={vm}
                      playingVm={playingVm}
                      isPlaying={isPlaying}
                      onPlayRow={handlePlayRow}
                      onDelete={promptDelete}
                      onListened={handleListened}
                      onViewTranscript={(selected) => setSelectedVmForTranscript(selected)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && filtered.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 sm:px-6 bg-card border border-border/60 rounded-xl">
            <div className="flex flex-1 justify-between sm:hidden w-full mb-4 sm:mb-0">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                Next
              </Button>
            </div>
            
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between w-full">
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 select-none">
                  Showing
                  <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">
                    {((currentPage - 1) * itemsPerPage) + 1}
                  </span>
                  to
                  <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">
                    {Math.min(currentPage * itemsPerPage, filtered.length)}
                  </span>
                  of
                  <span className="font-semibold text-foreground px-0.5">
                    {filtered.length}
                  </span>
                  messages
                </p>
              </div>
              <div>
                <div className="inline-flex gap-1.5 font-sans" aria-label="Pagination">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-border text-muted-foreground hover:bg-accent transition-colors"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  
                  {getPageNumbers().map((page, idx) => {
                    if (page === "...") {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground/80 select-none"
                        >
                          <MoreHorizontal size={14} />
                        </span>
                      );
                    }
                    const pageNum = page as number;
                    return (
                      <Button
                        key={`page-${pageNum}`}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 text-xs transition-all ${
                          currentPage === pageNum
                            ? "bg-primary hover:bg-emerald-600 text-foreground shadow-sm font-semibold border-transparent"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-border text-muted-foreground hover:bg-accent transition-colors"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Transcript / Summary Modal ── */}
      <Dialog open={!!selectedVmForTranscript} onOpenChange={(open) => !open && setSelectedVmForTranscript(null)}>
        <DialogContent className="max-w-2xl sm:max-w-3xl bg-card border-border shadow-2xl rounded-2xl p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-5 pb-3 border-b border-border bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle className="text-lg font-bold flex flex-wrap items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 shadow-xs">
                  <Sparkles size={16} />
                </span>
                <span>Retell AI Voicemail & Call Details</span>

                {selectedVmForTranscript?.callerSentiment && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border shadow-2xs ${
                    selectedVmForTranscript.callerSentiment.toLowerCase().includes('pos')
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : selectedVmForTranscript.callerSentiment.toLowerCase().includes('neg')
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    Sentiment: {selectedVmForTranscript.callerSentiment}
                  </span>
                )}

                {selectedVmForTranscript?.targetDepartment && (
                  <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                    Dept: {selectedVmForTranscript.targetDepartment}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
              <span>Caller: <strong className="text-foreground">{selectedVmForTranscript?.callerName || formatPhoneNumber(selectedVmForTranscript?.fromNumber || "")}</strong></span>
              <span>•</span>
              <span>Phone: <strong className="text-foreground font-mono">{formatPhoneNumber(selectedVmForTranscript?.fromNumber || "")}</strong></span>
              <span>•</span>
              <span>Duration: <strong className="text-foreground">{formatDuration(selectedVmForTranscript?.duration || 0)}</strong></span>
              <span>•</span>
              <span>Time: <strong className="text-foreground">{selectedVmForTranscript?.createdAt ? formatAbsoluteTime(selectedVmForTranscript.createdAt) : "N/A"}</strong></span>
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
                {/* Audio Recording Player */}
                {selectedVmForTranscript?.recordingUrl ? (
                  <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Headphones size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Voicemail Audio Recording</p>
                        <p className="text-[10px] text-muted-foreground">{formatDuration(selectedVmForTranscript.duration)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <audio controls src={selectedVmForTranscript.recordingUrl} className="h-8 max-w-full sm:w-60 accent-primary" />
                      <a
                        href={selectedVmForTranscript.recordingUrl}
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
                    No audio recording attached to this message.
                  </div>
                )}

                {/* AI Summary Card */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <Bot size={14} />
                    <span>AI Key Voicemail Summary</span>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-foreground leading-relaxed shadow-xs">
                    {selectedVmForTranscript?.aiSummary ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedVmForTranscript.aiSummary}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No AI summary generated for this voicemail.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Full Transcript Tab */
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-right-3 duration-300 ease-out fill-mode-both">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <MessageSquare size={14} />
                    <span>Full Call Transcript</span>
                  </div>
                  {selectedVmForTranscript?.transcript && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyTranscript(selectedVmForTranscript.transcript || "")}
                      className="h-7 text-xs gap-1"
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedTranscript ? "Copied" : "Copy Transcript"}
                    </Button>
                  )}
                </div>

                <div ref={transcriptContainerRef} className="p-3.5 rounded-xl bg-muted/30 border border-border max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                  {renderFormattedTranscript(selectedVmForTranscript?.transcript)}
                </div>
              </div>
            )}

            {/* Technical Meta Footer */}
            {selectedVmForTranscript?.retellCallId && (
              <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-[10px] text-muted-foreground gap-2">
                <span>Retell Call ID: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">{selectedVmForTranscript.retellCallId}</code></span>
                <span>Source: <span className="font-semibold uppercase text-foreground">{selectedVmForTranscript.source || 'retell'}</span></span>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedVmForTranscript?.fromNumber && (
                <a
                  href={`tel:${selectedVmForTranscript.fromNumber}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Back ({formatPhoneNumber(selectedVmForTranscript.fromNumber)})
                </a>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedVmForTranscript(null)}
              className="text-xs font-semibold px-4"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-background border border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Delete Voicemail?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              This will permanently remove this voicemail recording from the inbox. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-4 py-2 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-rose-600 hover:bg-rose-700 text-foreground rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Floating Audio Dock (matching Call History) */}
      {playingVm && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 md:px-0">
          <div className="bg-background/95 backdrop-blur-md border border-primary/30 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Playing Voicemail Recording
              </p>
              <p className="text-[11px] font-semibold text-foreground truncate mt-0.5">
                <span>{playingVm.callerName || formatPhoneNumber(playingVm.fromNumber)}</span>
                {playingVm.targetDepartment && (
                  <span className="text-muted-foreground text-[10px] ml-1.5 font-normal">
                    • {playingVm.targetDepartment}
                  </span>
                )}
                <span className="text-muted-foreground text-[10px] ml-1 font-mono">
                  ({formatPhoneNumber(playingVm.fromNumber)})
                </span>
              </p>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <audio
                ref={floatingAudioRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                controls
                className="h-8 w-44 md:w-52 accent-primary"
              />

              <button
                onClick={closeAudioDock}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Close player"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
      </TooltipProvider>
    </AppLayout>
  );
}
