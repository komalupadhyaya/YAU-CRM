import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { CalendarPlus, Save, ArrowLeft, History, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

interface School {
  _id: string;
  name: string;
  type: string;
  grades: string;
  principal_name: string;
  principal_email: string;
  telephone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  start_time: string;
  end_time: string;
}

export default function SchoolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState<School | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<School>>({});

  // Follow-up Modal State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  const loadAll = async () => {
    try {
      const [schoolRes, notesRes, followUpsRes] = await Promise.all([
        api.get("/schools/" + id),
        api.get("/notes/" + id),
        api.get("/followups/school/" + id),
      ]);
      setSchool(schoolRes.data);
      setEditData(schoolRes.data);
      setNotes(notesRes.data);
      setFollowUps(followUpsRes.data);
    } catch { }
  };

  useEffect(() => { loadAll(); }, [id]);

  const saveSchool = async () => {
    if (!editData.name?.trim()) {
      toast.error("School name is required");
      return;
    }
    try {
      const res = await api.put("/schools/" + id, editData);
      setSchool(res.data);
      setIsEditing(false);
      toast.success("School details updated");
    } catch { }
  };

  const addNote = async () => {
    if (!noteContent.trim()) {
      toast.error("Note content cannot be empty.");
      return;
    }
    try {
      await api.post("/notes/" + id, { content: noteContent });
      toast.success("Note added");
      setNoteContent("");
      const r = await api.get("/notes/" + id);
      setNotes(r.data);
    } catch { }
  };

  const handleOpenFollowUpModal = () => {
    setFollowUpDate("");
    setFollowUpReason("");
    setIsFollowUpModalOpen(true);
  };

  const submitFollowUp = async () => {
    if (!followUpDate) {
      toast.error("Follow-up date is required");
      return;
    }
    try {
      await api.post("/followups/" + id, { follow_up_date: followUpDate, reason: followUpReason });
      toast.success("Follow-up scheduled");
      setIsFollowUpModalOpen(false);
      loadAll();
    } catch { }
  };

  const markDone = async (fuId: string) => {
    try {
      await api.put(`/followups/${fuId}/complete`);
      toast.success("Follow-up completed");
      loadAll();
    } catch { }
  };

  if (!school) return <AppLayout><div className="p-12 text-center animate-pulse dark:text-muted-foreground">Loading school details...</div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground dark:hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="page-card dark:bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {isEditing ? "Edit School" : school.name}
              </h1>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => { setIsEditing(false); setEditData(school); }} className="btn-secondary">Cancel</button>
                    <button onClick={saveSchool} className="btn-primary flex items-center gap-2">
                      <Save size={16} /> Save Changes
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="btn-secondary">Edit Details</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { label: "School Type", key: "type" },
                { label: "Grades", key: "grades" },
                { label: "Principal / POC", key: "principal_name" },
                { label: "Principal Email", key: "principal_email" },
                { label: "Telephone", key: "telephone" },
                { label: "Website", key: "website" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{label}</label>
                  {isEditing ? (
                    <input
                      className="input-field dark:bg-card"
                      value={(editData as any)[key] || ""}
                      onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                    />
                  ) : (
                    <p className="text-foreground">{(school as any)[key] || "N/A"}</p>
                  )}
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Address</label>
                {isEditing ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input className="input-field md:col-span-2 dark:bg-card" placeholder="Street" value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="City" value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="State" value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="Zip" value={editData.zip || ""} onChange={e => setEditData({ ...editData, zip: e.target.value })} />
                  </div>
                ) : (
                  <p className="text-foreground">{[school.address, school.city, school.state, school.zip].filter(Boolean).join(", ") || "N/A"}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">School Hours</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input type="time" className="input-field dark:bg-card" value={editData.start_time || ""} onChange={e => setEditData({ ...editData, start_time: e.target.value })} />
                    <span className="flex items-center text-muted-foreground">to</span>
                    <input type="time" className="input-field dark:bg-card" value={editData.end_time || ""} onChange={e => setEditData({ ...editData, end_time: e.target.value })} />
                  </div>
                ) : (
                  <p className="text-foreground">{school.start_time || "--:--"} – {school.end_time || "--:--"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Communication Log / Notes */}
          <div className="page-card dark:bg-card">
            <div className="flex items-center gap-2 mb-4">
              <History size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Communication Log</h2>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-1.5">Add a new note</label>
              <textarea
                className="input-field min-h-[100px] mb-3"
                placeholder="Details of the call or email..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <button onClick={addNote} className="btn-primary">Save Note</button>
            </div>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No notes recorded yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n._id} className="p-3 bg-accent/50 dark:bg-accent/10 rounded-lg border border-border dark:border-border/20">
                    <p className="text-sm text-foreground mb-1">{n.content}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="page-card dark:bg-card border-l-4 border-l-primary/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarPlus size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Follow-ups</h2>
              </div>
              <button onClick={handleOpenFollowUpModal} className="text-primary hover:text-primary/80 text-sm font-medium">
                + New
              </button>
            </div>

            <div className="space-y-3">
              {followUps.filter(f => f.status === 'pending').length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  No pending follow-ups.
                </p>
              ) : (
                followUps.filter(f => f.status === 'pending').map((f) => (
                  <div key={f._id} className="p-3 bg-accent/30 dark:bg-accent/10 rounded-lg border border-border dark:border-border/20">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-primary uppercase">{new Date(f.follow_up_date + 'T00:00:00').toLocaleDateString()}</p>
                        {f.reason && <p className="text-sm text-foreground mt-0.5">{f.reason}</p>}
                      </div>
                      <button
                        onClick={() => markDone(f._id)}
                        className="text-xs text-muted-foreground hover:text-success border border-border hover:border-success px-2 py-1 rounded transition-colors whitespace-nowrap"
                      >
                        Mark Done
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="page-card bg-primary/5 border-none">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Context</span>
            </div>
            <p className="text-sm text-foreground">
              All follow-ups for this school also appear on the Dashboard, grouped by due date.
            </p>
          </div>
        </div>
      </div>

      {/* Follow-up Modal */}
      <Dialog open={isFollowUpModalOpen} onOpenChange={setIsFollowUpModalOpen}>
        <DialogContent className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Set Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="date" className="text-sm font-medium">Follow-up Date <span className="text-destructive">*</span></label>
              <input
                id="date"
                type="date"
                className="input-field dark:bg-card dark:color-scheme-dark"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="reason" className="text-sm font-medium">Note / Reason <span className="text-muted-foreground text-xs">(optional)</span></label>
              <textarea
                id="reason"
                className="input-field min-h-[80px]"
                placeholder="What needs to happen on this date?"
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsFollowUpModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitFollowUp} disabled={!followUpDate}>Save Follow-up</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
