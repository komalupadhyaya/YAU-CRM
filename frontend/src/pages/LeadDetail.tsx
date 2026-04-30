import { useEffect, useState } from "react";
import { useLeadStore } from "../store/schoolStore";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { CalendarPlus, Save, ArrowLeft, History, Info, User, Phone, Mail, Clock, MessageSquare, ChevronDown, ChevronUp, Edit, Video, Send, CheckCircle2, Trash2, Play, ExternalLink, FileText, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { countryCodes } from "../utils/countryCodes";
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
  type: 'note' | 'status_change' | 'email' | 'meeting' | 'call' | 'sms';
  metadata?: any;
  createdAt: string;
}

interface FollowUp {
  _id: string;
  date_time: string;
  type: string;
  notes: string;
  priority: string;
  status: string;
}

interface Contact {
  _id: string;
  name: string;
  title: string;
  department: string;
  direct_phone: string;
  extension: string;
  email: string;
  best_time: string;
  preferred_method: string;
  is_primary: boolean;
}

interface Lead {
  _id: string;
  name: string;
  type: string;
  category_group: string;
  telephone: string;
  address_number: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  start_time: string;
  end_time: string;
  status: string;
  campaign_id?: { _id: string, name: string };
  contacts?: Contact[];
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setSelectedLead } = useLeadStore();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [statusLabels, setStatusLabels] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<{ _id: string; name: string }[]>([]);
  const [showSecondary, setShowSecondary] = useState(false);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("Medium");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");
  const [fuErrors, setFuErrors] = useState<Record<string, string>>({});

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedContactForMeeting, setSelectedContactForMeeting] = useState<Contact | null>(null);
  const [meetingData, setMeetingData] = useState({
    title: "",
    date_time: "",
    type: "Virtual",
    notes: ""
  });

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedContactForEmail, setSelectedContactForEmail] = useState<Contact | null>(null);
  const [emailData, setEmailData] = useState({ subject: "Meeting follow-up", body: "", cc: [] as string[] });
  const [ccInput, setCcInput] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

  const checkDomain = async (email: string) => {
    const domain = email.split('@')[1];
    if (!domain || verifiedDomains[domain]) return;

    try {
      const res = await api.get(`/emails/verify-domain?email=${email}`);
      setVerifiedDomains(prev => ({ ...prev, [domain]: { valid: res.data.valid, message: res.data.message } }));
    } catch {
      // If API fails, we assume it's valid to not block the user
    }
  };

  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [selectedContactForSms, setSelectedContactForSms] = useState<Contact | null>(null);
  const [smsData, setSmsData] = useState({
    message: ""
  });
  const [smsErrors, setSmsErrors] = useState<Record<string, string>>({});

  const [isDeleteNoteModalOpen, setIsDeleteNoteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [noteError, setNoteError] = useState(false);
  const [meetingErrors, setMeetingErrors] = useState<Record<string, string>>({});
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [contactPhonePrefix, setContactPhonePrefix] = useState("+1");
  const [secondaryPhonePrefix, setSecondaryPhonePrefix] = useState("+1");
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [selectedContactForCall, setSelectedContactForCall] = useState<Contact | null>(null);
  const [callOutcome, setCallOutcome] = useState("Answered - Interested");
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [selectedContactForNote, setSelectedContactForNote] = useState<Contact | null>(null);
  const [meetingCc, setMeetingCc] = useState<string[]>([]);
  const [meetingCcInput, setMeetingCcInput] = useState("");

  const loadAll = async (silent = false) => {
    try {
      const [leadRes, notesRes, followUpsRes, settingsRes, campaignsRes] = await Promise.all([
        api.get("/leads/" + id),
        api.get("/notes/" + id),
        api.get("/followups/lead/" + id),
        api.get("/settings"),
        api.get("/campaigns"),
      ]);
      const leadData = leadRes.data;
      setLead(leadData);
      
      const getPrefix = (phone: string) => {
        if (!phone?.startsWith('+')) return "+1";
        const found = countryCodes.find(c => phone.startsWith(c.dialCode));
        return found ? found.dialCode : "+1";
      };

      // Detect prefix from lead telephone if it exists
      if (!isEditing) {
        setPhonePrefix(getPrefix(leadData.telephone));

        // Populate edit data with lead AND contact info
        const primary = leadData.contacts?.find((c: any) => c.is_primary);
        const secondary = leadData.contacts?.find((c: any) => !c.is_primary);
        
        setContactPhonePrefix(getPrefix(primary?.direct_phone));
        setSecondaryPhonePrefix(getPrefix(secondary?.direct_phone));

        const stripPrefix = (phone: string) => {
          if (!phone) return "";
          const found = countryCodes.find(c => phone.startsWith(c.dialCode));
          return found ? phone.slice(found.dialCode.length) : phone;
        };

        setEditData({
          ...leadData,
          telephone: stripPrefix(leadData.telephone),
          main_contact_name: primary?.name || "",
          contact_title: primary?.title || "",
          contact_department: primary?.department || "",
          contact_direct_phone: stripPrefix(primary?.direct_phone),
          contact_extension: primary?.extension || "",
          contact_email: primary?.email || "",
          contact_best_time: primary?.best_time || "",
          contact_preferred_method: primary?.preferred_method || "",
          secondary_contact_name: secondary?.name || "",
          secondary_contact_title: secondary?.title || "",
          secondary_contact_phone: stripPrefix(secondary?.direct_phone),
          secondary_contact_extension: secondary?.extension || "",
          secondary_contact_email: secondary?.email || "",
        });
      }
      
      setNotes(notesRes.data);
      setFollowUps(followUpsRes.data);
      setStatusLabels(settingsRes.data.statusLabels || []);
      setCampaigns(campaignsRes.data || []);
    } catch { }
  };

  useEffect(() => {
    loadAll();
    
    // Auto-poll for new notes/recordings every 10 seconds, but ONLY if not editing
    let pollInterval: any;
    if (!isEditing) {
      pollInterval = setInterval(() => {
        loadAll();
      }, 10000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id, isEditing]);

  const saveLead = async () => {
    if (!editData.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const payload = {
        ...editData,
        telephone: editData.telephone ? (phonePrefix + editData.telephone.replace(/\D/g, '')) : "",
        contact_direct_phone: editData.contact_direct_phone ? (contactPhonePrefix + editData.contact_direct_phone.replace(/\D/g, '')) : "",
        secondary_contact_phone: editData.secondary_contact_phone ? (secondaryPhonePrefix + editData.secondary_contact_phone.replace(/\D/g, '')) : "",
      };
      const res = await api.put("/leads/" + id, payload);
      setSelectedLead(res.data);
      setLead(res.data);
      setIsEditing(false);
      toast.success("Lead and contacts updated successfully");
    } catch { 
      toast.error("Failed to update lead details");
    }
  };

  const addNote = async () => {
    if (!noteContent.trim()) {
      setNoteError(true);
      toast.error("Please fill the notes first");
      return;
    }
    try {
      const content = selectedContactForNote 
        ? `NOTE for ${selectedContactForNote.name}: ${noteContent}`
        : noteContent;
        
      await api.post("/notes/" + id, { content });
      toast.success("Note added");
      setNoteContent("");
      setNoteError(false);
      setIsNoteModalOpen(false);
      setSelectedContactForNote(null);
      const r = await api.get("/notes/" + id);
      setNotes(r.data);
    } catch { }
  };

  const confirmDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setIsDeleteNoteModalOpen(true);
  };

  const deleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await api.delete(`/notes/${noteToDelete}`);
      toast.success("Note deleted");
      const r = await api.get("/notes/" + id);
      setNotes(r.data);
      setIsDeleteNoteModalOpen(false);
      setNoteToDelete(null);
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleOpenFollowUpModal = () => {
    setFollowUpDate("");
    setFollowUpNotes("");
    setFollowUpType("");
    setFollowUpPriority("");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setFuErrors({});
    setIsFollowUpModalOpen(true);
  };

  const submitFollowUp = async (contactId?: string, force = false) => {
    const errors: Record<string, string> = {};
    if (!followUpDate) errors.date = "Date and time are required";
    if (!followUpType) errors.type = "Type is required";
    if (!followUpPriority) errors.priority = "Priority is required";
    if (assignedTo === "other" && !customAssignedTo.trim()) errors.assigned = "Please specify who to assign";

    if (Object.keys(errors).length > 0) {
      setFuErrors(errors);
      toast.error("Please fill all the details in the follow up");
      return;
    }

    try {
      const finalAssigned = assignedTo === "self" ? "Me" : customAssignedTo.trim();
      await api.post("/followups/" + id, { 
        date_time: followUpDate, 
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        contact_id: contactId,
        assigned_user: finalAssigned === "Me" ? null : finalAssigned,
        force
      });
      toast.success("Follow-up scheduled");
      setIsFollowUpModalOpen(false);
      setFuErrors({});
      setCustomAssignedTo("");
      loadAll();
    } catch (err: any) {
      if (err.response?.status === 409) {
          const conflicts = err.response.data.conflicts || [];
          const conflictNames = conflicts.map((c: any) => c.summary).join(", ");
          if (window.confirm(`Calendar Conflict: "${conflictNames || 'Existing Event'}" detected. Schedule anyway?`)) {
              submitFollowUp(contactId, true);
          }
      } else {
          toast.error(err.response?.data?.message || "Failed to schedule follow-up");
      }
    }
  };

  const scheduleMeeting = async (force = false) => {
    const errors: Record<string, string> = {};
    if (!meetingData.title.trim()) errors.title = "Meeting title is required";
    if (!meetingData.date_time) errors.date_time = "Date and time are required";

    if (Object.keys(errors).length > 0) {
      setMeetingErrors(errors);
      toast.error("Please fill all meeting details");
      return;
    }

    try {
      const res = await api.post("/followups/" + id, {
        date_time: meetingData.date_time,
        type: 'Meeting',
        priority: 'High',
        notes: `Meeting: ${meetingData.title}\nType: ${meetingData.type}\nNotes: ${meetingData.notes}`,
        contact_id: selectedContactForMeeting?._id,
        cc_emails: meetingCc,
        force
      });
      toast.success("Meeting scheduled and invite sent");
      setIsMeetingModalOpen(false);
      setMeetingData({ title: "", date_time: "", type: "Virtual", notes: "" });
      setMeetingCc([]);
      setMeetingCcInput("");
      setMeetingErrors({});
      loadAll();
    } catch (err: any) {
      if (err.response?.status === 409) {
        const conflict = err.response.data.conflicts[0];
        if (window.confirm(`Conflict detected: "${conflict.summary}" at ${new Date(conflict.start).toLocaleTimeString()}. Schedule anyway?`)) {
          scheduleMeeting(true);
        }
      } else {
        toast.error(err.response?.data?.message || err.message || "Failed to schedule meeting");
      }
    }
  };



  const initiateCall = (contact: Contact | null) => {
    setSelectedContactForCall(contact); // Keep track of who we are calling
    const phone = contact?.direct_phone || lead?.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `${phonePrefix}${phone.replace(/\D/g, '')}`;
      window.open(`https://app.justcall.io/dialer?numbers=${encodeURIComponent(cleanPhone)}&ticket_id=${id}&custom_field=${id}&notes=${encodeURIComponent('CRM Lead ID: ' + id)}`, "JustCallDialer", "fullscreen=yes,location=no,width=385,height=665");
    }
    // Open the outcome modal so the agent can log it when they finish
    setCallOutcome("Answered - Interested"); // Default
    setIsCallModalOpen(true);
  };

  const logCall = async () => {
    try {
      const res = await api.post(`/justcall/log-call`, { 
        lead_id: id,
        outcome: callOutcome,
        notes: callNotes,
        duration: callDuration,
        contact_name: selectedContactForCall?.name || lead?.name || 'Unknown'
      });
      toast.success("Call logged");
      setIsCallModalOpen(false);
      setCallNotes("");
      setCallDuration("");
      loadAll();
      
      if (res.data.followup_needed) {
          handleOpenFollowUpModal();
      }
    } catch { 
      toast.error("Failed to log call");
    }
  };

  const sendSms = async () => {
    const errors: Record<string, string> = {};
    if (!smsData.message.trim()) errors.message = "Message is required";

    if (Object.keys(errors).length > 0) {
      setSmsErrors(errors);
      toast.error("Please enter a message");
      return;
    }

    try {
      const phone = selectedContactForSms?.direct_phone || lead?.telephone;
      if (!phone) {
        toast.error("No phone number found for this contact");
        return;
      }
      const cleanTo = phone.startsWith('+') ? phone : `${phonePrefix}${phone.replace(/\D/g, '')}`;

      await api.post("/justcall/send-sms", {
        lead_id: id,
        to: cleanTo,
        message: smsData.message
      });
      toast.success("SMS sent successfully");
      setIsSmsModalOpen(false);
      setSmsData({ message: "" });
      setSmsErrors({});
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send SMS");
    }
  };

  const sendEmail = async () => {
    const errors: Record<string, string> = {};
    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.body.trim()) errors.body = "Message body is required";

    if (Object.keys(errors).length > 0) {
      setEmailErrors(errors);
      toast.error("Please fill all email details");
      return;
    }

    try {
      await api.post("/emails/send", {
        lead_id: id,
        to: selectedContactForEmail?.email,
        cc: emailData.cc.join(", "),
        subject: emailData.subject,
        body: emailData.body
      });
      toast.success("Email sent successfully");
      setIsEmailModalOpen(false);
      setEmailData({ subject: "", body: "", cc: [] });
      setCcInput("");
      setEmailErrors({});
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send email");
    }
  };

  const markDone = async (fuId: string) => {
    setTaskToComplete(fuId);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete) return;
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up completed");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
      loadAll();
    } catch { }
  };

  if (!lead) return <AppLayout><div className="p-12 text-center animate-pulse dark:text-muted-foreground">Loading details...</div></AppLayout>;

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
                {isEditing ? "Edit Lead" : lead.name}
              </h1>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => { setIsEditing(false); setEditData(lead); }} className="btn-secondary">Cancel</button>
                    <button onClick={() => saveLead()} className="btn-primary flex items-center gap-2">
                      <Save size={16} /> Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="btn-secondary" title="Edit Lead"><Edit size={16} /></button>
                  </>
                )}
              </div>
            </div>

            {/* Action Area (Section 9/9a) */}
            <div className="flex flex-wrap gap-2 mb-8 p-4 bg-accent/20 dark:bg-accent/5 rounded-2xl border border-primary/10">
              <button onClick={() => setIsNoteModalOpen(true)} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider">
                <FileText size={14} /> Add Note
              </button>
              <button onClick={() => initiateCall(lead.contacts?.[0] || null)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-md">
                <Phone size={14} /> Make Call
              </button>
              <button onClick={() => { setSelectedContactForSms(lead.contacts?.[0] || null); setIsSmsModalOpen(true); }} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider">
                <MessageSquare size={14} /> Send SMS
              </button>
              <button onClick={handleOpenFollowUpModal} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider">
                <CalendarPlus size={14} /> Create Follow-Up
              </button>
              <button onClick={() => { setSelectedContactForMeeting(lead.contacts?.[0] || null); setIsMeetingModalOpen(true); }} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider">
                <Video size={14} /> Schedule Meeting
              </button>
              <button onClick={() => { setSelectedContactForEmail(lead.contacts?.[0] || null); setIsEmailModalOpen(true); }} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider">
                <Send size={14} /> Send Email
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { label: "Campaign", key: "campaign_id" },
                { label: "Lead Type", key: "type" },
                { label: "Category / Group", key: "category_group" },
                { label: "Telephone", key: "telephone" },
                { label: "Website", key: "website" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{label}</label>
                  {isEditing ? (
                    key === "type" ? (
                      <select
                        className="input-field dark:bg-card"
                        value={(editData as any)[key] || ""}
                        onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                      >
                        <option value="">Select type...</option>
                        <option>Public</option>
                        <option>Private</option>
                        <option>Parent</option>
                      </select>
                    ) : key === "campaign_id" ? (
                      <select
                        className="input-field dark:bg-card"
                        value={typeof editData.campaign_id === 'object' ? editData.campaign_id?._id : editData.campaign_id || ""}
                        onChange={e => setEditData({ ...editData, campaign_id: e.target.value })}
                      >
                        <option value="">Select campaign...</option>
                        {campaigns.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      key === "telephone" ? (
                        <div className="flex gap-2">
                          <div className="relative w-28 shrink-0">
                            <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                              {phonePrefix}
                            </div>
                            <select 
                              className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                              style={{ 
                                backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === phonePrefix)?.code || 'US').toLowerCase()}.png)`,
                                backgroundPosition: 'left 0.5rem center'
                              }}
                              value={phonePrefix}
                              onChange={(e) => setPhonePrefix(e.target.value)}
                            >
                              {countryCodes.map(c => (
                                <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                  {c.name} ({c.dialCode})
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                              <ChevronDown size={12} />
                            </div>
                          </div>
                          <input 
                            className="input-field flex-1" 
                            value={(editData as any)[key] || ""} 
                            onChange={e => setEditData({ ...editData, [key]: e.target.value })} 
                          />
                        </div>
                      ) : (
                        <input
                          className="input-field dark:bg-card"
                          value={(editData as any)[key] || ""}
                          onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                        />
                      )
                    )
                  ) : (
                    <p className="text-foreground">
                      {key === "campaign_id" 
                        ? (lead.campaign_id?.name || "N/A") 
                        : ((lead as any)[key] || "N/A")}
                    </p>
                  )}
                </div>
              ))}

              {isEditing && (
                <>
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <User size={16} className="text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">Primary Contact Person</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                        <input className="input-field" value={editData.main_contact_name || ""} onChange={e => setEditData({ ...editData, main_contact_name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title / Role</label>
                        <input className="input-field" value={editData.contact_title || ""} onChange={e => setEditData({ ...editData, contact_title: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Department</label>
                        <input className="input-field" value={editData.contact_department || ""} onChange={e => setEditData({ ...editData, contact_department: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Direct Phone</label>
                        <div className="flex gap-2">
                          <div className="relative w-28 shrink-0">
                            <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                              {contactPhonePrefix}
                            </div>
                            <select 
                              className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                              style={{ 
                                backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === contactPhonePrefix)?.code || 'US').toLowerCase()}.png)`,
                                backgroundPosition: 'left 0.5rem center'
                              }}
                              value={contactPhonePrefix}
                              onChange={(e) => setContactPhonePrefix(e.target.value)}
                            >
                              {countryCodes.map(c => (
                                <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                  {c.name} ({c.dialCode})
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                              <ChevronDown size={12} />
                            </div>
                          </div>
                          <input className="input-field flex-1" value={editData.contact_direct_phone || ""} onChange={e => setEditData({ ...editData, contact_direct_phone: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label>
                        <input className="input-field" value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-orange-500/10">
                        <User size={16} className="text-orange-500" />
                      </div>
                      <h3 className="font-semibold text-foreground">Secondary Contact Person</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                        <input className="input-field" value={editData.secondary_contact_name || ""} onChange={e => setEditData({ ...editData, secondary_contact_name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title / Role</label>
                        <input className="input-field" value={editData.secondary_contact_title || ""} onChange={e => setEditData({ ...editData, secondary_contact_title: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Direct Phone</label>
                        <div className="flex gap-2">
                          <div className="relative w-28 shrink-0">
                            <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                              {secondaryPhonePrefix}
                            </div>
                            <select 
                              className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                              style={{ 
                                backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === secondaryPhonePrefix)?.code || 'US').toLowerCase()}.png)`,
                                backgroundPosition: 'left 0.5rem center'
                              }}
                              value={secondaryPhonePrefix}
                              onChange={(e) => setSecondaryPhonePrefix(e.target.value)}
                            >
                              {countryCodes.map(c => (
                                <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                                  {c.name} ({c.dialCode})
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                              <ChevronDown size={12} />
                            </div>
                          </div>
                          <input className="input-field flex-1" value={editData.secondary_contact_phone || ""} onChange={e => setEditData({ ...editData, secondary_contact_phone: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label>
                        <input className="input-field" value={editData.secondary_contact_email || ""} onChange={e => setEditData({ ...editData, secondary_contact_email: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Address</label>
                {isEditing ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input className="input-field md:col-span-1 dark:bg-card" placeholder="No." value={editData.address_number || ""} onChange={e => setEditData({ ...editData, address_number: e.target.value })} />
                    <input className="input-field md:col-span-1 dark:bg-card" placeholder="Street" value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="City" value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="State" value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                    <input className="input-field dark:bg-card" placeholder="Zip" value={editData.zip || ""} onChange={e => setEditData({ ...editData, zip: e.target.value })} />
                  </div>
                ) : (
                  <p className="text-foreground">{[lead.address_number, lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(" ") || "N/A"}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Status</label>
                {isEditing ? (
                  <select
                    className="input-field dark:bg-card"
                    value={editData.status || ""}
                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                  >
                    {statusLabels.map(label => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${lead.status === 'Signed' || lead.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                    lead.status === 'Meeting Scheduled' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    }`}>
                    {lead.status}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Hours</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input type="time" className="input-field dark:bg-card" value={editData.start_time || ""} onChange={e => setEditData({ ...editData, start_time: e.target.value })} />
                    <span className="flex items-center text-muted-foreground">to</span>
                    <input type="time" className="input-field dark:bg-card" value={editData.end_time || ""} onChange={e => setEditData({ ...editData, end_time: e.target.value })} />
                  </div>
                ) : (
                  <p className="text-foreground">{lead.start_time || "--:--"} – {lead.end_time || "--:--"}</p>
                )}
              </div>
            </div>
          </div>
          {/* Contacts List */}
          <div className="page-card dark:bg-card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <User size={16} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Contacts</h2>
                <span className="text-xs text-muted-foreground ml-1">({lead.contacts?.length || 0})</span>
              </div>
            </div>

            <div className="space-y-4">
              {(!lead.contacts || lead.contacts.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No contacts found.</p>
              ) : (
                lead.contacts.map((contact) => (
                  <div key={contact._id} className={`p-4 rounded-xl border ${contact.is_primary ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          {contact.name}
                          {contact.is_primary ? (
                            <span className="text-[10px] uppercase font-bold bg-primary text-white px-1.5 py-0.5 rounded-md">Primary</span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold bg-orange-500/80 text-white px-1.5 py-0.5 rounded-md">Secondary</span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">{contact.title || "No Title"} {contact.department ? `• ${contact.department}` : ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => initiateCall(contact)}
                          className="p-1.5 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 rounded-lg transition-colors"
                          title="Make Call via JustCall"
                        >
                          <Phone size={14} />
                        </button>
                        <button 
                          onClick={() => { setSelectedContactForNote(contact); setIsNoteModalOpen(true); }}
                          className="p-1.5 bg-accent/50 hover:bg-accent rounded-lg text-slate-700 hover:text-primary transition-all border border-border/50"
                          title="Add Note"
                        >
                          <FileText size={14} strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => { setSelectedContactForSms(contact); setIsSmsModalOpen(true); }}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title="Send SMS"
                        >
                          <MessageSquare size={14} strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => { setSelectedContactForEmail(contact); setIsEmailModalOpen(true); }}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title="Send Email"
                        >
                          <Mail size={14} strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => { setSelectedContactForMeeting(contact); setIsMeetingModalOpen(true); }}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title="Schedule Meeting"
                        >
                          <CalendarPlus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 mt-3 pt-3 border-t border-border/50">
                      <div 
                        className="flex items-center gap-2 text-sm cursor-pointer group/phone hover:text-orange-600 transition-colors"
                        onClick={() => initiateCall(contact)}
                        title="Click to call via JustCall"
                      >
                        <Phone size={14} className="text-muted-foreground group-hover/phone:text-orange-600" />
                        <span className="text-foreground group-hover/phone:text-orange-600 font-medium">
                          {contact.direct_phone || "N/A"} {contact.extension && `x${contact.extension}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={14} strokeWidth={2.5} className="text-slate-600" />
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="text-primary hover:underline font-medium">{contact.email}</a>
                        ) : (
                          <span className="text-foreground">N/A</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} strokeWidth={2.5} className="text-slate-600" />
                        <span className="text-foreground font-medium">Best time: {contact.best_time || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare size={14} strokeWidth={2.5} className="text-slate-600" />
                        <span className="text-foreground font-medium">Prefers: {contact.preferred_method || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Communication Log / Notes */}
          <div id="notes-section" className="page-card dark:bg-card">
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
              <button onClick={() => addNote()} className="btn-primary">Save Note</button>
            </div>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No notes recorded yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n._id} className="p-3 bg-accent/50 dark:bg-accent/10 rounded-lg border border-border dark:border-border/20 flex items-start gap-3 group">
                    <div className="mt-1">
                      {n.type === 'email' ? <Mail size={14} className="text-blue-500" /> :
                       n.type === 'meeting' ? <Video size={14} className="text-purple-500" /> :
                       n.type === 'status_change' ? <CheckCircle2 size={14} className="text-green-500" /> :
                       n.type === 'call' ? <Phone size={14} className="text-orange-500" /> :
                       n.type === 'sms' ? <MessageSquare size={14} className="text-blue-400" /> :
                       <MessageSquare size={14} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground mb-1 break-words whitespace-pre-wrap">{n.content}</p>
                      {n.type === 'email' && n.metadata?.subject && (
                        <p className="text-xs text-muted-foreground mb-1 italic">Subject: {n.metadata.subject}</p>
                      )}
                      {n.type === 'call' && n.metadata?.recording_url && (
                        <div className="mt-3 p-2.5 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3 group/audio max-w-sm">
                          <button 
                            onClick={(e) => {
                              const audio = e.currentTarget.nextElementSibling as HTMLAudioElement;
                              if (audio.paused) {
                                audio.play();
                                e.currentTarget.classList.add('bg-primary', 'text-white');
                              } else {
                                audio.pause();
                                e.currentTarget.classList.remove('bg-primary', 'text-white');
                              }
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-card border shadow-sm text-primary hover:scale-105 transition-all"
                          >
                            <Play size={14} className="ml-0.5 group-data-[playing=true]:hidden" />
                          </button>
                          <audio 
                            src={n.metadata.recording_url} 
                            onPlay={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'true')}
                            onPause={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'false')}
                            onEnded={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'false')}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-tight text-primary/70">Call Recording</p>
                            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                              {n.metadata.duration ? (
                                <span className="flex items-center gap-1"><Clock size={10} /> {Math.floor(n.metadata.duration / 60)}:{(n.metadata.duration % 60).toString().padStart(2, '0')}</span>
                              ) : "Audio Recording"}
                            </p>
                          </div>
                          <a 
                            href={n.metadata.recording_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                            title="Open recording in new tab"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => confirmDeleteNote(n._id)}
                      className="p-1.5 rounded-lg bg-destructive/5 hover:bg-destructive/20 text-destructive/70 hover:text-destructive transition-all shrink-0 mt-0.5"
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
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
                followUps.filter(f => f.status === 'pending').map((f) => {
                  const getStatusStyles = (dateStr: string) => {
                    const d = new Date(dateStr);
                    const now = new Date();
                    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (dDate < nowDate) return "border-l-destructive bg-destructive/5";
                    if (dDate.getTime() === nowDate.getTime()) return "border-l-warning bg-warning/5";
                    return "border-l-success bg-success/5";
                  };
                  return (
                    <div key={f._id} className={`p-3 rounded-lg border border-l-4 transition-all ${getStatusStyles(f.date_time)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">{f.type}</span>
                            <span className="text-xs font-bold text-foreground">{new Date(f.date_time).toLocaleString()}</span>
                          </div>
                          {f.notes && <p className="text-sm text-muted-foreground mt-0.5">{f.notes}</p>}
                        </div>
                        <button
                          onClick={() => markDone(f._id)}
                          className="text-xs text-muted-foreground hover:text-success border border-border hover:border-success px-2 py-1 rounded transition-colors whitespace-nowrap"
                        >
                          Mark Done
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="page-card bg-primary/5 border-none">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Context</span>
            </div>
            <p className="text-sm text-foreground">
              All follow-ups for this lead also appear on the Dashboard, grouped by due date.
            </p>
          </div>
        </div>
      </div>

      {/* Follow-up Modal */}
      <Dialog open={isFollowUpModalOpen} onOpenChange={(open) => {
        setIsFollowUpModalOpen(open);
        if (!open) setFuErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-md dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Set Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="date" className="text-sm font-medium">Follow-up Time <span className="text-destructive">*</span></label>
              <input
                id="date"
                type="datetime-local"
                className={`input-field dark:bg-card dark:color-scheme-dark ${fuErrors.date ? "border-destructive" : ""}`}
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                required
              />
              {fuErrors.date && <p className="text-xs text-destructive mt-1">{fuErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
                <select 
                  className={`input-field dark:bg-card ${fuErrors.type ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`} 
                  value={followUpType} 
                  onChange={e => setFollowUpType(e.target.value)}
                >
                  <option value="">Select type...</option>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
                {fuErrors.type && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.type}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Priority <span className="text-destructive">*</span></label>
                <select 
                  className={`input-field dark:bg-card ${fuErrors.priority ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`} 
                  value={followUpPriority} 
                  onChange={e => setFollowUpPriority(e.target.value)}
                >
                  <option value="">Select priority...</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                {fuErrors.priority && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.priority}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Assigned User <span className="text-destructive">*</span></label>
              <select 
                className={`input-field dark:bg-card ${fuErrors.assigned ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              >
                <option value="self">Assign to Me</option>
                <option value="other">Other</option>
              </select>
              {assignedTo === "other" && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    className={`input-field ${fuErrors.assigned ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Enter name..."
                    value={customAssignedTo}
                    onChange={(e) => setCustomAssignedTo(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              {fuErrors.assigned && <p className="text-xs text-destructive mt-1">{fuErrors.assigned}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="reason" className="text-sm font-medium">Notes / Instructions <span className="text-muted-foreground text-xs">(optional)</span></label>
              <textarea
                id="reason"
                className="input-field min-h-[80px]"
                placeholder="What needs to happen?"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsFollowUpModalOpen(false);
              setFuErrors({});
            }}>Cancel</button>
            <button className="btn-primary" onClick={() => submitFollowUp()}>Save Follow-up</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Modal */}
      <Dialog open={isMeetingModalOpen} onOpenChange={(open) => {
        setIsMeetingModalOpen(open);
        if (!open) setMeetingErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Schedule Meeting</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Meeting Title <span className="text-destructive">*</span></label>
              <input 
                className={`input-field ${meetingErrors.title ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                placeholder="e.g. Initial Strategy Session" 
                value={meetingData.title} 
                onChange={e => {
                  setMeetingData({...meetingData, title: e.target.value});
                  if (e.target.value.trim()) setMeetingErrors({...meetingErrors, title: ""});
                }} 
              />
              {meetingErrors.title && <p className="text-xs text-destructive font-medium">{meetingErrors.title}</p>}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Date & Time <span className="text-destructive">*</span></label>
              <input 
                type="datetime-local" 
                className={`input-field dark:color-scheme-dark ${meetingErrors.date_time ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                value={meetingData.date_time} 
                onChange={e => {
                  setMeetingData({...meetingData, date_time: e.target.value});
                  if (e.target.value) setMeetingErrors({...meetingErrors, date_time: ""});
                }} 
              />
              {meetingErrors.date_time && <p className="text-xs text-destructive font-medium">{meetingErrors.date_time}</p>}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Meeting Type</label>
              <select className="input-field dark:bg-card" value={meetingData.type} onChange={e => setMeetingData({...meetingData, type: e.target.value})}>
                <option value="Virtual">Virtual (Google Meet)</option>
                <option value="Phone Call">Phone Call</option>
                <option value="In-Person">In-Person</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Invitees</label>
              <div className="p-2 bg-accent/30 rounded border text-xs text-foreground">
                Automatically inviting: <strong>{selectedContactForMeeting?.email}</strong>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
              <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                {meetingCc.map((email, index) => {
                  const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
                  const domain = email.split('@')[1];
                  const domainStatus = verifiedDomains[domain];
                  const isDomainInvalid = domainStatus && domainStatus.valid === false;

                  return (
                    <div 
                      key={index} 
                      onClick={() => {
                        setMeetingCcInput(email);
                        setMeetingCc(meetingCc.filter((_, i) => i !== index));
                      }}
                      title={isDomainInvalid ? `Warning: ${domainStatus.message}` : "Click to edit"}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium animate-in zoom-in-95 duration-200 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${
                        !isValid 
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
                          setMeetingCc(meetingCc.filter((_, i) => i !== index));
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
                  placeholder={meetingCc.length === 0 ? "Add email and press Enter..." : ""}
                  value={meetingCcInput} 
                  onChange={e => {
                    setMeetingCcInput(e.target.value);
                    if (e.target.value.trim()) setMeetingErrors({ ...meetingErrors, cc: "" });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = meetingCcInput.trim().replace(/,$/, '');
                      if (val && !meetingCc.includes(val)) {
                        setMeetingCc([...meetingCc, val]);
                        setMeetingCcInput("");
                        checkDomain(val);
                      }
                    } else if (e.key === 'Backspace' && !meetingCcInput && meetingCc.length > 0) {
                      setMeetingCc(meetingCc.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    const val = meetingCcInput.trim().replace(/,$/, '');
                    if (val && !meetingCc.includes(val)) {
                      setMeetingCc([...meetingCc, val]);
                      setMeetingCcInput("");
                      checkDomain(val);
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea className="input-field min-h-[80px]" placeholder="Agenda or location details..." value={meetingData.notes} onChange={e => setMeetingData({...meetingData, notes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsMeetingModalOpen(false);
              setMeetingCc([]);
              setMeetingCcInput("");
              setMeetingErrors({});
            }}>Cancel</button>
            <button className="btn-primary" onClick={() => scheduleMeeting()}>Schedule & Send Invite</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={(open) => {
        setIsEmailModalOpen(open);
        if (!open) setEmailErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Send Email to {selectedContactForEmail?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
              <div className="p-2 bg-accent/30 rounded border text-sm">{selectedContactForEmail?.email}</div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
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
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium animate-in zoom-in-95 duration-200 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${
                        !isValid 
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
                          setEmailData({...emailData, cc: emailData.cc.filter((_, i) => i !== index)});
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
                  onChange={e => {
                    setCcInput(e.target.value);
                    if (e.target.value.trim()) setEmailErrors({ ...emailErrors, cc: "" });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = ccInput.trim().replace(/,$/, '');
                      if (val && !emailData.cc.includes(val)) {
                        setEmailData({...emailData, cc: [...emailData.cc, val]});
                        setCcInput("");
                        checkDomain(val);
                      }
                    } else if (e.key === 'Backspace' && !ccInput && emailData.cc.length > 0) {
                      setEmailData({...emailData, cc: emailData.cc.slice(0, -1)});
                    }
                  }}
                  onBlur={() => {
                    const val = ccInput.trim().replace(/,$/, '');
                    if (val && !emailData.cc.includes(val)) {
                      setEmailData({...emailData, cc: [...emailData.cc, val]});
                      setCcInput("");
                      checkDomain(val);
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 ml-1 font-medium italic">
                Press Enter or Comma to add • Click a tag to edit typos
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
              <input 
                className={`input-field ${emailErrors.subject ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                placeholder="Meeting follow-up" 
                value={emailData.subject} 
                onChange={e => {
                  setEmailData({...emailData, subject: e.target.value});
                  if (e.target.value.trim()) setEmailErrors({...emailErrors, subject: ""});
                }} 
              />
              {emailErrors.subject && <p className="text-xs text-destructive font-medium">{emailErrors.subject}</p>}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Message Body <span className="text-destructive">*</span></label>
              <textarea 
                className={`input-field min-h-[200px] ${emailErrors.body ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                placeholder="Type your message here..." 
                value={emailData.body} 
                onChange={e => {
                  setEmailData({...emailData, body: e.target.value});
                  if (e.target.value.trim()) setEmailErrors({...emailErrors, body: ""});
                }} 
              />
              {emailErrors.body && <p className="text-xs text-destructive font-medium">{emailErrors.body}</p>}
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsEmailModalOpen(false);
              setEmailErrors({});
            }}>Cancel</button>
            <button 
              className={`btn-primary flex items-center gap-2 ${emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) ? "opacity-50 cursor-not-allowed" : ""}`} 
              onClick={sendEmail}
              disabled={emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e))}
            >
              <Send size={16} /> Send via Gmail
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Call Outcome Modal (Section 9a) */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Log Call Outcome</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Calling: {lead?.contacts?.[0]?.name || "Unknown"} • {lead?.contacts?.[0]?.direct_phone || lead?.telephone}</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Outcome</label>
              <div className="relative p-1 bg-accent/50 rounded-xl border border-border/50 flex flex-wrap gap-1">
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
                    className={`flex-1 min-w-[120px] py-2 px-2 text-[10px] font-bold rounded-lg transition-all relative z-10 ${
                      callOutcome === outcome 
                        ? "text-primary dark:text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {callOutcome === outcome && (
                      <div className="absolute inset-0 bg-white dark:bg-card shadow-sm rounded-lg -z-10 animate-in zoom-in-95 duration-200" />
                    )}
                    {outcome}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Duration (optional)</label>
              <input 
                className="input-field dark:bg-card" 
                placeholder="e.g. 5 mins" 
                value={callDuration} 
                onChange={e => setCallDuration(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Call Notes</label>
              <textarea className="input-field min-h-[100px]" placeholder="Briefly summarize the conversation..." value={callNotes} onChange={e => setCallNotes(e.target.value)} />
            </div>
            <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
              <p className="text-[10px] font-medium text-center">
                <span className="font-bold uppercase mr-1">Important:</span>
                Ensure you click <strong>'Save'</strong> in the JustCall dialer and <strong>'Log & Close'</strong> here to sync activity.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCallModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => logCall()}>Log & Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog open={isSmsModalOpen} onOpenChange={(open) => {
        setIsSmsModalOpen(open);
        if (!open) setSmsErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Send SMS</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
              <div className="p-2 bg-accent/30 rounded border text-sm">{selectedContactForSms?.name} ({selectedContactForSms?.direct_phone || selectedContactForSms?.email})</div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
              <textarea 
                className={`input-field min-h-[120px] ${smsErrors.message ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                placeholder="Type your SMS message..." 
                value={smsData.message} 
                onChange={e => {
                  setSmsData({message: e.target.value});
                  if (e.target.value.trim()) setSmsErrors({});
                }} 
              />
              <div className="flex justify-between items-center">
                {smsErrors.message ? (
                    <p className="text-xs text-destructive font-medium">{smsErrors.message}</p>
                ) : <span />}
                <p className="text-xs text-muted-foreground">{smsData.message.length} chars (approx {Math.ceil((smsData.message.length || 1) / 160)} SMS)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsSmsModalOpen(false);
              setSmsErrors({});
            }}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={sendSms}>
              <MessageSquare size={16} /> Send SMS
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Note Modal */}
      <Dialog open={isNoteModalOpen} onOpenChange={(open) => {
        setIsNoteModalOpen(open);
        if (!open) setNoteError(false);
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Add Note</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Note Details</label>
              <textarea 
                className={`input-field min-h-[150px] ${noteError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`} 
                placeholder="Type your notes here..." 
                value={noteContent} 
                onChange={e => {
                  setNoteContent(e.target.value);
                  if (e.target.value.trim()) setNoteError(false);
                }} 
              />
              {noteError && <p className="text-xs text-destructive mt-1 font-medium">Please fill the notes first</p>}
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsNoteModalOpen(false);
              setNoteError(false);
            }}>Cancel</button>
            <button className="btn-primary" onClick={() => addNote()}>Save Note</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Mark Done Confirmation Modal */}
      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to mark this follow-up task as completed?
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsConfirmDoneOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-success hover:bg-success/90" onClick={handleConfirmDone}>Yes, Mark Done</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation Modal */}
      <Dialog open={isDeleteNoteModalOpen} onOpenChange={setIsDeleteNoteModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center">Delete Note</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to delete this note? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsDeleteNoteModalOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-destructive hover:bg-destructive/90" onClick={deleteNote}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
