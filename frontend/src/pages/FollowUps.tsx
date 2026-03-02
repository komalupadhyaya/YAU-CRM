import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Clock, AlertCircle, Calendar, CheckCircle, Phone, ArrowUpRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FollowUp {
    _id: string;
    reason: string;
    follow_up_date: string;
    status: string;
    school: {
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

    const TaskCard = ({ item }: { item: FollowUp }) => (
        <div className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${item.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                    }`}>
                    <Clock size={18} />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">
                        <Link to={`/school/${item.school._id}`} className="hover:text-primary transition-colors">
                            {item.school.name}
                        </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground border">
                            {item.campaign.name}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            <Calendar size={10} />
                            {item.follow_up_date}
                        </span>
                        {item.school.telephone && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Phone size={10} />
                                {item.school.telephone}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <Link to={`/school/${item.school._id}`}>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <Eye size={12} />
                </Button>
            </Link>
        </div>
    );

    const TaskSection = ({ title, items, icon: Icon, color }: { title: string, items: FollowUp[], icon: any, color: string }) => (
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
                    items.map(item => <TaskCard key={item._id} item={item} />)
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
                    />
                    <TaskSection
                        title="Due Today"
                        items={data?.dueToday || []}
                        icon={Clock}
                        color="bg-orange-500/10 text-orange-500"
                    />
                    <TaskSection
                        title="Upcoming"
                        items={data?.upcoming || []}
                        icon={Calendar}
                        color="bg-blue-500/10 text-blue-500"
                    />
                </div>
            </div>
        </AppLayout>
    );
}
