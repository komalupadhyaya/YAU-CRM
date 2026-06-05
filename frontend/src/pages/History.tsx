import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { History, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AssignmentHistoryItem {
    _id: string;
    lead_id: { _id: string; name: string } | null;
    assigned_by: { _id: string; name?: string; username: string } | null;
    assigned_from: { _id: string; name?: string; username: string } | null;
    assigned_to: { _id: string; name?: string; username: string } | null;
    timestamp: string;
    createdAt: string;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<AssignmentHistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    const loadHistory = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get("/leads/assignment-history");
            setHistory(res.data);
        } catch {
            toast.error("Failed to load assignment history");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const filteredHistory = history.filter(item => {
        const leadName = item.lead_id?.name || "";
        const assignedBy = item.assigned_by?.name || item.assigned_by?.username || "";
        const assignedFrom = item.assigned_from?.name || item.assigned_from?.username || "None";
        const assignedTo = item.assigned_to?.name || item.assigned_to?.username || "None";
        
        const searchLower = searchQuery.toLowerCase();
        return (
            leadName.toLowerCase().includes(searchLower) ||
            assignedBy.toLowerCase().includes(searchLower) ||
            assignedFrom.toLowerCase().includes(searchLower) ||
            assignedTo.toLowerCase().includes(searchLower)
        );
    });

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-5">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                                <History size={16} className="text-primary" />
                            </span>
                            Lead Assignment History
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Track changes to lead ownership and assignments across your organization.
                        </p>
                    </div>
                </div>

                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-primary" />
                            <h2 className="text-sm font-bold">Assignment Logs</h2>
                        </div>
                        <div className="w-full sm:w-64 relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                                <Search size={14} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search logs..."
                                className="input-field pl-9 pr-4 py-1.5 text-xs dark:bg-card w-full"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b bg-muted/30 text-xs font-bold text-muted-foreground">
                                    <th className="p-4">Lead / Organization</th>
                                    <th className="p-4">Assigned By</th>
                                    <th className="p-4">Assigned From</th>
                                    <th className="p-4">Assigned To</th>
                                    <th className="p-4 text-right">Date & Time</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-muted-foreground">
                                            <Loader2 size={16} className="animate-spin inline mr-2 text-primary" />
                                            Loading assignment history...
                                        </td>
                                    </tr>
                                ) : filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-muted-foreground">
                                            No assignment history logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHistory.map((item) => (
                                        <tr key={item._id} className="hover:bg-accent/10">
                                            <td className="p-4 font-bold text-foreground">
                                                {item.lead_id?.name || "Deleted Lead"}
                                            </td>
                                            <td className="p-4 text-muted-foreground">
                                                {item.assigned_by?.name || item.assigned_by?.username || "System"}
                                            </td>
                                            <td className="p-4">
                                                {item.assigned_from ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                                                        {item.assigned_from.name || item.assigned_from.username}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic">None / Unassigned</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {item.assigned_to ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                                                        {item.assigned_to.name || item.assigned_to.username}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic">None / Unassigned</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right text-muted-foreground">
                                                {new Date(item.timestamp || item.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
