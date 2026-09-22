import { useState, useEffect, useCallback } from "react";
import api from "../../api/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Search,
    Filter,
    Calendar,
    Users,
    ChevronDown,
    ChevronUp,
    Sparkles,
    User,
    Clock,
    RefreshCw,
    TrendingUp,
    FileText,
    ArrowUpDown
} from "lucide-react";
import ClaudeFeedbackCard, {
    ActivityReportItem,
    getScoreColor
} from "./ClaudeFeedbackCard";
import { useSocket } from "../../context/SocketContext";

function stripHtmlTags(html: string): string {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}

interface ReportsFeedProps {
    currentUserRole?: string;
    currentUserId?: string;
    refreshTrigger?: number;
    onViewDetail?: (report: ActivityReportItem) => void;
}

interface TeamMember {
    _id: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
}

export default function ReportsFeed({
    currentUserRole = "sales_rep",
    currentUserId = "",
    refreshTrigger = 0
}: ReportsFeedProps) {
    const [reports, setReports] = useState<ActivityReportItem[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<ActivityReportItem | null>(null);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    // Filters
    const [search, setSearch] = useState("");
    const [reportType, setReportType] = useState<string>("all");
    const [selectedUser, setSelectedUser] = useState<string>("all");
    const [dateRange, setDateRange] = useState<string>("7d");
    const [summary, setSummary] = useState({
        totalVisible: 0,
        dailyCount: 0,
        weeklyCount: 0,
        averageScore: null as number | null
    });

    const isManagement = currentUserRole === "admin" || currentUserRole === "manager";

    // Load team members for filter dropdown if manager/admin
    useEffect(() => {
        if (isManagement) {
            api.get("/team")
                .then(res => setTeamMembers(res.data || []))
                .catch(err => console.warn("Failed to load team members for filter:", err));
        }
    }, [isManagement]);

    // Fetch reports
    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (reportType !== "all") params.reportType = reportType;
            if (selectedUser !== "all") params.userId = selectedUser;
            if (dateRange !== "all") params.dateRange = dateRange;
            if (search.trim()) params.search = search.trim();

            const res = await api.get("/activity-reports", { params });
            setReports(res.data?.reports || []);
            if (res.data?.summary) {
                setSummary(res.data.summary);
            }
        } catch (err: any) {
            console.error("Failed to load reports feed:", err);
            toast.error("Failed to load activity reports feed.");
        } finally {
            setLoading(false);
        }
    }, [reportType, selectedUser, dateRange, search]);

    const socket = useSocket();

    useEffect(() => {
        loadReports();
    }, [loadReports, refreshTrigger]);

    // Update evaluated reports in real-time without refetching entire feed
    useEffect(() => {
        if (!socket) return;

        const handleReportEvaluated = (data: { reportId: string; report: ActivityReportItem }) => {
            if (!data?.report) return;
            setReports(prev =>
                prev.map(r => (r._id === data.report._id || r._id === data.reportId ? { ...r, ...data.report } : r))
            );
        };

        socket.on("activity_report:evaluated", handleReportEvaluated);
        return () => {
            socket.off("activity_report:evaluated", handleReportEvaluated);
        };
    }, [socket]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* KPI Summary Ribbon (Compact, Low-Profile) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
                <div className="rounded-xl border border-border/80 bg-card/60 px-3.5 py-2 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {isManagement ? "Total Submissions" : "My Reports"}
                        </p>
                        <p className="text-lg font-black text-foreground">{summary.totalVisible}</p>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-md">Logged</span>
                </div>

                <div className="rounded-xl border border-border/80 bg-card/60 px-3.5 py-2 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daily Reports</p>
                        <p className="text-lg font-black text-blue-500">{summary.dailyCount}</p>
                    </div>
                    <span className="text-[10px] font-medium text-blue-500/80 bg-blue-500/10 px-2 py-0.5 rounded-md">Daily</span>
                </div>

                <div className="rounded-xl border border-border/80 bg-card/60 px-3.5 py-2 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Weekly Reports</p>
                        <p className="text-lg font-black text-purple-500">{summary.weeklyCount}</p>
                    </div>
                    <span className="text-[10px] font-medium text-purple-500/80 bg-purple-500/10 px-2 py-0.5 rounded-md">Weekly</span>
                </div>

                <div className="rounded-xl border border-border/80 bg-card/60 px-3.5 py-2 shadow-2xs flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Claude Score</p>
                        <div className="flex items-center gap-1">
                            <span className={`text-lg font-black ${summary.averageScore != null ? (summary.averageScore >= 8 ? "text-emerald-500" : summary.averageScore >= 7 ? "text-sky-500" : "text-amber-500") : "text-muted-foreground"}`}>
                                {summary.averageScore != null ? summary.averageScore.toFixed(1) : "—"}
                            </span>
                            {summary.averageScore != null && <span className="text-[10px] text-muted-foreground">/10</span>}
                        </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded-md">Claude AI</span>
                </div>
            </div>

            {/* Context Header & Compact Filter Bar */}
            <div className="rounded-xl border border-border/80 bg-card/80 p-2 px-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-2.5 shrink-0">
                <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search report, author, feedback..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background/50 rounded-lg"
                        />
                    </div>

                    {/* Team Member Filter (Management Only) */}
                    {isManagement && teamMembers.length > 0 && (
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            aria-label="Filter reports by team member"
                            className="h-8 px-2.5 rounded-lg border border-input bg-background/50 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring max-w-[170px]"
                        >
                            <option value="all">
                                {currentUserRole === "manager" ? "All Sales Reps & Me" : "All Team Members"}
                            </option>
                            {(currentUserRole === "manager"
                                ? teamMembers.filter(m => m.role === "sales_rep" || m._id === currentUserId)
                                : teamMembers
                            ).map(m => (
                                <option key={m._id} value={m._id}>
                                    {m.name || m.username || m.email} {m._id === currentUserId ? "(Me)" : ""}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Report Type Selector */}
                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        aria-label="Filter reports by type"
                        className="h-8 px-2.5 rounded-lg border border-input bg-background/50 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                        <option value="all">All Types</option>
                        <option value="daily">Daily Reports</option>
                        <option value="weekly">Weekly Reports</option>
                    </select>

                    {/* Date Range Selector */}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        aria-label="Filter reports by date range"
                        className="h-8 px-2.5 rounded-lg border border-input bg-background/50 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                        <option value="7d">📅 Last 7 Days</option>
                        <option value="today">📅 Today</option>
                        <option value="14d">📅 Last 14 Days</option>
                        <option value="30d">📅 Last 30 Days</option>
                        <option value="all">📅 All Time</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadReports()}
                        disabled={loading}
                        className="gap-1.5 h-8 rounded-lg text-xs px-2.5"
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Feed List */}
            {loading ? (
                <div className="rounded-2xl border border-border bg-card/50 p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={24} className="animate-spin text-primary" />
                    <p className="text-sm">Loading activity reports...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <FileText size={32} className="opacity-40" />
                    <p className="font-semibold text-foreground text-sm">No activity reports found</p>
                    <p className="text-xs max-w-sm">
                        {search || reportType !== "all" || selectedUser !== "all" || dateRange !== "all"
                            ? `No reports matching your filters${dateRange === "7d" ? " for the last 7 days" : ""}. Try adjusting your filters or switching to "All Time".`
                            : "Submit your first report using the text box above to get started!"}
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5 flex-1">
                    {reports.map((report) => {
                        const isExpanded = !!expandedIds[report._id];
                        const isDaily = report.reportType === "daily";
                        const score = report.aiFeedback?.performanceScore;
                        const dateFormatted = new Date(report.submissionDate || Date.now()).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        });

                        return (
                            <div
                                key={report._id}
                                className="rounded-xl border border-border/80 bg-card shadow-2xs hover:border-border transition-all overflow-hidden"
                            >
                                {/* Item Header */}
                                <div className="p-2.5 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-full bg-primary text-white border border-primary/20 flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 select-none">
                                            {report.userName ? report.userName.charAt(0).toUpperCase() : "U"}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-xs text-foreground">{report.userName}</span>
                                                <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0 border-border">
                                                    {report.userRole.replace("_", " ")}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] uppercase font-semibold px-1.5 py-0 ${
                                                        isDaily
                                                            ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                                                            : "border-purple-500/40 text-purple-400 bg-purple-500/10"
                                                    }`}
                                                >
                                                    {isDaily ? "Daily" : "Weekly"}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                                <Clock size={10} />
                                                <span>{dateFormatted}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Score Pill & Action Buttons */}
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        {score != null ? (
                                            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold ${getScoreColor(score)}`}>
                                                <Sparkles size={11} />
                                                <span>{score.toFixed(1)}/10</span>
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                No Score
                                            </Badge>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedReport(report)}
                                            className="text-xs gap-1 h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                        >
                                            Full Feedback
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleExpand(report._id)}
                                            className="h-7 w-7 p-0"
                                        >
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Report Snippet */}
                                <div className="p-3 px-3.5 text-xs text-foreground/90 leading-relaxed font-sans">
                                    <div className="bg-secondary/20 rounded-lg p-2.5 px-3 border border-border/30">
                                        {isExpanded ? (
                                            /<[a-z][\s\S]*>/i.test(report.rawContent) ? (
                                                <div
                                                    className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground/90 leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-1 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-blue-400 [&_h3]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_li]:my-0.5"
                                                    dangerouslySetInnerHTML={{ __html: report.rawContent }}
                                                />
                                            ) : (
                                                <div className="whitespace-pre-wrap">{report.rawContent}</div>
                                            )
                                        ) : (
                                            <div className="line-clamp-2 text-xs text-foreground/80">
                                                {/<[a-z][\s\S]*>/i.test(report.rawContent)
                                                    ? stripHtmlTags(report.rawContent)
                                                    : report.rawContent}
                                            </div>
                                        )}
                                    </div>

                                    {/* Inline Feedback Preview if available and expanded */}
                                    {isExpanded && report.aiFeedback && (
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <ClaudeFeedbackCard report={report} compact />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detailed Report Modal */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl border-border">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Sparkles size={18} className="text-primary" />
                            Activity Report & Claude Evaluation
                        </DialogTitle>
                    </DialogHeader>
                    {selectedReport && (
                        <div className="mt-2">
                            <ClaudeFeedbackCard report={selectedReport} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
