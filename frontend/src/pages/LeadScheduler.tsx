import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search,
  UserCheck,
  UserMinus,
  Loader2,
  Users,
  Check,
  AlertCircle,
  Building2,
  Layers,
  Layers3
} from "lucide-react";

interface Campaign {
  _id: string;
  name: string;
}

interface AssignedUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Lead {
  _id: string;
  name: string;
  type?: string;
  status: string;
  campaign_id?: Campaign | null;
  assigned_to?: AssignedUser | null;
  main_contact_name?: string;
  main_contact_email?: string;
}

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

function UserAvatar({ user, size = "sm" }: { user: any; size?: "sm" | "md" }) {
  if (!user || typeof user !== "object" || !user.name) {
    const defaultText = typeof user === "string" ? "A" : "?";
    const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-sm";
    return (
      <span
        className={`${sizeClass} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 ring-1 ring-primary/30`}
      >
        {defaultText}
      </span>
    );
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-sm";
  return (
    <span
      className={`${sizeClass} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 ring-1 ring-primary/30`}
      title={user.name}
    >
      {initials}
    </span>
  );
}

export default function LeadScheduler() {
  const { currentUser } = useAuth();
  
  // Selection states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [campaignLeads, setCampaignLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  
  const [isAssigning, setIsAssigning] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Fetch campaigns and team members on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [campaignsRes, teamRes] = await Promise.all([
          api.get("/campaigns"),
          api.get("/team")
        ]);
        setCampaigns(campaignsRes.data || []);
        setTeamMembers(teamRes.data.filter((m: TeamMember) => m.isActive));
      } catch {
        toast.error("Failed to load initial data");
      } finally {
        setLoadingCampaigns(false);
        setLoadingTeam(false);
      }
    };
    initData();
  }, []);

  // Fetch leads of selected campaign
  useEffect(() => {
    if (!selectedCampaign) {
      setCampaignLeads([]);
      return;
    }
    const fetchCampaignLeads = async () => {
      setLoadingLeads(true);
      try {
        const res = await api.get(`/leads/campaign/${selectedCampaign._id}`);
        setCampaignLeads(res.data || []);
      } catch {
        toast.error("Failed to load campaign leads");
      } finally {
        setLoadingLeads(false);
      }
    };
    fetchCampaignLeads();
  }, [selectedCampaign]);

  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaigns.find(c => c._id === campaignId) || null;
    setSelectedCampaign(campaign);
    setSelectedLeadIds([]);
    setSelectedMember(null);
    setSearchQuery("");
  };

  const handleToggleLead = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleAssign = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsAssigning(true);
    try {
      await api.patch("/leads/assign-bulk", {
        leadIds: selectedLeadIds,
        assigned_to: selectedMember?._id ?? null
      });
      
      toast.success(
        selectedMember
          ? `Successfully assigned ${selectedLeadIds.length} leads to ${selectedMember.name}`
          : `Successfully unassigned ${selectedLeadIds.length} leads`
      );

      // Reload campaign leads list
      if (selectedCampaign) {
        const res = await api.get(`/leads/campaign/${selectedCampaign._id}`);
        setCampaignLeads(res.data || []);
      }
      setSelectedLeadIds([]);
      setSelectedMember(null);
    } catch {
      toast.error("Failed to assign leads");
    } finally {
      setIsAssigning(false);
    }
  };

  // Client-side leads search filter
  const filteredLeads = campaignLeads.filter((lead) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      lead.name.toLowerCase().includes(query) ||
      (lead.main_contact_name && lead.main_contact_name.toLowerCase().includes(query)) ||
      (lead.main_contact_email && lead.main_contact_email.toLowerCase().includes(query))
    );
  });

  const isAllSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l._id));
  
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = filteredLeads.map(l => l._id);
      setSelectedLeadIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredLeads.map(l => l._id);
      setSelectedLeadIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-primary" />
            </span>
            Lead Scheduler
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Quickly search leads and assign or redistribute ownership among team representatives in bulk.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Campaign Selection, Lead Lookup & Detail Card (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step 1: Campaign Selector Card */}
            <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 border-b border-border pb-2.5">
                <Layers3 size={15} className="text-primary" />
                Step 1: Select Campaign
              </h2>
              
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading campaigns...
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="select-field-1"
                    name="select-field-1"
                    value={selectedCampaign?._id || ""}
                    onChange={(e) => handleCampaignChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="">-- Choose a Campaign --</option>
                    {campaigns.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Step 2: Leads Selection Card */}
            <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 border-b border-border pb-2.5">
                <Search size={15} className="text-primary" />
                Step 2: Select Leads
              </h2>

              {!selectedCampaign ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-muted/30 border border-dashed rounded-xl justify-center py-8">
                  <AlertCircle size={14} className="text-orange-400" />
                  Please select a campaign in Step 1 first.
                </div>
              ) : loadingLeads ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading campaign leads...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search filter input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={15} className="text-muted-foreground" />
                    </div>
                    <input
                    id="filter-leads-in-this-campaign"
                    name="filter-leads-in-this-campaign"
                      type="text"
                      placeholder="Filter leads in this campaign..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground text-foreground"
                    />
                  </div>

                  {/* Select All Toggle Header */}
                  {filteredLeads.length > 0 && (
                    <div className="flex items-center justify-between px-2 text-xs">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                          ${isAllSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"}`}
                        >
                          {isAllSelected && <Check size={10} className="stroke-[3]" />}
                        </span>
                        {isAllSelected ? "Deselect All Leads" : "Select All Leads"}
                      </button>
                      <span className="text-muted-foreground font-medium">
                        {selectedLeadIds.length} selected
                      </span>
                    </div>
                  )}

                  {/* Leads List Box */}
                  {filteredLeads.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No matching leads found in this campaign
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl max-h-48 overflow-y-auto custom-scrollbar bg-background divide-y divide-border">
                      {filteredLeads.map((lead) => (
                        <button
                          key={lead._id}
                          type="button"
                          onClick={() => handleToggleLead(lead._id)}
                          className={`w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3
                            ${selectedLeadIds.includes(lead._id) ? "bg-primary/5 text-primary" : "text-foreground"}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox indicator */}
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                              ${selectedLeadIds.includes(lead._id) ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"}`}
                            >
                              {selectedLeadIds.includes(lead._id) && <Check size={10} className="stroke-[3]" />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{lead.name}</div>
                              {lead.main_contact_name && (
                                <div className="text-[11px] text-muted-foreground truncate">{lead.main_contact_name}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {lead.assigned_to && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium max-w-[80px] truncate">
                                {(lead.assigned_to as any).name || "Assigned"}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Leads Details Preview Card */}
            {selectedLeadIds.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in-50 duration-200">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      Selected Leads Details
                    </span>
                    <h3 className="text-lg font-bold text-foreground mt-2">
                      {selectedLeadIds.length} {selectedLeadIds.length === 1 ? "Lead" : "Leads"} Selected
                    </h3>
                  </div>
                </div>

                {/* Assignment Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Selected Leads Count info */}
                  <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Target Leads
                    </span>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedLeadIds.length} {selectedLeadIds.length === 1 ? "lead" : "leads"} selected from <strong>{selectedCampaign?.name}</strong>
                    </div>
                  </div>

                  {/* Proposed Assignee Preview */}
                  <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Proposed Assignment
                    </span>
                    {selectedMember ? (
                      <div className="flex items-center gap-3">
                        <UserAvatar user={selectedMember} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{selectedMember.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{selectedMember.role}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium py-1">
                        <UserMinus size={15} className="text-muted-foreground/60" />
                        Will Be Unassigned
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Leads List details */}
                <div className="border-t border-border pt-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Selected Leads List
                  </h4>
                  <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                    {campaignLeads
                      .filter((l) => selectedLeadIds.includes(l._id))
                      .map((lead) => {
                        const assignee = lead.assigned_to as any;
                        return (
                          <div key={lead._id} className="flex justify-between items-center text-xs p-2.5 bg-muted/30 border border-border/50 rounded-lg">
                            <span className="font-semibold text-foreground truncate max-w-[220px]">{lead.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate font-medium">
                              Current: {assignee?.name || "Unassigned"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Representatives List (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 border-b border-border pb-2.5">
                <Users size={15} className="text-primary" />
                Step 3: Assign Representative
              </h2>

              {selectedLeadIds.length === 0 ? (
                <div className="bg-muted/10 border border-dashed rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 min-h-60">
                  <Building2 size={36} className="text-muted-foreground/30 animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Representative Assignment Locked</p>
                    <p className="text-xs text-muted-foreground/80 max-w-xs mx-auto">
                      Please select one or more Leads in Step 2 to unlock representative selection.
                    </p>
                  </div>
                </div>
              ) : loadingTeam ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading team representatives...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {/* Unassign Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 group
                        ${!selectedMember
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-accent/40 text-foreground"
                        }`}
                    >
                      <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border text-muted-foreground group-hover:text-primary transition-colors">
                        <UserMinus size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">Unassigned</div>
                        <div className="text-xs text-muted-foreground truncate">Remove lead owner</div>
                      </div>
                      {!selectedMember && (
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                          <Check size={11} className="stroke-[3]" />
                        </span>
                      )}
                    </button>

                    {/* Team Members */}
                    {teamMembers.map((member) => (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150
                          ${selectedMember?._id === member._id
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-accent/40 text-foreground"
                          }`}
                      >
                        <UserAvatar user={member} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{member.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate font-medium">{member.email}</div>
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 mt-1 rounded bg-secondary text-muted-foreground border border-border uppercase tracking-wider">
                            {member.role}
                          </span>
                        </div>
                        {selectedMember?._id === member._id && (
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                            <Check size={11} className="stroke-[3]" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Confirm Assignment Action */}
                  <Button
                    onClick={handleAssign}
                    disabled={isAssigning}
                    className="w-full gap-2 font-semibold text-sm py-5 rounded-xl border border-primary/20 shadow-md"
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Reassigning Leads...
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} /> Confirm Assignment ({selectedLeadIds.length} {selectedLeadIds.length === 1 ? "Lead" : "Leads"})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
