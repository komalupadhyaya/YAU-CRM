import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    BarChart3,
    FileSpreadsheet,
    PieChart,
    TrendingUp,
    Building,
    Megaphone,
    Sparkles,
    Eye,
    PenSquare,
    ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import ReportSubmissionCard from "../components/reports/ReportSubmissionCard";
import ClaudeFeedbackCard, { ActivityReportItem } from "../components/reports/ClaudeFeedbackCard";
import ReportsFeed from "../components/reports/ReportsFeed";
import { useSocket } from "../context/SocketContext";

interface OverviewData {
    campaigns: { total: number };
    leads: {
        total: number;
        byStatus: { status: string; count: number }[];
    };
    followups: {
        totalPending: number;
        totalCompleted: number;
        overdue: number;
        dueToday: number;
        upcoming: number;
    };
}

interface CampaignPerformance {
    campaignId: string;
    campaignName: string;
    totalLeads: number;
    totalFollowups: number;
    completedFollowups: number;
    pendingFollowups: number;
}

type TabType = "submit" | "view" | "performance";

export default function Reports() {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get("tab");

    // Map query param to one of the 3 primary toggles
    const getInitialTab = (): TabType => {
        if (rawTab === "view" || rawTab === "feed") return "view";
        if (rawTab === "submit") return "submit";
        return "performance";
    };

    const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());

    // Activity Reports State
    const [latestSubmittedReport, setLatestSubmittedReport] = useState<ActivityReportItem | null>(null);
    const [feedRefreshCounter, setFeedRefreshCounter] = useState(0);

    // Analytics State
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [performance, setPerformance] = useState<CampaignPerformance[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const isAuthorizedForAnalytics = currentUser?.role === "admin" || currentUser?.role === "manager";
    const socket = useSocket();

    // Listen for real-time AI evaluation completion for the submitted report
    useEffect(() => {
        if (!socket) return;

        const handleReportEvaluated = (data: { reportId: string; report: ActivityReportItem }) => {
            if (!data?.report) return;
            setLatestSubmittedReport(prev => {
                if (prev && (prev._id === data.report._id || prev._id === data.reportId)) {
                    return { ...prev, ...data.report };
                }
                return prev;
            });
        };

        socket.on("activity_report:evaluated", handleReportEvaluated);
        return () => {
            socket.off("activity_report:evaluated", handleReportEvaluated);
        };
    }, [socket]);

    // Synchronize query param
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    const loadAnalyticsData = async () => {
        setLoadingAnalytics(true);
        try {
            const [resOverview, resPerformance] = await Promise.all([
                api.get("/reports/overview"),
                api.get("/reports/campaign-performance")
            ]);
            setOverview(resOverview.data);
            setPerformance(resPerformance.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load analytics overview.");
        } finally {
            setLoadingAnalytics(false);
        }
    };

    useEffect(() => {
        if (activeTab === "performance" && !overview) {
            loadAnalyticsData();
        }
    }, [activeTab, overview]);

    const handleExport = (type: string) => {
        if (!isAuthorizedForAnalytics) {
            toast.error("You do not have permission to export data.");
            return;
        }
        api.get(`/reports/export?type=${type}`, { responseType: "blob" })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            })
            .catch(() => toast.error("Export failed"));
    };

    const handleReportSubmitted = (newReport: ActivityReportItem) => {
        setLatestSubmittedReport(newReport);
        setFeedRefreshCounter((prev) => prev + 1);
    };

    return (
        <AppLayout>
            <div className="p-4 pt-1 space-y-3 max-w-7xl mx-auto flex-1 flex flex-col min-h-0">
                {/* Tier 1: Unified Top Header Bar matching EmailCenter */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-2.5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight dark:text-foreground">Reports & Performance</h1>
                            <p className="text-xs text-muted-foreground">Comprehensive CRM performance overview, campaign metrics, and data exports.</p>
                        </div>
                    </div>

                    {/* Right: Primary Toggle Pills (Temporarily commented out: Submit Report and View Reports toggles pending client request) */}
                    {/*
                    <div className="flex items-center bg-accent/40 border p-1 rounded-xl shrink-0">
                        <button
                            type="button"
                            onClick={() => handleTabChange("submit")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "submit"
                                    ? "bg-primary text-white shadow-2xs font-extrabold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <PenSquare size={13} />
                            Submit Report
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTabChange("view")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "view"
                                    ? "bg-primary text-white shadow-2xs font-extrabold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Eye size={13} />
                            View Reports
                        </button>

                        {isAuthorizedForAnalytics && (
                            <button
                                type="button"
                                onClick={() => handleTabChange("performance")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === "performance"
                                        ? "bg-primary text-white shadow-2xs font-extrabold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <BarChart3 size={13} />
                                Reports & Performance
                            </button>
                        )}
                    </div>
                    */}
                </div>

                {/* ─────────────────────────────────────────────────────────────
                    TOGGLE 1: SUBMIT REPORT (Temporarily commented out)
                ────────────────────────────────────────────────────────────── */}
                {/*
                {activeTab === "submit" && (
                    <div className="space-y-4 flex-1 flex flex-col min-h-0 animate-in fade-in-50 duration-200">
                        <ReportSubmissionCard onReportSubmitted={handleReportSubmitted} />

                        {latestSubmittedReport && (
                            <div className="space-y-2 animate-in slide-in-from-top-3 duration-400">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                            Instant Claude AI Feedback & Score
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleTabChange("view")}
                                            className="text-xs text-primary hover:text-primary gap-1 h-7 px-2"
                                        >
                                            View in All Reports Feed <ArrowRight size={12} />
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => setLatestSubmittedReport(null)}
                                            className="text-[11px] text-muted-foreground hover:text-foreground underline"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                                <ClaudeFeedbackCard report={latestSubmittedReport} />
                            </div>
                        )}
                    </div>
                )}
                */}

                {/* ─────────────────────────────────────────────────────────────
                    TOGGLE 2: VIEW REPORTS (Temporarily commented out)
                ────────────────────────────────────────────────────────────── */}
                {/*
                {activeTab === "view" && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in-50 duration-200">
                        <ReportsFeed
                            currentUserRole={currentUser?.role}
                            currentUserId={currentUser?._id}
                            refreshTrigger={feedRefreshCounter}
                        />
                    </div>
                )}
                */}

                {/* ─────────────────────────────────────────────────────────────
                    TOGGLE 3: REPORTS & PERFORMANCE (CRM ANALYTICS)
                ────────────────────────────────────────────────────────────── */}
                {activeTab === "performance" && (
                    <div className="space-y-4 flex-1 flex flex-col min-h-0 animate-in fade-in-50 duration-200">
                        {/* Export Action Bar */}
                        {isAuthorizedForAnalytics && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-xl bg-card border shadow-2xs shrink-0">
                                <div>
                                    <h3 className="font-bold text-xs">CRM Data Exports</h3>
                                    <p className="text-[11px] text-muted-foreground">Download live CSV database snapshots.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 text-xs h-8"
                                        onClick={() => handleExport("leads")}
                                    >
                                        <FileSpreadsheet size={13} />
                                        Export Leads
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 text-xs h-8"
                                        onClick={() => handleExport("followups")}
                                    >
                                        <FileSpreadsheet size={13} />
                                        Export Tasks
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 text-xs h-8"
                                        onClick={() => handleExport("campaigns")}
                                    >
                                        <FileSpreadsheet size={13} />
                                        Export Campaigns
                                    </Button>
                                </div>
                            </div>
                        )}

                        {loadingAnalytics ? (
                            <div className="text-center py-12 text-muted-foreground text-xs">Loading analytics...</div>
                        ) : (
                            <>
                                {/* Overview KPI Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                                    <div className="bg-card border rounded-xl p-3.5 shadow-2xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                                                <Megaphone size={14} />
                                            </div>
                                            <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Campaigns</h3>
                                        </div>
                                        <p className="text-2xl font-bold">{overview?.campaigns?.total || 0}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Total active campaigns</p>
                                    </div>

                                    <div className="bg-card border rounded-xl p-3.5 shadow-2xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md">
                                                <Building size={14} />
                                            </div>
                                            <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Leads</h3>
                                        </div>
                                        <p className="text-2xl font-bold">{overview?.leads?.total || 0}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Across all campaigns</p>
                                    </div>

                                    <div className="bg-card border rounded-xl p-3.5 shadow-2xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="p-1.5 bg-orange-500/10 text-orange-500 rounded-md">
                                                <TrendingUp size={14} />
                                            </div>
                                            <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Tasks Pending</h3>
                                        </div>
                                        <p className="text-2xl font-bold">{overview?.followups?.totalPending || 0}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            <span className="text-red-500 font-medium">{overview?.followups?.overdue || 0} Overdue</span>
                                        </p>
                                    </div>

                                    <div className="bg-card border rounded-xl p-3.5 shadow-2xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="p-1.5 bg-green-500/10 text-green-500 rounded-md">
                                                <PieChart size={14} />
                                            </div>
                                            <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Completed</h3>
                                        </div>
                                        <p className="text-2xl font-bold">{overview?.followups?.totalCompleted || 0}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Resolved activities</p>
                                    </div>
                                </div>

                                {/* Campaign Performance Table */}
                                <div className="space-y-2 flex-1 min-h-0">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 size={16} className="text-primary" />
                                        <h2 className="text-sm font-bold">Campaign Performance</h2>
                                    </div>
                                    <div className="bg-card border rounded-xl overflow-hidden shadow-2xs">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="h-9 text-xs">Campaign Name</TableHead>
                                                    <TableHead className="h-9 text-xs">Total Leads</TableHead>
                                                    <TableHead className="h-9 text-xs">Total Tasks</TableHead>
                                                    <TableHead className="h-9 text-xs">Completed</TableHead>
                                                    <TableHead className="h-9 text-xs">Pending</TableHead>
                                                    <TableHead className="h-9 text-xs text-right">Progress</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {performance.map((p) => (
                                                    <TableRow key={p.campaignId} className="group">
                                                        <TableCell
                                                            className="py-2.5 font-medium cursor-pointer text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-2"
                                                            onClick={() => navigate(`/campaigns?campaignId=${p.campaignId}`)}
                                                        >
                                                            <Megaphone size={13} className="text-muted-foreground group-hover:text-primary opacity-50 group-hover:opacity-100 transition-all" />
                                                            {p.campaignName}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs">{p.totalLeads}</TableCell>
                                                        <TableCell className="py-2.5 text-xs">{p.totalFollowups}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-green-500 font-medium">{p.completedFollowups}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-orange-500 font-medium">{p.pendingFollowups}</TableCell>
                                                        <TableCell className="py-2.5 text-xs text-right">
                                                            <div className="w-20 bg-secondary h-1.5 rounded-full ml-auto overflow-hidden">
                                                                <div
                                                                    className="bg-primary h-full transition-all duration-500"
                                                                    style={{
                                                                        width: `${p.totalFollowups > 0 ? (p.completedFollowups / p.totalFollowups) * 100 : 0}%`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                                                {p.totalFollowups > 0 ? Math.round((p.completedFollowups / p.totalFollowups) * 100) : 0}% Done
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
