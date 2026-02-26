import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { AlertCircle, Clock, Calendar, CheckCircle, Phone, Filter, Search, Plus, School as SchoolIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawData, setRawData] = useState<DashboardData | null>(null);
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

  const [schoolCounts, setSchoolCounts] = useState({ totalSchools: 0, contactedSchools: 0 });

  const load = async () => {
    try {
      const [resData, resCampaigns] = await Promise.all([
        api.get("/followups/dashboard"),
        api.get("/campaigns")
      ]);
      setRawData(resData.data);
      setCampaigns(resCampaigns.data);
    } catch { }
    setLoading(false);
  };

  const loadCounts = async () => {
    if (selectedCampaign === "all") return;
    try {
      const res = await api.get(`/schools/campaign/${selectedCampaign}/school-counts`);
      setSchoolCounts(res.data);
    } catch { }
  };

  useEffect(() => {
    load();
    if (searchParams.get("action") === "new-followup") {
      setIsModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  useEffect(() => {
    loadCounts();
  }, [selectedCampaign]);

  useEffect(() => {
    if (isModalOpen && schoolSearch.length >= 2) {
      api.get(`/schools?q=${schoolSearch}`).then(r => setSchools(r.data));
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

  // Filter data based on selected campaign
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
    <div className="stat-card dark:bg-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="text-3xl font-bold text-foreground">{count}</div>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your pending outreach tasks.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 text-sm px-4 h-10"
          >
            <Plus size={16} /> New Follow-up
          </button>

          <div className="flex items-center gap-2 bg-card border rounded-xl px-3 py-1.5 shadow-sm h-10">
            <Filter size={14} className="text-muted-foreground" />
            <select
              className="bg-transparent text-sm font-medium focus:outline-none min-w-[150px] dark:bg-card"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Overdue" count={filteredData?.overdue.length || 0} icon={AlertCircle} color="text-destructive" />
        <StatCard title="Due Today" count={filteredData?.due.length || 0} icon={Clock} color="text-warning" />
        <StatCard title="Upcoming" count={filteredData?.upcoming.length || 0} icon={Calendar} color="text-primary" />
      </div>

      {/* Outreach Progress (New) */}
      {selectedCampaign !== "all" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="stat-card bg-primary/5 dark:bg-primary/10 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-primary/80">Total Schools</span>
              <SchoolIcon size={18} className="text-primary" />
            </div>
            <div className="text-3xl font-bold text-foreground">{schoolCounts.totalSchools}</div>
            <p className="text-xs text-muted-foreground mt-1">Schools in this campaign</p>
          </div>
          <div className="stat-card bg-success/5 dark:bg-success/10 border-success/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-success/80">Contacted Schools</span>
              <CheckCircle size={18} className="text-success" />
            </div>
            <div className="text-3xl font-bold text-foreground">{schoolCounts.contactedSchools}</div>
            <p className="text-xs text-muted-foreground mt-1">Schools with status other than "Not Contacted"</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FollowUpCard title="Overdue" list={filteredData?.overdue || []} emptyMsg="No overdue follow-ups." />
        <FollowUpCard title="Due Today" list={filteredData?.due || []} emptyMsg="Nothing scheduled for today." />
      </div>

      <div className="mt-8">
        <FollowUpCard title="Upcoming" list={filteredData?.upcoming || []} emptyMsg="Pipeline is clear." />
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
