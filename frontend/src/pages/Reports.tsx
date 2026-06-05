import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { BarChart3, Download, FileSpreadsheet, PieChart, TrendingUp, Users, Building, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

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

export default function Reports() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [performance, setPerformance] = useState<CampaignPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const permissions = can(currentUser?.role);
    const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const loadData = async () => {
        try {
            const [resOverview, resPerformance] = await Promise.all([
                api.get("/reports/overview"),
                api.get("/reports/campaign-performance")
            ]);
            setOverview(resOverview.data);
            setPerformance(resPerformance.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleExport = (type: string) => {
        if (!isAuthorized) {
            toast.error("You have no authority");
            return;
        }
        // Cookie is sent automatically by the api instance (withCredentials:true)
        api.get(`/reports/export?type=${type}`, { responseType: 'blob' })
            .then(response => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            })
            .catch(() => toast.error("Export failed"));
    };

    if (loading) return <AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading reports...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 max-w-6xl mx-auto pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                        <p className="text-muted-foreground">Comprehensive CRM performance overview and data exports.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className={`gap-2 ${!isAuthorized ? "opacity-50 blur-[0.5px]" : ""}`}
                            onClick={() => handleExport('leads')}
                        >
                            <FileSpreadsheet size={16} />
                            Export Leads / Organizations
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className={`gap-2 ${!isAuthorized ? "opacity-50 blur-[0.5px]" : ""}`}
                            onClick={() => handleExport('followups')}
                        >
                            <FileSpreadsheet size={16} />
                            Export Follow-ups
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className={`gap-2 ${!isAuthorized ? "opacity-50 blur-[0.5px]" : ""}`}
                            onClick={() => handleExport('campaigns')}
                        >
                            <FileSpreadsheet size={16} />
                            Export Campaigns
                        </Button>
                    </div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <Megaphone size={20} />
                            </div>
                            <h3 className="font-semibold text-sm">Campaigns</h3>
                        </div>
                        <p className="text-3xl font-bold">{overview?.campaigns.total}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total active campaigns</p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                <Building size={20} />
                            </div>
                            <h3 className="font-semibold text-sm">Leads / Organizations</h3>
                        </div>
                        <p className="text-3xl font-bold">{overview?.leads.total}</p>
                        <p className="text-xs text-muted-foreground mt-1">Across all campaigns</p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="font-semibold text-sm">Tasks Pending</h3>
                        </div>
                        <p className="text-3xl font-bold">{overview?.followups.totalPending}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="text-red-500 font-medium">{overview?.followups.overdue} Overdue</span>
                        </p>
                    </div>

                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                                <PieChart size={20} />
                            </div>
                            <h3 className="font-semibold text-sm">Completion</h3>
                        </div>
                        <p className="text-3xl font-bold">{overview?.followups.totalCompleted}</p>
                        <p className="text-xs text-muted-foreground mt-1">Resolved activities</p>
                    </div>
                </div>

                {/* Campaign Performance Table */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-primary" />
                        <h2 className="text-xl font-bold">Campaign Performance</h2>
                    </div>
                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign Name</TableHead>
                                    <TableHead>Total Leads</TableHead>
                                    <TableHead>Total Tasks</TableHead>
                                    <TableHead>Completed</TableHead>
                                    <TableHead>Pending</TableHead>
                                    <TableHead className="text-right">Process</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {performance.map((p) => (
                                <TableRow key={p.campaignId} className="group">
                                    <TableCell 
                                        className="font-medium cursor-pointer text-foreground group-hover:text-primary transition-colors flex items-center gap-2"
                                        onClick={() => navigate(`/campaigns?campaignId=${p.campaignId}`)}
                                    >
                                        <Megaphone size={14} className="text-muted-foreground group-hover:text-primary opacity-50 group-hover:opacity-100 transition-all" />
                                        {p.campaignName}
                                    </TableCell>
                                        <TableCell>{p.totalLeads}</TableCell>
                                        <TableCell>{p.totalFollowups}</TableCell>
                                        <TableCell className="text-green-500 font-medium">{p.completedFollowups}</TableCell>
                                        <TableCell className="text-orange-500 font-medium">{p.pendingFollowups}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="w-24 bg-secondary h-1.5 rounded-full ml-auto overflow-hidden">
                                                <div
                                                    className="bg-primary h-full transition-all duration-500"
                                                    style={{ width: `${p.totalFollowups > 0 ? (p.completedFollowups / p.totalFollowups) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground mt-1 block">
                                                {p.totalFollowups > 0 ? Math.round((p.completedFollowups / p.totalFollowups) * 100) : 0}% Done
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
