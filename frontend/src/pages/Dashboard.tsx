import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { AlertCircle, Clock, Calendar, CheckCircle, Phone, Filter, Search, Plus, School as SchoolIcon, Megaphone } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Campaign {
  _id: string;
  name: string;
}

interface School {
  _id: string;
  name: string;
  telephone?: string;
}

interface FollowUp {
  _id: string;
  reason: string;
  follow_up_date: string;
  school_id_val: string;
  school_name: string;
  telephone?: string;
  campaign_name: string;
  campaign_id_val: string;
}

interface DashboardData {
  overdue: FollowUp[];
  due: FollowUp[];
  upcoming: FollowUp[];
  all: FollowUp[];
  totalCampaigns?: number;
  totalSchools?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [pipelineData, setPipelineData] = useState<Record<string, number>>({});
  const [campaignSummaries, setCampaignSummaries] = useState<any[]>([]);
  const [activeTaskTab, setActiveTaskTab] = useState<"overdue" | "due" | "upcoming">("due");
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // New Follow-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  const load = async () => {
    try {
      const campaignId = selectedCampaign === "all" ? "" : selectedCampaign;
      const [resConsolidated, resDetailedFollowups, resCampaigns] = await Promise.all([
        api.get(`/dashboard${campaignId ? `?campaignId=${campaignId}` : ""}`),
        api.get("/followups/dashboard"),
        api.get("/campaigns")
      ]);

      setDashboardMetrics(resConsolidated.data);
      setRawData(resDetailedFollowups.data);
      setCampaigns(resCampaigns.data);
      setCampaignSummaries(resConsolidated.data.campaignSummaries);

      if (campaignId) {
        const breakdown: Record<string, number> = {};
        resConsolidated.data.schools.byStatus.forEach((s: any) => {
          breakdown[s.status] = s.count;
        });
        setPipelineData(breakdown);
      } else {
        setPipelineData({});
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (searchParams.get("action") === "new-followup") {
      setIsModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, selectedCampaign]);

  useEffect(() => {
    if (isModalOpen && schoolSearch.length >= 2) {
      api.get(`/schools?q=${schoolSearch}&limit=50`).then(r => setSchools(r.data.data ?? r.data));
    }
  }, [schoolSearch, isModalOpen]);

  const markDone = async (id: string) => {
    try {
      await api.put(`/followups/${id}/complete`);
      toast.success("Follow-up marked as done");
      load();
    } catch { }
  };

  const submitFollowUp = async () => {
    if (!selectedSchool || !followUpDate) return;
    try {
      await api.post(`/followups/${selectedSchool}`, {
        follow_up_date: followUpDate,
        reason: followUpReason
      });
      toast.success("Follow-up scheduled");
      setIsModalOpen(false);
      setSelectedSchool(null);
      setFollowUpDate("");
      setFollowUpReason("");
      load();
    } catch { }
  };

  // Filter list for the detailed panels
  const filterList = (list: FollowUp[]) => {
    if (selectedCampaign === "all") return list;
    return list.filter(f => String(f.campaign_id_val) === selectedCampaign);
  };

  const filteredData = rawData ? {
    overdue: filterList(rawData.overdue),
    due: filterList(rawData.due),
    upcoming: filterList(rawData.upcoming),
    all: filterList(rawData.all)
  } : null;

  const StatCard = ({ title, count, icon: Icon, color }: { title: string; count: number; icon: any; color: string }) => (
    <div className="stat-card border-none bg-accent/20 dark:bg-card/40 flex flex-col items-center text-center p-6 transition-all hover:bg-accent/30">
      <div className="w-10 h-10 rounded-full bg-background dark:bg-background/20 flex items-center justify-center mb-3">
        <Icon size={20} className={color} />
      </div>
      <div className="text-2xl font-bold text-foreground">{count}</div>
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">{title}</span>
    </div>
  );

  const FollowUpCard = ({ title, list, emptyMsg }: { title: string; list: FollowUp[]; emptyMsg: string }) => (
    <div className="page-card dark:bg-card">
      <h2 className="font-semibold text-foreground mb-4 flex items-center justify-between">
        {title}
        <span className="text-xs px-2 py-0.5 bg-accent dark:bg-accent/20 rounded-full text-muted-foreground">{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">{emptyMsg}</p>
      ) : (
        <div className="divide-y divide-border">
          {list.map((f) => (
            <div key={f._id} className="py-4 group">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <Link to={`/campaigns`} className="font-medium text-foreground hover:text-primary transition-colors block">
                    {f.school_name || "Unknown School"}
                  </Link>
                  <p className="text-sm text-foreground/80 dark:text-foreground/70 mt-1">{f.reason || "No reason provided"}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                      <Calendar size={10} /> {new Date(f.follow_up_date + 'T00:00:00').toLocaleDateString()}
                    </span>
                    {f.telephone && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                        <Phone size={10} /> {f.telephone}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{f.campaign_name}</span>
                  </div>
                </div>
                <button
                  onClick={() => markDone(f._id)}
                  className="p-2 text-muted-foreground hover:text-success hover:bg-success/10 rounded-full transition-all self-end sm:self-start"
                  title="Mark as Done"
                >
                  <CheckCircle size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) return <AppLayout><div className="p-12 text-center animate-pulse">Loading dashboard...</div></AppLayout>;

  return (
    <AppLayout>
      {/* Top Controls Bar */}
      <div className="bg-card border rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/campaigns?action=new-campaign")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              <Plus size={18} /> Create New Campaign
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-secondary h-11 px-6 font-semibold flex items-center gap-2"
            >
              <Clock size={18} /> New Follow-Up
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                placeholder="Search schools..."
                className="input-field pl-10 h-11"
              />
            </div>

            <div className="flex items-center gap-2 h-11 px-3 bg-accent/30 border rounded-xl min-w-[150px]">
              <Filter size={14} className="text-muted-foreground" />
              <select
                className="bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none flex-1"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
              >
                <option className="dark:bg-accent" value="all">All Campaigns</option>
                {campaigns.map(c => (
                  <option className="dark:bg-accent" key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 h-11 px-3 bg-accent/30 border rounded-xl min-w-[120px]">
              <Filter size={14} className="text-muted-foreground" />
              <select className="bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none flex-1">
                <option className="dark:bg-accent" value="me">Assigned to Me</option>
                <option className="dark:bg-accent" value="all">All Reps</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN (70%) */}
        <div className="flex-1 lg:w-[70%] min-w-0 space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Total Campaigns" count={dashboardMetrics?.campaigns?.total || 0} icon={Megaphone} color="text-primary" />
            <StatCard title="Total Schools" count={dashboardMetrics?.schools?.total || 0} icon={SchoolIcon} color="text-blue-500" />
            <StatCard title="Overdue" count={dashboardMetrics?.followups?.overdue || 0} icon={AlertCircle} color="text-primary/70" />
            <StatCard title="Due Today" count={dashboardMetrics?.followups?.dueToday || 0} icon={Clock} color="text-primary/70" />
            <StatCard title="Upcoming" count={dashboardMetrics?.followups?.upcoming || 0} icon={Calendar} color="text-primary/70" />
          </div>

          {/* Campaign Overview */}

          <div className="page-card dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Campaign Acquisition Overview</h2>
              <Link to="/campaigns" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline flex items-center gap-1">
                View All <Plus size={12} />
              </Link>
            </div>

            <div className="space-y-4">
              {campaigns.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl">
                  <p className="text-sm text-muted-foreground">No campaigns yet. Create your first campaign to begin school acquisition.</p>
                </div>
              ) : (
                campaigns.slice(0, 5).map(c => {
                  const summary = campaignSummaries.find(s => s._id === c._id) || { totalSchools: 0, meetingsScheduled: 0 };
                  const followUpsDue = rawData?.all.filter(f => String(f.campaign_id_val) === c._id).length || 0;

                  return (
                    <div key={c._id} className="group relative bg-accent/10 dark:bg-accent/5 rounded-2xl p-4 transition-all hover:bg-accent/20 border border-transparent hover:border-primary/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground truncate text-base">{c.name}</h3>
                          <div className="grid grid-cols-3 gap-6 mt-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Schools</span>
                              <span className="text-sm font-semibold">{summary.totalSchools}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Meetings</span>
                              <span className="text-sm font-semibold text-primary">{summary.meetingsScheduled}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Follow-ups</span>
                              <span className="text-sm font-semibold">{followUpsDue}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedCampaign(c._id)}
                          className="w-10 h-10 rounded-full bg-background dark:bg-card border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm"
                          title="View Campaign Details"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pipeline Overview */}
          <div className="page-card dark:bg-card">
            <h2 className="text-lg font-bold text-foreground mb-6">Strategic Pipeline</h2>
            {selectedCampaign === "all" ? (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl">
                <p className="text-sm text-muted-foreground">Select a campaign to view the strategic pipeline visualization.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(dashboardMetrics?.pipeline?.statusBreakdown || []).map((s: any) => {
                  const count = s.count || 0;
                  const total = dashboardMetrics?.schools?.total || 1;
                  const percentage = Math.round((count / total) * 100);

                  // Color mapping helper
                  const getColor = (label: string) => {
                    const l = label.toLowerCase();
                    if (l.includes("not contacted")) return "bg-muted-foreground/20";
                    if (l.includes("attempted")) return "bg-orange-400";
                    if (l.includes("voicemail")) return "bg-orange-500";
                    if (l.includes("office") || l.includes("staff") || l.includes("spoke")) return "bg-blue-400";
                    if (l.includes("meeting")) return "bg-emerald-500";
                    if (l.includes("proposal") || l.includes("info sent")) return "bg-indigo-500";
                    if (l.includes("signed") || l.includes("active")) return "bg-primary";
                    if (l.includes("not interested") || l.includes("lost")) return "bg-destructive/40";
                    return "bg-primary/40"; // Default
                  };

                  return (
                    <div key={s.status} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getColor(s.status)}`} />
                          {s.status}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{count}</span>
                          <span className="text-[10px] text-muted-foreground">({percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-accent dark:bg-accent/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color} transition-all duration-1000`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (30%) */}
        <div className="w-full lg:w-[30%] space-y-6">
          {/* Tasks & Follow-Ups */}
          <div className="page-card dark:bg-card p-0 overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasks & Follow-Ups</h2>
            </div>
            <div className="flex border-b">
              {[
                { id: "overdue", label: "Overdue", color: "text-destructive" },
                { id: "due", label: "Today", color: "text-foreground" },
                { id: "upcoming", label: "Upcoming", color: "text-muted-foreground" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTaskTab(tab.id as any)}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-tighter transition-all border-b-2 ${activeTaskTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:bg-accent/10"
                    }`}
                >
                  {tab.label} ({filteredData?.[tab.id as keyof typeof filteredData]?.length || 0})
                </button>
              ))}
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
              {(filteredData?.[activeTaskTab] || []).length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">No tasks in this category.</p>
                </div>
              ) : (
                (filteredData?.[activeTaskTab] || []).map((f) => (
                  <div key={f._id} className="bg-accent/5 dark:bg-accent/5 border rounded-xl p-3 group transition-all hover:border-primary/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/school/${f.school_id_val}`} className="text-xs font-bold hover:text-primary truncate block">
                          {f.school_name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{f.reason || "Scheduled follow-up"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-medium bg-background px-1.5 py-0.5 rounded border">Rep: Admin</span>
                          <span className="text-[9px] text-muted-foreground">{new Date(f.follow_up_date + 'T00:00:00').toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => markDone(f._id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-success hover:bg-success/10 transition-all shrink-0"
                      >
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="page-card dark:bg-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Add School", icon: Plus, onClick: () => navigate("/schools/create"), color: "bg-blue-500/10 text-blue-500" },
                { label: "Log Call", icon: Phone, onClick: () => setIsModalOpen(true), color: "bg-orange-500/10 text-orange-500" },
                { label: "Send Email", icon: AlertCircle, onClick: () => toast.info("Email integration coming soon"), color: "bg-indigo-500/10 text-indigo-500" },
                { label: "Export Report", icon: Search, onClick: () => toast.info("Report generated"), color: "bg-emerald-500/10 text-emerald-500" }
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-accent/5 hover:bg-accent/20 border transition-all space-y-2 group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${action.color}`}>
                    <action.icon size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Follow-up Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[90vw] max-w-lg md:w-full dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Quick Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!selectedSchool ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Search School</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    className="input-field pl-10"
                    placeholder="Type school name..."
                    value={schoolSearch}
                    onChange={e => setSchoolSearch(e.target.value)}
                  />
                </div>
                <div className="mt-2 max-h-[200px] overflow-y-auto border rounded-xl divide-y dark:border-border/20">
                  {schools.map(s => (
                    <button
                      key={s._id}
                      className="w-full text-left p-3 hover:bg-accent dark:hover:bg-accent/20 transition-colors text-sm dark:text-foreground"
                      onClick={() => setSelectedSchool(s._id)}
                    >
                      {s.name} {s.telephone && <span className="text-xs text-muted-foreground ml-2">({s.telephone})</span>}
                    </button>
                  ))}
                  {schoolSearch.length >= 2 && schools.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground text-center">No schools found.</p>
                  )}
                  {schoolSearch.length < 2 && (
                    <p className="p-3 text-xs text-muted-foreground text-center">Type at least 2 characters to search.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-accent/40 dark:bg-accent/10 p-3 rounded-xl border dark:border-border/20">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Target School</p>
                    <p className="text-sm font-semibold dark:text-foreground">{schools.find(s => s._id === selectedSchool)?.name}</p>
                  </div>
                  <button className="text-xs text-primary hover:underline" onClick={() => setSelectedSchool(null)}>Change</button>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Follow-up Date</label>
                  <input
                    type="date"
                    className="input-field dark:color-scheme-dark"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Note / Reason</label>
                  <textarea
                    className="input-field min-h-[80px]"
                    placeholder="What needs to happen?"
                    value={followUpReason}
                    onChange={(e) => setFollowUpReason(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!selectedSchool || !followUpDate}
              onClick={submitFollowUp}
            >
              Schedule Follow-up
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
