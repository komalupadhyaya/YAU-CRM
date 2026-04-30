import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Clock, AlertCircle, Calendar, CheckCircle, Phone, ArrowUpRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FollowUp {
    _id: string;
    notes: string;
    date_time: string;
    type: string;
    priority: string;
    status: string;
    lead: {
        _id: string;
        name: string;
        telephone?: string;
    };
    campaign: {
        _id: string;
        name: string;
    };
}

interface GroupedFollowUps {
    overdue: FollowUp[];
    dueToday: FollowUp[];
    upcoming: FollowUp[];
}

export default function FollowUps() {
    const [data, setData] = useState<GroupedFollowUps | null>(null);
    const [loading, setLoading] = useState(true);

    const loadFollowUps = async () => {
        try {
            const res = await api.get("/followups/grouped");
            setData(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load follow-ups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFollowUps();
    }, []);

    const TaskCard = ({ item, variant }: { item: FollowUp, variant: 'overdue' | 'today' | 'upcoming' }) => {
        const statusStyles = {
            overdue: "border-l-destructive bg-destructive/5",
            today: "border-l-warning bg-warning/5",
            upcoming: "border-l-success bg-success/5"
        }[variant] || "border-l-border bg-card";

        return (
            <div className={`flex items-center justify-between p-4 border rounded-lg border-l-4 hover:shadow-md transition-shadow ${statusStyles}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${item.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                        }`}>
                        <Clock size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.type || 'Task'}</span>
                            <Link to={`/lead/${item.lead._id}`} className="hover:text-primary transition-colors">
                                {item.lead?.name || 'Unknown Lead'}
                            </Link>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[10px] bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground border">
                                {item.campaign?.name || 'No Campaign'}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <Calendar size={10} />
                                {new Date(item.date_time).toLocaleString()}
                            </span>
                            {item.lead?.telephone && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Phone size={10} />
                                    {item.lead.telephone}
                                </span>
                            )}
                            {item.priority && (
                                <span className={`text-[10px] font-bold uppercase ${item.priority === 'High' ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {item.priority}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <Link to={`/lead/${item.lead._id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        <Eye size={12} />
                    </Button>
                </Link>
            </div>
        );
    };

    const TaskSection = ({ title, items, icon: Icon, color, variant }: { title: string, items: FollowUp[], icon: any, color: string, variant: 'overdue' | 'today' | 'upcoming' }) => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${color}`}>
                    <Icon size={16} />
                </div>
                <h2 className="text-lg font-bold">{title}</h2>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border">
                    {items.length}
                </span>
            </div>
            <div className="space-y-3">
                {items.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30 text-muted-foreground text-sm">
                        No {title.toLowerCase()} follow-ups.
                    </div>
                ) : (
                    items.map(item => <TaskCard key={item._id} item={item} variant={variant} />)
                )}
            </div>
        </div>
    );

    if (loading) return <AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading tasks...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 max-w-5xl mx-auto pb-12">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Follow Ups</h1>
                    <p className="text-muted-foreground">Manage and track all scheduled activities.</p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <TaskSection
                        title="Overdue"
                        items={data?.overdue || []}
                        icon={AlertCircle}
                        color="bg-red-500/10 text-red-500"
                        variant="overdue"
                    />
                    <TaskSection
                        title="Due Today"
                        items={data?.dueToday || []}
                        icon={Clock}
                        color="bg-warning/10 text-warning"
                        variant="today"
                    />
                    <TaskSection
                        title="Upcoming"
                        items={data?.upcoming || []}
                        icon={Calendar}
                        color="bg-success/10 text-success"
                        variant="upcoming"
                    />
                </div>
            </div>
        </AppLayout>
    );
}
