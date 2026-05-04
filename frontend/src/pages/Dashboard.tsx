import { useEffect, useState, useRef } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { AlertCircle, Clock, Calendar, CheckCircle, Phone, Filter, Search, Plus, Building, Megaphone, Info, ArrowRight, Mail, Send, Globe, ChevronDown, ChevronLeft, ChevronRight, X, PhoneCall } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCampaignStore } from "../store/campaignStore";
import { countryCodes } from "../utils/countryCodes";
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

interface Lead {
  _id: string;
  name: string;
  telephone?: string;
  city?: string;
  campaign_id?: string;
}

interface FollowUp {
  _id: string;
  notes: string;
  date_time: string;
  type: string;
  priority: string;
  status: string;
  lead_id_val: string;
  lead_name: string; // lead name
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
  totalLeads?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const statsRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [pipelineData, setPipelineData] = useState<Record<string, number>>({});
  const [campaignSummaries, setCampaignSummaries] = useState<any[]>([]);
  const [activeTaskTab, setActiveTaskTab] = useState<"overdue" | "due" | "upcoming">("due");
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const { campaigns, setCampaigns } = useCampaignStore();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // New Follow-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSearchIndex, setLeadSearchIndex] = useState(-1);
  const [selectedLeadResult, setSelectedLeadResult] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("Medium");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("Answered - Interested");
  const [callDuration, setCallDuration] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");

  // New Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<any>(null);
  const [emailData, setEmailData] = useState({ subject: "", body: "", cc: [] as string[] });
  const [ccInput, setCcInput] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [leadContacts, setLeadContacts] = useState<any[]>([]);

  const checkDomain = async (email: string) => {
    const domain = email.split('@')[1];
    if (!domain || verifiedDomains[domain]) return;

    try {
      const res = await api.get(`/emails/verify-domain?email=${email}`);
      setVerifiedDomains(prev => ({ ...prev, [domain]: { valid: res.data.valid, message: res.data.message } }));
    } catch { }
  };
  const [selectedContactEmail, setSelectedContactEmail] = useState("");

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Lead[]>([]);
  const [globalSearchIndex, setGlobalSearchIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [quickFollowUpErrors, setQuickFollowUpErrors] = useState<Record<string, string>>({});
  const [quickEmailErrors, setQuickEmailErrors] = useState<Record<string, string>>({});
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [campaignPage, setCampaignPage] = useState(0);
  const CAMPAIGNS_PER_PAGE = 5;

  const initiateCall = (leadToCall: Lead) => {
    const phone = leadToCall.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `${phonePrefix}${phone.replace(/\D/g, '')}`;
      window.open(`https://app.justcall.io/dialer?numbers=${encodeURIComponent(cleanPhone)}&ticket_id=${leadToCall._id}&custom_field=${leadToCall._id}&notes=${encodeURIComponent('CRM Lead ID: ' + leadToCall._id)}`, "JustCallDialer", "fullscreen=yes,location=no,width=385,height=665");
    }
    // Form already shows outcome/notes fields
    setFollowUpType("Call");
    toast.info(`Calling ${leadToCall.name}...`);
  };

  const load = async () => {
    try {
      const campaignId = selectedCampaign === "all" ? "" : selectedCampaign;
      const [resConsolidated, resDetailedFollowups] = await Promise.all([
        api.get(`/dashboard${campaignId ? `?campaignId=${campaignId}` : ""}`),
        api.get("/followups/dashboard")
      ]);

      setDashboardMetrics(resConsolidated.data);
      setRawData(resDetailedFollowups.data);
      setCampaignSummaries(resConsolidated.data.campaignSummaries);

      if (campaignId) {
        const breakdown: Record<string, number> = {};
        resConsolidated.data.leads.byStatus.forEach((s: any) => {
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
    if ((isModalOpen || isEmailModalOpen)) {
      if (leadSearch.length >= 1) {
        api.get(`/leads?q=${leadSearch}&limit=50`).then(r => {
          setLeads(r.data.data ?? r.data);
          setLeadSearchIndex(-1);
        });
      } else {
        setLeads([]);
        setLeadSearchIndex(-1);
      }
    }
  }, [leadSearch, isModalOpen, isEmailModalOpen]);

  useEffect(() => {
    if (selectedLeadForEmail) {
      api.get(`/leads/${selectedLeadForEmail._id}`).then(res => {
        const contacts = res.data.contacts || [];
        setLeadContacts(contacts);
        if (contacts.length > 0) {
          setSelectedContactEmail(contacts[0].email);
        }
      });
    }
  }, [selectedLeadForEmail]);

  useEffect(() => {
    if (globalSearch.length >= 2) {
      api.get(`/leads?q=${globalSearch}&limit=5`).then(r => {
        setGlobalSearchResults(r.data.data ?? r.data);
        setGlobalSearchIndex(-1);
      });
    } else {
      setGlobalSearchResults([]);
      setGlobalSearchIndex(-1);
    }
  }, [globalSearch]);

  const markDone = async (id: string) => {
    setTaskToComplete(id);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete) return;
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up marked as done");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
      load();
    } catch { }
  };

  const submitFollowUp = async (force = false) => {
    const errors: Record<string, string> = {};
    if (!selectedLeadResult) errors.lead = "Please select a lead first";
    if (!followUpDate) errors.date = "Follow-up date is required";

    if (Object.keys(errors).length > 0) {
      setQuickFollowUpErrors(errors);
      toast.error("Please fill all follow-up details");
      return;
    }

    try {
      // 1. Log the call activity first if an outcome is selected
      if (callOutcome) {
          try {
              const callLogRes = await api.post(`/justcall/log-call`, {
                  lead_id: selectedLeadResult?._id,
                  outcome: callOutcome,
                  notes: followUpNotes,
                  contact_name: selectedLeadResult?.name || 'Unknown'
              });
              
              if (callLogRes.data.note_id) {
                  // Attempt to fetch recording after a short delay
                  setTimeout(async () => {
                      try {
                          await api.get(`/justcall/fetch-recording/${callLogRes.data.note_id}`);
                      } catch (e) {
                          console.log('Delayed recording fetch failed:', e);
                      }
                  }, 5000);
              }
          } catch (e) {
              console.error("Failed to log call activity:", e);
          }
      }

      // 2. Schedule the follow-up
      await api.post(`/followups/${selectedLeadResult?._id}`, {
        date_time: followUpDate,
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        assigned_to: assignedTo === "other" ? customAssignedTo : assignedTo,
        force
      });
      toast.success("Activity logged & Follow-up scheduled");
      setIsModalOpen(false);
      resetFollowUpForm();
      load();
    } catch (err: any) {
      if (err.response?.status === 409) {
        if (window.confirm("Conflict detected: Another follow-up is scheduled at this time. Schedule anyway?")) {
          submitFollowUp(true);
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to schedule follow-up");
      }
    }
  };

  const resetFollowUpForm = () => {
    setSelectedLeadResult(null);
    setLeadSearch("");
    setFollowUpDate("");
    setFollowUpType("Call");
    setFollowUpPriority("Medium");
    setFollowUpNotes("");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setQuickFollowUpErrors({});
  };

  const sendQuickEmail = async () => {
    const errors: Record<string, string> = {};
    if (!selectedLeadForEmail) errors.lead = "Please select a lead first";
    else if (!selectedContactEmail) errors.contact = "Please select a recipient email";

    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.body.trim()) errors.body = "Message body is required";

    if (Object.keys(errors).length > 0) {
      setQuickEmailErrors(errors);
      toast.error("Please fill all email details");
      return;
    }

    try {
      await api.post("/emails/send", {
        lead_id: selectedLeadForEmail?._id,
        to: selectedContactEmail,
        cc: emailData.cc.join(", "),
        subject: emailData.subject,
        body: emailData.body
      });
      toast.success("Email sent successfully");
      setIsEmailModalOpen(false);
      setSelectedLeadForEmail(null);
      setEmailData({ subject: "", body: "", cc: [] });
      setCcInput("");
      setQuickEmailErrors({});
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

  if (loading) return <AppLayout><div className="p-12 text-center animate-pulse">Loading dashboard...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="bg-card border rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/campaigns?action=new-campaign")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
              title="Create New Campaign"
            >
              <Plus size={18} /> Create New Campaign
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-secondary h-11 px-6 font-semibold flex items-center gap-2"
              title="Schedule New Follow-Up"
            >
              <Clock size={18} /> New Follow-Up
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                placeholder="Search leads across all campaigns..."
                className="input-field pl-10 h-11"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setGlobalSearchIndex(prev => (prev < globalSearchResults.length - 1 ? prev + 1 : prev));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setGlobalSearchIndex(prev => (prev > 0 ? prev - 1 : prev));
                  } else if (e.key === 'Enter') {
                    if (globalSearchIndex >= 0 && globalSearchResults[globalSearchIndex]) {
                      navigate(`/lead/${globalSearchResults[globalSearchIndex]._id}`);
                      setIsSearchFocused(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchFocused(false);
                  }
                }}
              />

              {isSearchFocused && globalSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 overflow-hidden divide-y">
                  {globalSearchResults.map((l, index) => (
                    <button
                      key={l._id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(`/lead/${l._id}`);
                      }}
                      className={`w-full text-left p-3 flex items-center justify-between transition-colors ${index === globalSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                        }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{l.name}</p>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                            {campaigns.find(c => c._id === (l as any).campaign_id)?.name || "Lead"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase mt-1">
                          {l.telephone || "No Phone"} {l.city ? `• ${l.city}` : ''}
                        </p>
                      </div>
                      <ArrowRight size={14} className={index === globalSearchIndex ? "text-primary translate-x-1 transition-transform" : "text-muted-foreground"} />
                    </button>
                  ))}
                </div>
              )}
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
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 lg:w-[70%] min-w-0 space-y-6">
          <div className="page-card dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Campaign Acquisition Overview</h2>
              
              {campaigns.length > CAMPAIGNS_PER_PAGE && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCampaignPage(p => Math.max(0, p - 1))}
                    disabled={campaignPage === 0}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {campaignPage + 1} / {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                  </span>
                  <button 
                    onClick={() => setCampaignPage(p => (p + 1 < Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? p + 1 : p))}
                    disabled={campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                  >
                    <ChevronRight size={16} className="text-emerald-500" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {campaigns.slice(campaignPage * CAMPAIGNS_PER_PAGE, (campaignPage + 1) * CAMPAIGNS_PER_PAGE).map(c => {
                const summary = campaignSummaries.find(s => s._id === c._id) || { totalLeads: 0, meetingsScheduled: 0 };
                const followUpsDue = rawData?.all?.filter(f => String(f.campaign_id_val) === c._id).length || 0;
                return (
                  <div key={c._id} className="group relative bg-accent/10 dark:bg-accent/5 rounded-2xl p-4 transition-all hover:bg-accent/20 border border-transparent hover:border-primary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate text-base">{c.name}</h3>
                        <div className="grid grid-cols-3 gap-6 mt-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Leads</span>
                            <span className="text-sm font-semibold">{summary.totalLeads}</span>
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
                        onClick={() => {
                          setSelectedCampaign(c._id);
                          statsRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-10 h-10 rounded-full bg-background dark:bg-card border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm"
                        title="View Campaign Details"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {campaigns.length > CAMPAIGNS_PER_PAGE && (
              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-border/50">
                <button 
                  onClick={() => setCampaignPage(p => Math.max(0, p - 1))}
                  disabled={campaignPage === 0}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${campaignPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  PAGE {campaignPage + 1} OF {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                </span>
                <button 
                  onClick={() => setCampaignPage(p => (p + 1 < Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? p + 1 : p))}
                  disabled={campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                >
                  <ChevronRight size={18} className="text-emerald-500" />
                </button>
              </div>
            )}
          </div>

          <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Total Campaigns" count={dashboardMetrics?.campaigns?.total || 0} icon={Megaphone} color="text-primary" />
            <StatCard title="Total Leads" count={dashboardMetrics?.leads?.total || 0} icon={Building} color="text-blue-500" />
            <StatCard title="Overdue" count={dashboardMetrics?.followups?.overdue || 0} icon={AlertCircle} color="text-primary/70" />
            <StatCard title="Due Today" count={dashboardMetrics?.followups?.dueToday || 0} icon={Clock} color="text-primary/70" />
            <StatCard title="Upcoming" count={dashboardMetrics?.followups?.upcoming || 0} icon={Calendar} color="text-primary/70" />
          </div>

          {/* Strategic Pipeline Section Restored */}
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
                  const total = dashboardMetrics?.leads?.total || 1;
                  const percentage = Math.round((count / total) * 100);
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
                    return "bg-primary/40";
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
                        <div className={`h-full ${getColor(s.status)} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[30%] space-y-6">
          <div className="page-card dark:bg-card p-0 overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasks & Follow-Ups</h2>
            </div>
            <div className="flex border-b">
              {[{ id: "overdue", label: "Overdue" }, { id: "due", label: "Today" }, { id: "upcoming", label: "Upcoming" }].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTaskTab(tab.id as any)}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-tighter transition-all border-b-2 ${activeTaskTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                    }`}
                >
                  {tab.label} ({filteredData?.[tab.id as keyof typeof filteredData]?.length || 0})
                </button>
              ))}
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
              {(filteredData?.[activeTaskTab] || []).map((f) => {
                const statusStyles = {
                  overdue: "border-l-destructive bg-destructive/5",
                  due: "border-l-warning bg-warning/5",
                  upcoming: "border-l-success bg-success/5"
                }[activeTaskTab] || "border-l-border bg-accent/5";

                return (
                  <div 
                    key={f._id} 
                    title={`${f.lead_name} - ${f.type}: ${f.notes || "No notes"}`}
                    className={`border rounded-xl p-3 group flex items-start justify-between border-l-4 transition-all hover:shadow-sm ${statusStyles}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{f.lead_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{f.notes}</p>
                      <p className="text-[9px] font-medium opacity-70 mt-1">{new Date(f.date_time).toLocaleString()}</p>
                    </div>
                    <button onClick={() => markDone(f._id)} className="text-muted-foreground hover:text-success shrink-0"><CheckCircle size={16} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="page-card dark:bg-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Add Lead", icon: Plus, onClick: () => navigate("/leads/create"), color: "bg-blue-500/10 text-blue-500" },
                { label: "Log Call", icon: Phone, onClick: () => setIsModalOpen(true), color: "bg-orange-500/10 text-orange-500" },
                { label: "Send Email", icon: Mail, onClick: () => { setLeadSearch(""); setLeads([]); setIsEmailModalOpen(true); }, color: "bg-indigo-500/10 text-indigo-500" },
                { label: "Export Report", icon: Search, onClick: () => toast.info("Report generated"), color: "bg-emerald-500/10 text-emerald-500" }
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-accent/5 hover:bg-accent/20 border transition-all space-y-2 group"
                  title={action.label}
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-lg dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-lg">Log Call / Outreach</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-2">
            {!selectedLeadResult ? (
              <div className="grid gap-3">
                <label className="text-xs font-bold uppercase text-muted-foreground">Select Lead to Log</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <input
                    className={`input-field pl-9 ${quickFollowUpErrors.lead ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Search by lead name..."
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev < leads.length - 1 ? prev + 1 : prev));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev > 0 ? prev - 1 : prev));
                      } else if (e.key === 'Enter') {
                        if (leadSearchIndex >= 0 && leads[leadSearchIndex]) {
                          setSelectedLeadResult(leads[leadSearchIndex]);
                          setLeadSearch("");
                          setLeads([]);
                        }
                      }
                    }}
                  />
                </div>
                {quickFollowUpErrors.lead && <p className="text-[10px] text-destructive">{quickFollowUpErrors.lead}</p>}
                <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y">
                  {leads.map((s, index) => (
                    <button 
                      key={s._id} 
                      className={`w-full text-left p-2.5 transition-colors text-xs ${
                        index === leadSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                      }`} 
                      onClick={() => {
                        setSelectedLeadResult(s);
                        setLeadSearch("");
                        setLeads([]);
                      }}
                    >
                      <div className="font-bold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.telephone || "No phone"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Active Lead Summary */}
                <div className="p-3.5 rounded-xl bg-accent/5 border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Lead</p>
                    <h4 className="font-bold text-base text-foreground">{selectedLeadResult.name}</h4>
                    <p className="text-xs text-muted-foreground">{selectedLeadResult.telephone || "No phone"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button 
                      onClick={() => initiateCall(selectedLeadResult)}
                      className="btn-primary h-9 px-4 flex items-center gap-2 shadow-sm"
                    >
                      <Phone size={14} fill="currentColor" />
                      <span>Call Now</span>
                    </button>
                    <button className="text-[10px] font-bold text-primary hover:underline" onClick={() => setSelectedLeadResult(null)}>Change Lead</button>
                  </div>
                </div>

                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Call Outcome</label>
                    <div className="relative p-1 bg-accent/30 rounded-xl border border-border/50 flex flex-wrap gap-1">
                      {[
                        "Interested", 
                        "Not Interested", 
                        "Follow-Up Needed", 
                        "Left Voicemail", 
                        "No Answer", 
                        "Wrong Number"
                      ].map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => setCallOutcome(outcome)}
                          className={`flex-1 min-w-[100px] py-2 px-1 text-[10px] font-bold rounded-lg transition-all relative z-10 ${
                            callOutcome === outcome 
                              ? "text-primary dark:text-foreground" 
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {callOutcome === outcome && (
                            <div className="absolute inset-0 bg-white dark:bg-card shadow-sm rounded-lg -z-10 animate-in zoom-in-95 duration-200 border border-border/10" />
                          )}
                          {outcome}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} /> Next Follow-up
                    </label>
                    <input 
                      type="datetime-local" 
                      className={`input-field h-10 text-xs dark:color-scheme-dark ${quickFollowUpErrors.date ? "border-destructive focus:ring-destructive/20" : ""}`}
                      value={followUpDate} 
                      onChange={e => {
                        setFollowUpDate(e.target.value);
                        if (e.target.value) setQuickFollowUpErrors({...quickFollowUpErrors, date: ""});
                      }} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Notes & Details</label>
                  <textarea
                    className="input-field min-h-[80px] text-xs py-2.5"
                    placeholder="Briefly describe the interaction..."
                    value={followUpNotes}
                    onChange={e => setFollowUpNotes(e.target.value)}
                  />
                </div>
                <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                  <p className="text-[10px] font-medium text-center">
                    <span className="font-bold uppercase mr-1">Important:</span>
                    Ensure you click <strong>'Save'</strong> in the JustCall dialer and <strong>'Schedule Follow-up'</strong> here to sync activity.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <button className="btn-secondary h-10 px-6 rounded-lg text-xs" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn-primary h-10 px-8 rounded-lg text-xs font-bold" onClick={() => submitFollowUp()}>Schedule Follow-up</button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Send Quick Email</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {!selectedLeadForEmail ? (
              <div className="grid gap-3">
                <label className="text-sm font-semibold">Select Lead to Email</label>
                <input
                  className={`input-field ${quickEmailErrors.lead ? "border-destructive" : ""}`}
                  placeholder="Search by lead name..."
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setLeadSearchIndex(prev => (prev < leads.length - 1 ? prev + 1 : prev));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setLeadSearchIndex(prev => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === 'Enter') {
                      if (leadSearchIndex >= 0 && leads[leadSearchIndex]) {
                        setSelectedLeadForEmail(leads[leadSearchIndex]);
                      }
                    }
                  }}
                />
                {quickEmailErrors.lead && <p className="text-xs text-destructive">{quickEmailErrors.lead}</p>}
                <div className="max-h-[200px] overflow-y-auto border rounded-xl divide-y">
                  {leads.map((s, index) => (
                    <button 
                      key={s._id} 
                      className={`w-full text-left p-3 transition-colors text-sm ${
                        index === leadSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                      }`} 
                      onClick={() => setSelectedLeadForEmail(s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                  <p className="text-sm font-semibold">Sending To: {selectedLeadForEmail.name}</p>
                  <button className="text-xs text-primary font-bold" onClick={() => setSelectedLeadForEmail(null)}>Change</button>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Recipient Email <span className="text-destructive">*</span></label>
                  <select className="input-field" value={selectedContactEmail} onChange={e => setSelectedContactEmail(e.target.value)}>
                    {leadContacts.map(c => <option key={c._id} value={c.email}>{c.name} ({c.email})</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    {emailData.cc.map((email, index) => {
                      const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
                      const domain = email.split('@')[1];
                      const domainStatus = verifiedDomains[domain];
                      const isDomainInvalid = domainStatus && domainStatus.valid === false;

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setCcInput(email);
                            setEmailData({ ...emailData, cc: emailData.cc.filter((_, i) => i !== index) });
                          }}
                          title={isDomainInvalid ? `Warning: ${domainStatus.message}` : "Click to edit"}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium animate-in zoom-in-95 duration-200 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${!isValid
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : isDomainInvalid
                                ? "bg-orange-500/10 text-orange-600 border border-orange-500/30"
                                : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                        >
                          {email}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEmailData({ ...emailData, cc: emailData.cc.filter((_, i) => i !== index) });
                            }}
                            className="hover:bg-black/5 rounded-full p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px] placeholder:text-muted-foreground/50"
                      placeholder={emailData.cc.length === 0 ? "Add email and press Enter..." : ""}
                      value={ccInput}
                      onChange={e => setCcInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = ccInput.trim().replace(/,$/, '');
                          if (val && !emailData.cc.includes(val)) {
                            setEmailData({ ...emailData, cc: [...emailData.cc, val] });
                            setCcInput("");
                            checkDomain(val);
                          }
                        } else if (e.key === 'Backspace' && !ccInput && emailData.cc.length > 0) {
                          setEmailData({ ...emailData, cc: emailData.cc.slice(0, -1) });
                        }
                      }}
                      onBlur={() => {
                        const val = ccInput.trim().replace(/,$/, '');
                        if (val && !emailData.cc.includes(val)) {
                          setEmailData({ ...emailData, cc: [...emailData.cc, val] });
                          setCcInput("");
                          checkDomain(val);
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 ml-1 font-medium italic flex justify-between">
                    <span>Press Enter or Comma to add • Click a tag to edit</span>
                    {emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) && (
                      <span className="text-destructive font-semibold">One or more emails are invalid</span>
                    )}
                  </p>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Email Subject <span className="text-destructive">*</span></label>
                  <input className={`input-field ${quickEmailErrors.subject ? "border-destructive" : ""}`} value={emailData.subject} onChange={e => setEmailData({ ...emailData, subject: e.target.value })} />
                  {quickEmailErrors.subject && <p className="text-xs text-destructive">{quickEmailErrors.subject}</p>}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Message Content <span className="text-destructive">*</span></label>
                  <textarea className={`input-field min-h-[150px] ${quickEmailErrors.body ? "border-destructive" : ""}`} value={emailData.body} onChange={e => setEmailData({ ...emailData, body: e.target.value })} />
                  {quickEmailErrors.body && <p className="text-xs text-destructive">{quickEmailErrors.body}</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsEmailModalOpen(false)}>Cancel</button>
            <button
              className={`btn-primary flex items-center gap-2 ${emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendQuickEmail}
              disabled={emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e))}
            >
              <Send size={16} /> Send via Gmail
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center font-bold">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to mark this task as completed?
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsConfirmDoneOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-success hover:bg-success/90" onClick={handleConfirmDone}>Yes, Mark Done</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
