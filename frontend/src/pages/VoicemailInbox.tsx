import { useEffect, useState, useRef, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  Voicemail, Search, Trash2, Play, Phone, Clock, Calendar,
  Loader2, Inbox, AlertCircle, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoicemailItem {
  _id: string;
  fromNumber: string;
  recordingUrl: string;
  duration: number;
  callSid: string | null;
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
  onDelete: (id: string) => void;
  onListened: (id: string) => void;
}

function VoicemailTableRow({ vm, onDelete, onListened }: VoicemailCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [listened, setListened] = useState(!!vm.listenedAt);

  const handlePlay = useCallback(async () => {
    if (!listened) {
      setListened(true);
      onListened(vm._id);
    }
    setPlaying(true);
  }, [listened, vm._id, onListened]);

  const handleEnded = () => setPlaying(false);
  const handlePause = () => setPlaying(false);

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
      <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
        <div className="flex items-center justify-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${listened ? "bg-muted" : "bg-primary/20"}`}>
            <Phone className={`w-3.5 h-3.5 ${listened ? "text-muted-foreground/80" : "text-primary"}`} />
          </div>
          <span className={`font-semibold text-sm tracking-wide ${listened ? "text-muted-foreground" : "text-foreground"}`}>
            {formatPhoneNumber(vm.fromNumber)}
          </span>
        </div>
      </td>

      {/* Date & Time */}
      <td className="px-4 py-3 whitespace-nowrap align-middle text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="text-sm text-muted-foreground font-medium" title={formatAbsoluteTime(vm.createdAt)}>
            {formatRelativeTime(vm.createdAt)}
          </span>
          <span className="text-[11px] text-muted-foreground/80 uppercase tracking-wide">
            {new Date(vm.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </td>

      {/* Duration */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground align-middle text-center">
        <span className="flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
          {formatDuration(vm.duration)}
        </span>
      </td>

      {/* Recording Player */}
      <td className="px-4 py-3 min-w-[280px] align-middle text-center">
        <div className="flex items-center justify-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 border border-border/80 w-full max-w-sm mx-auto">
          <Play className={`w-3.5 h-3.5 shrink-0 ${playing ? "text-primary" : "text-muted-foreground/80"}`} />
          <audio
            ref={audioRef}
            src={vm.recordingUrl}
            controls
            onPlay={handlePlay}
            onEnded={handleEnded}
            onPause={handlePause}
            className="w-full h-7 accent-primary [&::-webkit-media-controls-panel]:bg-transparent [&::-webkit-media-controls-current-time-display]:text-zinc-300 [&::-webkit-media-controls-time-remaining-display]:text-zinc-500"
          />
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
        <button
          onClick={() => onDelete(vm._id)}
          className="p-2 rounded-lg hover:bg-rose-500/15 text-muted-foreground/80 hover:text-rose-400 transition-colors"
          title="Delete voicemail"
        >
          <Trash2 size={16} />
        </button>
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

  const filtered = voicemails.filter(v =>
    v.fromNumber.toLowerCase().includes(search.toLowerCase())
  );

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
  const todayCount = voicemails.filter(v => {
    const d = new Date(v.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }).length;

  return (
    <AppLayout>
      <div className="space-y-6 mx-auto pb-12">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Voicemail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </span>
              Voicemail Inbox
              {unreadCount > 0 && (
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-primary text-foreground ml-1">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground/80 text-sm mt-1.5 ml-0.5">
              All inbound voicemail recordings — play, review, and manage from one place.
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
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: voicemails.length, color: "text-muted-foreground" },
            { label: "Unread", value: unreadCount, color: "text-primary" },
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
            aria-label="Search voicemails by caller number"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by caller number…"
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground/60">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading voicemails…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground/60">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-muted-foreground">
                {search ? "No results found" : "No voicemails yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search ? "Try a different search term." : "Voicemails from callers will appear here automatically."}
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
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Date & Time</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Duration</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Recording</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVoicemails.map(vm => (
                    <VoicemailTableRow
                      key={vm._id}
                      vm={vm}
                      onDelete={promptDelete}
                      onListened={handleListened}
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
                  voicemails
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
    </AppLayout>
  );
}
