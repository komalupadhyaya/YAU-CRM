import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  Search,
  MapPin,
  Plus,
  Filter,
  Phone,
  Mail,
  Globe,
  Clock,
  Calendar,
  History,
  Info,
  ExternalLink,
  ChevronRight,
  Folder,
  School as SchoolIcon
} from "lucide-react";
import { useCampaignStore } from "../store/campaignStore";
import { useSchoolStore } from "../store/schoolStore";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// --- Types ---
interface Campaign {
  _id: string;
  name: string;
  createdAt: string;
}

interface School {
  _id: string;
  name: string;
  type?: string;
  grades?: string;
  principal_name?: string;
  principal_email?: string;
  telephone?: string;
  start_time?: string;
  end_time?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  status: string;
  last_contacted: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  _id: string;
  content: string;
  createdAt: string;
}

interface FollowUp {
  _id: string;
  follow_up_date: string;
  reason: string;
  status: string;
}

const STATUS_OPTIONS = [
  "Not Contacted",
  "Attempted Call",
  "Left Voicemail",
  "Spoke to Office",
  "Meeting Scheduled",
  "Proposal Sent",
  "Signed",
  "Not Interested"
];

const Campaigns = () => {
  const { selectedCampaign, setSelectedCampaign } = useCampaignStore();
  const { selectedSchool, setSelectedSchool } = useSchoolStore();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteContent, setNoteContent] = useState("");

  // Create Campaign Modal
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  // Create School Modal
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [schoolFormData, setSchoolFormData] = useState({
    name: "",
    type: "",
    grades: "",
    principal_name: "",
    principal_email: "",
    telephone: "",
    city: "",
    state: "",
    address: "",
    zip: "",
    website: ""
  });

  // Follow-up Modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  // --- Data Fetching ---

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const r = await api.get("/campaigns");
      setCampaigns(r.data);
    } catch { }
    setLoadingCampaigns(false);
  };

  const fetchSchools = useCallback(async (compId: string) => {
    setLoadingSchools(true);
    try {
      const r = await api.get(`/schools/campaign/${compId}`);
      setSchools(r.data);
      // Deselect school if it's not in the new campaign
      if (selectedSchool && !r.data.find((s: School) => s._id === selectedSchool._id)) {
        setSelectedSchool(null);
      }
    } catch { }
    setLoadingSchools(false);
  }, [selectedSchool, setSelectedSchool]);

  const fetchDetails = useCallback(async (schoolId: string) => {
    setLoadingDetails(true);
    try {
      const [notesRes, followUpsRes] = await Promise.all([
        api.get(`/notes/${schoolId}`),
        api.get(`/followups/school/${schoolId}`),
      ]);
      setNotes(notesRes.data);
      setFollowUps(followUpsRes.data);
    } catch { }
    setLoadingDetails(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchSchools(selectedCampaign._id);
    } else {
      setSchools([]);
      setSelectedSchool(null);
    }
  }, [selectedCampaign?._id]);

  useEffect(() => {
    if (selectedSchool) {
      fetchDetails(selectedSchool._id);
    }
  }, [selectedSchool?._id, fetchDetails]);

  // --- Handlers ---

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const res = await api.post("/campaigns", { name: newCampaignName });
      toast.success("Campaign created");
      setNewCampaignName("");
      setIsCreateCampaignOpen(false);
      await fetchCampaigns();
      setSelectedCampaign(res.data);
    } catch { }
  };

  const createSchool = async () => {
    if (!selectedCampaign || !schoolFormData.name.trim()) return;
    try {
      const res = await api.post("/schools", {
        ...schoolFormData,
        campaign_id: selectedCampaign._id
      });
      toast.success("School created");
      setIsCreateSchoolOpen(false);
      setSchoolFormData({
        name: "", type: "", grades: "", principal_name: "", principal_email: "",
        telephone: "", city: "", state: "", address: "", zip: "", website: ""
      });
      await fetchSchools(selectedCampaign._id);
      setSelectedSchool(res.data);
    } catch { }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedSchool) return;
    try {
      const res = await api.patch(`/schools/${selectedSchool._id}`, { status: newStatus });
      setSelectedSchool(res.data);
      setSchools(prev => prev.map(s => s._id === res.data._id ? res.data : s));
      toast.success(`Status updated to ${newStatus}`);
    } catch { }
  };

  const addNote = async () => {
    if (!selectedSchool || !noteContent.trim()) return;
    try {
      await api.post(`/notes/${selectedSchool._id}`, { content: noteContent });
      toast.success("Note added");
      setNoteContent("");

      const [notesRes, schoolRes] = await Promise.all([
        api.get(`/notes/${selectedSchool._id}`),
        api.get(`/schools/${selectedSchool._id}`)
      ]);
      setNotes(notesRes.data);
      setSelectedSchool(schoolRes.data);
      setSchools(prev => prev.map(s => s._id === schoolRes.data._id ? schoolRes.data : s));
    } catch { }
  };

  const submitFollowUp = async () => {
    if (!selectedSchool || !followUpDate) return;
    try {
      await api.post(`/followups/${selectedSchool._id}`, {
        follow_up_date: followUpDate,
        reason: followUpReason
      });
      toast.success("Follow-up scheduled");
      setIsFollowUpModalOpen(false);
      setFollowUpDate("");
      setFollowUpReason("");

      const r = await api.get(`/followups/school/${selectedSchool._id}`);
      setFollowUps(r.data);
    } catch { }
  };

  const markFollowupDone = async (fuId: string) => {
    if (!selectedSchool) return;
    try {
      await api.put(`/followups/${fuId}/complete`);
      toast.success("Follow-up completed");

      const [fuRes, schoolRes] = await Promise.all([
        api.get(`/followups/school/${selectedSchool._id}`),
        api.get(`/schools/${selectedSchool._id}`)
      ]);
      setFollowUps(fuRes.data);
      setSelectedSchool(schoolRes.data);
      setSchools(prev => prev.map(s => s._id === schoolRes.data._id ? schoolRes.data : s));
    } catch { }
  };

  // --- Filters ---     
  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.city?.toLowerCase().includes(schoolSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="h-auto md:h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 overflow-y-auto md:overflow-hidden p-1">

        {/* --- PANEL 1: Campaigns --- */}
        <div className="w-full md:w-64 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Campaigns</h2>
              <button
                onClick={() => setIsCreateCampaignOpen(true)}
                className="p-1 hover:bg-accent rounded text-primary transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
              <input
                placeholder="Search..."
                className="w-full bg-accent/50 border-none rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-1 ring-primary outline-none"
                value={campaignSearch}
                onChange={e => setCampaignSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingCampaigns ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground animate-pulse">Loading...</div>
            ) : filteredCampaigns.map(c => (
              <button
                key={c._id}
                onClick={() => setSelectedCampaign(c)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all mb-1 ${selectedCampaign?._id === c._id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground"}`}
              >
                <Folder size={16} className={selectedCampaign?._id === c._id ? "text-primary-foreground" : "text-primary"} />
                <span className="text-xs font-medium truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- PANEL 2: Schools --- */}
        <div className="w-full md:w-80 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
          {!selectedCampaign ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground transition-all duration-300 ease-in-out">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-3">
                <ChevronRight size={24} />
              </div>
              <p className="text-xs font-medium">Select a campaign to view schools</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm truncate">{selectedCampaign.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">{filteredSchools.length}</span>
                    <button
                      onClick={() => setIsCreateSchoolOpen(true)}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                  <input
                    placeholder="Search schools..."
                    className="w-full bg-accent/50 border-none rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-1 ring-primary outline-none"
                    value={schoolSearch}
                    onChange={e => setSchoolSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-muted-foreground" />
                  <select
                    className="text-[10px] bg-transparent border-none focus:ring-0 outline-none font-medium cursor-pointer"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option className="dark:bg-accent" value="all">All Statuses</option>
                    {STATUS_OPTIONS.map(opt => <option className="dark:bg-accent" key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[400px] md:max-h-none">
                {loadingSchools ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground animate-pulse">Loading schools...</div>
                ) : filteredSchools.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground">No schools found.</div>
                ) : (
                  filteredSchools.map(s => (
                    <button
                      key={s._id}
                      onClick={() => setSelectedSchool(s)}
                      className={`w-full text-left p-3.5 hover:bg-gray-50 dark:hover:bg-accent/20 cursor-pointer transition-all duration-200 border-l-2 ${selectedSchool?._id === s._id ? "bg-accent border-primary" : "border-transparent"}`}
                    >
                      <div className="font-semibold text-xs truncate">{s.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <MapPin size={8} /> {s.city || "Unknown"}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${s.status === 'Active' ? 'bg-success/10 text-success' :
                          s.status === 'Not Contacted' ? 'bg-muted text-muted-foreground' : 'bg-warning/10 text-warning'
                          }`}>
                          {s.status}
                        </span>
                      </div>
                      {s.last_contacted && (
                        <div className="text-xs text-gray-400 mt-1">
                          Last contacted: {new Date(s.last_contacted).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* --- PANEL 3: Details & News --- */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[500px] md:min-h-0">
          {!selectedSchool ? (
            <div className="flex-1 bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center text-muted-foreground p-12 text-center transition-all duration-300 ease-in-out">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4">
                <SchoolIcon size={32} />
              </div>
              <h3 className="font-bold text-foreground">No School Selected</h3>
              <p className="text-xs max-w-xs mt-2">Select a school to view profile and notes</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* Activity Feed (Middle) */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-[500px] md:min-h-0">
                <div className="bg-card border rounded-xl p-4 shadow-sm shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-foreground leading-tight">{selectedSchool.name}</h1>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Info size={12} /> {selectedSchool.type || "School"}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {selectedSchool.city}</span>
                      </div>
                    </div>
                    <button onClick={() => setIsFollowUpModalOpen(true)} className="p-1 hover:bg-accent rounded text-primary transition-colors"><Plus size={14} /></button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                  <div className="p-3 border-b bg-accent/5 flex items-center gap-2">
                    <History size={16} className="text-primary" />
                    <h2 className="font-bold text-xs uppercase tracking-wider">Activity Feed</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    <div className="bg-accent/10 dark:bg-accent/5 rounded-xl p-3 border border-dashed border-primary/20">
                      <textarea
                        placeholder="Add a note..."
                        className="w-full bg-transparent border-none text-xs outline-none resize-none min-h-[50px] dark:text-foreground"
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                      />
                      <div className="flex justify-end mt-1">
                        <button onClick={addNote} disabled={!noteContent.trim()} className="btn-primary px-3 text-[10px] disabled:opacity-50">Post Note</button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {loadingDetails ? (
                        <div className="text-center py-4 animate-pulse text-[10px] text-muted-foreground">Loading feed...</div>
                      ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          <p className="font-medium">No notes yet</p>
                          <p className="text-[10px] mt-1">Add your first outreach note</p>
                        </div>
                      ) : (
                        notes.map(n => (
                          <div key={n._id} className="relative pl-5 before:absolute before:left-[6px] before:top-2 before:bottom-[-20px] before:w-[1.5px] before:bg-border last:before:hidden">
                            <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                            <div className="bg-white dark:bg-card shadow-sm border rounded-lg p-2.5">
                              <p className="text-xs text-foreground leading-relaxed">{n.content}</p>
                              <p className="text-[9px] text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Details (Right) */}
              <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto shrink-0 pb-6 md:pb-0">
                <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Relationship</h3>
                  <div className="space-y-3">
                    <Select value={selectedSchool.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="h-8 text-xs md:w-full dark:bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedSchool.last_contacted && (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 bg-accent/20 dark:bg-accent/10 p-2 rounded-lg">
                        <Clock size={12} /> Last contacted: {new Date(selectedSchool.last_contacted).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Info</h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Phone size={14} /></div>
                      <span className="truncate">{selectedSchool.telephone || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Mail size={14} /></div>
                      <span className="truncate">{selectedSchool.principal_email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Globe size={14} /></div>
                      {selectedSchool.website ? <a href={selectedSchool.website} target="_blank" className="text-primary hover:underline truncate">Website</a> : <span>N/A</span>}
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground shrink-0"><MapPin size={14} /></div>
                      <span className="leading-tight">{selectedSchool.address}<br />{selectedSchool.city}, {selectedSchool.state}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm mb-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tasks</h3>
                  <div className="space-y-2">
                    {followUps.filter(f => f.status === 'pending').length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">None.</p>
                    ) : (
                      followUps.filter(f => f.status === 'pending').map(f => (
                        <div key={f._id} className="p-2 border rounded-lg bg-accent/5 dark:bg-accent/5 group">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-primary">{f.follow_up_date}</span>
                            <button onClick={() => markFollowupDone(f._id)} className="text-[8px] text-muted-foreground hover:text-success opacity-0 group-hover:opacity-100 transition-all">Done</button>
                          </div>
                          <p className="text-[10px] text-foreground/80 mt-1 line-clamp-1">{f.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isCreateCampaignOpen} onOpenChange={setIsCreateCampaignOpen}>
        <DialogContent className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">New Campaign</DialogTitle></DialogHeader>
          <div className="py-2">
            <input
              placeholder="e.g. Summer Outreach"
              className="input-field"
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCreateCampaignOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createCampaign}>Create</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFollowUpModalOpen} onOpenChange={setIsFollowUpModalOpen}>
        <DialogContent className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Date</label>
              <input type="date" className="input-field dark:color-scheme-dark" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Task Details</label>
              <textarea placeholder="Reason for follow-up" className="input-field min-h-[80px]" value={followUpReason} onChange={e => setFollowUpReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsFollowUpModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitFollowUp}>Schedule</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateSchoolOpen} onOpenChange={setIsCreateSchoolOpen}>
        <DialogContent className="sm:max-w-2xl dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Add School to {selectedCampaign?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 overflow-y-auto max-h-[70vh] p-1">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium">School Name *</label>
              <input
                className="input-field"
                placeholder="Name"
                value={schoolFormData.name}
                onChange={e => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <input
                className="input-field"
                placeholder="Public/Private"
                value={schoolFormData.type}
                onChange={e => setSchoolFormData({ ...schoolFormData, type: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Grades</label>
              <input
                className="input-field"
                placeholder="PK-5"
                value={schoolFormData.grades}
                onChange={e => setSchoolFormData({ ...schoolFormData, grades: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Principal Name</label>
              <input
                className="input-field"
                placeholder="John Doe"
                value={schoolFormData.principal_name}
                onChange={e => setSchoolFormData({ ...schoolFormData, principal_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Principal Email</label>
              <input
                className="input-field"
                placeholder="email@school.edu"
                value={schoolFormData.principal_email}
                onChange={e => setSchoolFormData({ ...schoolFormData, principal_email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">City</label>
              <input
                className="input-field"
                placeholder="City"
                value={schoolFormData.city}
                onChange={e => setSchoolFormData({ ...schoolFormData, city: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">State</label>
              <input
                className="input-field"
                placeholder="ST"
                value={schoolFormData.state}
                onChange={e => setSchoolFormData({ ...schoolFormData, state: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCreateSchoolOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!schoolFormData.name.trim()} onClick={createSchool}>Create School</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
};

export default Campaigns;
