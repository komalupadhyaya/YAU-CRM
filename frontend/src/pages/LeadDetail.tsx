import { useEffect, useState, useRef } from "react";
import { useCampaignStore } from "../store/campaignStore";
import { useLeadStore, Lead, Contact } from "../store/schoolStore";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { CalendarPlus, Save, ArrowLeft, History, Info, User, Phone, Mail, Clock, MessageSquare, ChevronDown, ChevronUp, Edit, Video, Send, CheckCircle2, Trash2, Play, Pause, ExternalLink, FileText, Smartphone, X, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { countryCodes } from "../utils/countryCodes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

// --- Helpers ---
const formatTimeForInput = (timeStr?: string) => {
  if (!timeStr) return "";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (match) {
    const [_, hours, mins, ampm] = match;
    let h = parseInt(hours);
    if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${mins.padStart(2, '0')}`;
  }
  return timeStr;
};

interface CRMError {
  response?: {
    data?: {
      message?: string;
      error?: string;
      conflicts?: Array<{ summary: string; start: string }>;
    };
    status?: number;
  };
  message?: string;
}

interface Note {
  _id: string;
  content: string;
  type: 'note' | 'status_change' | 'email' | 'meeting' | 'call' | 'sms';
  metadata?: { subject?: string; recording_url?: string; recording_duration?: number; duration?: number;[key: string]: unknown; };
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

const formatNoteContent = (content: string) => {
  if (!content) return "";
  return content.split('\n').filter(line => !line.trim().startsWith('Contact:')).join('\n');
};

const RecordingPlayer = ({ url, duration }: { url: string, duration?: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (!time) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-3 p-3 bg-accent/30 dark:bg-accent/10 rounded-2xl border border-primary/20 flex flex-col gap-3 group/audio max-w-full shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-white shadow-lg hover:scale-105 transition-all shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-0.5">Call Recording</p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground">{formatTime(currentTime)}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{formatTime(totalDuration)}</span>
          </div>
        </div>

        <a href={url} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground hover:text-primary transition-colors bg-card rounded-lg border shadow-sm">
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-150"
          style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
        />
        <input
          type="range"
          min="0"
          max={totalDuration || 0}
          step="0.1"
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
        />
      </div>

      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setTotalDuration(audioRef.current?.duration || totalDuration)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};

export default function LeadDetail() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isReadOnly = permissions.isReadOnly;

  const { id } = useParams();
  const navigate = useNavigate();
  const { setSelectedLead } = useLeadStore();
  const [lead, setLead] = useState<Lead | null>(null);
  const primaryContact = lead?.contacts?.find(c => c.is_primary) || lead?.contacts?.[0] || null;
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<any>({});
  const { statusLabels, campaigns } = useCampaignStore();
  const [showSecondary, setShowSecondary] = useState(false);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("Medium");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");
  const customAssignedRef = useRef<HTMLInputElement>(null);
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
  const [emailData, setEmailData] = useState({ subject: "Meeting follow-up", body: "", cc: [] as string[], to: "" });
  const emailToRef = useRef<HTMLInputElement>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [createFollowUpInCall, setCreateFollowUpInCall] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [customType, setCustomType] = useState("");

  const populateEditData = (dataToEdit: Lead) => {
    if (!dataToEdit) return;
    const getPrefix = (phone: string) => {
      if (!phone?.startsWith('+')) return "+1";
      const found = countryCodes.find(c => phone.startsWith(c.dialCode));
      return found ? found.dialCode : "+1";
    };

    setPhonePrefix(getPrefix(dataToEdit.telephone));
    const primary = dataToEdit.contacts?.find((c: Contact) => c.is_primary);
    const secondary = dataToEdit.contacts?.find((c: Contact) => !c.is_primary);

    setContactPhonePrefix(getPrefix(primary?.direct_phone));
    setSecondaryPhonePrefix(getPrefix(secondary?.direct_phone));

    const stripPrefix = (phone: string) => {
      if (!phone) return "";
      const found = countryCodes.find(c => phone.startsWith(c.dialCode));
      return found ? phone.slice(found.dialCode.length) : phone;
    };

    setEditData({
      ...dataToEdit,
      telephone: stripPrefix(dataToEdit.telephone),
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
      secondary_contact_department: secondary?.department || "",
      secondary_contact_phone: stripPrefix(secondary?.direct_phone),
      secondary_contact_extension: secondary?.extension || "",
      secondary_contact_email: secondary?.email || "",
    });

    if (dataToEdit.type && !["Public", "Private", "Parent"].includes(dataToEdit.type)) {
      setCustomType(dataToEdit.type);
    } else {
      setCustomType("");
    }
  };

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const loadAll = async (silent = false) => {
    if (!silent) setInitialLoading(true);
    if (!silent) setLoadingNotes(true);
    try {
      const [leadRes, notesRes, followUpsRes] = await Promise.all([
        api.get("/leads/" + id),
        api.get("/notes/" + id),
        api.get("/followups/lead/" + id),
      ]);
      const leadData = leadRes.data;

      // Update states only if they actually changed to prevent flickering
      setLead(prev => JSON.stringify(prev) === JSON.stringify(leadData) ? prev : leadData);
      setNotes(prev => JSON.stringify(prev) === JSON.stringify(notesRes.data) ? prev : notesRes.data);
      setFollowUps(prev => JSON.stringify(prev) === JSON.stringify(followUpsRes.data) ? prev : followUpsRes.data);

      // Populate edit data if we aren't currently editing
      if (!isEditingRef.current) {
        populateEditData(leadData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setInitialLoading(false);
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      api.get("/team")
        .then(res => setTeamMembers(res.data))
        .catch(err => console.error("Failed to fetch team members in LeadDetail:", err));
    }
  }, [currentUser]);

  useEffect(() => {
    if (assignedTo === "other" && isFollowUpModalOpen) {
      setTimeout(() => customAssignedRef.current?.focus(), 100);
    }
  }, [assignedTo, isFollowUpModalOpen]);

  useEffect(() => {
    if (isEmailModalOpen && !selectedContactForEmail?.email) {
      setTimeout(() => emailToRef.current?.focus(), 100);
    }
  }, [isEmailModalOpen, selectedContactForEmail]);

  const saveLead = async () => {
    if (isSubmitting) return;
    if (!editData.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...editData,
        type: editData.type === "Other" ? customType : editData.type,
        telephone: editData.telephone ? (phonePrefix + editData.telephone.replace(/\D/g, '')) : "",
        contact_direct_phone: editData.contact_direct_phone ? (contactPhonePrefix + editData.contact_direct_phone.replace(/\D/g, '')) : "",
        secondary_contact_phone: editData.secondary_contact_phone ? (secondaryPhonePrefix + editData.secondary_contact_phone.replace(/\D/g, '')) : "",
      };
      const res = await api.put("/leads/" + id, payload);
      setSelectedLead(res.data);
      setLead(res.data);
      setIsEditing(false);
      isEditingRef.current = false;
      await loadAll(true);
      toast.success("Lead and contacts updated successfully");
    } catch {
      toast.error("Failed to update lead details");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addNote = async () => {
    if (isSubmitting) return;
    if (!noteContent.trim()) {
      setNoteError(true);
      toast.error("Please fill the notes first");
      return;
    }
    setIsSubmitting(true);
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
      await loadAll();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
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
      await loadAll();
      setIsDeleteNoteModalOpen(false);
      setNoteToDelete(null);
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const deleteAllNotes = async () => {
    try {
      await api.delete(`/notes/lead/${id}/all`);
      toast.success("All notes deleted");
      await loadAll();
    } catch {
      toast.error("Failed to delete all notes");
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
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    const now = new Date();

    if (!followUpDate) {
      errors.date = "Date and time are required";
    } else if (new Date(followUpDate) < now) {
      errors.date = "Date & Time cannot be in the past";
    }

    if (!followUpType) errors.type = "Type is required";
    if (!followUpPriority) errors.priority = "Priority is required";

    if (!followUpNotes.trim()) {
      errors.notes = "Please provide a reason or notes for the follow-up";
    }

    if (assignedTo === "other" && !customAssignedTo.trim()) {
      errors.assigned = "Please specify who this is assigned to";
    }

    if (Object.keys(errors).length > 0) {
      setFuErrors(errors);
      toast.error("Please fill in all required fields marked with *");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalAssigned = assignedTo === "self" ? "Me" : customAssignedTo.trim();
      await api.post("/followups/" + id, {
        date_time: new Date(followUpDate).toISOString(),
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
    } catch (err: unknown) {
      if ((err as CRMError).response?.status === 409) {
        const conflicts = (err as CRMError).response.data.conflicts || [];
        const conflictNames = conflicts.map((c: { summary: string }) => c.summary).join(", ");
        if (window.confirm(`Calendar Conflict: "${conflictNames || 'Existing Event'}" detected. Schedule anyway?`)) {
          setIsSubmitting(false); // Reset to allow retry
          submitFollowUp(contactId, true);
          return;
        } else {
          // User chose to cancel - Log the cancellation to the activity feed
          try {
            await api.post("/notes/" + id, {
              content: `The ${followUpType} scheduled for ${new Date(followUpDate).toLocaleString()} was CANCELED due to a calendar conflict.`
            });
            loadAll();
          } catch (noteErr) {
            console.error("Failed to log conflict cancellation:", noteErr);
          }
        }
      } else {
        toast.error((err as CRMError).response?.data?.message || "Failed to schedule follow-up");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const scheduleMeeting = async (force = false) => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    if (!meetingData.title.trim()) errors.title = "Meeting title is required";
    if (!meetingData.date_time) errors.date_time = "Date and time are required";

    if (Object.keys(errors).length > 0) {
      setMeetingErrors(errors);
      toast.error("Please fill all meeting details");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post("/followups/" + id, {
        date_time: new Date(meetingData.date_time).toISOString(),
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
    } catch (err: unknown) {
      if ((err as CRMError).response?.status === 409) {
        const conflict = (err as CRMError).response.data.conflicts[0];
        if (window.confirm(`Conflict detected: "${conflict.summary}" at ${new Date(conflict.start).toLocaleTimeString()}. Schedule anyway?`)) {
          setIsSubmitting(false);
          scheduleMeeting(true);
          return;
        } else {
          // User chose to cancel - Log the cancellation to the activity feed
          try {
            await api.post("/notes/" + id, {
              content: `The meeting "${meetingData.title}" scheduled for ${new Date(meetingData.date_time).toLocaleString()} was CANCELED due to a calendar conflict.`
            });
            loadAll();
          } catch (noteErr) {
            console.error("Failed to log conflict cancellation:", noteErr);
          }
        }
      } else {
        toast.error((err as CRMError).response?.data?.message || (err as CRMError).message || "Failed to schedule meeting");
      }
    } finally {
      setIsSubmitting(false);
    }
  };



  const initiateCall = (contact: Contact | null) => {
    if (isReadOnly) return;
    setSelectedContactForCall(contact); // Keep track of who we are calling
    const phone = contact?.direct_phone || lead?.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `${phonePrefix}${phone.replace(/\D/g, '')}`;
      window.open(`https://app.justcall.io/dialer?numbers=${encodeURIComponent(cleanPhone)}&ticket_id=${id}&custom_field=${id}&notes=${encodeURIComponent('CRM Lead ID: ' + id)}`, "JustCallDialer", "fullscreen=yes,location=no,width=385,height=665");
    }
    // Open the outcome modal so the agent can log it when they finish
    setCallOutcome("Answered - Interested"); // Default
    setCallNotes("");
    setCreateFollowUpInCall(false);
    setFollowUpTitle("");
    setFollowUpDate("");
    setFollowUpNotes("");
    setFollowUpType("Call");
    setFollowUpPriority("Medium");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setFuErrors({});
    setIsCallModalOpen(true);
  };

  const logCall = async () => {
    if (isSubmitting) return;

    // Validate follow-up details if the checkbox is checked
    const newErrors: Record<string, string> = {};
    if (createFollowUpInCall) {
      if (!followUpTitle.trim()) {
        newErrors.followUpTitle = "Follow-up Title is required";
      }
      if (!followUpDate) {
        newErrors.date = "Date & Time is required";
      } else if (new Date(followUpDate) < new Date()) {
        newErrors.date = "Date & Time cannot be in the past";
      }
      if (assignedTo === "other" && !customAssignedTo.trim()) {
        newErrors.assignedTo = "Please specify who this is assigned to";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFuErrors(newErrors);
      toast.error("Please fix the errors before scheduling");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/justcall/log-call`, {
        lead_id: id,
        outcome: callOutcome,
        notes: callNotes,
        contact_name: selectedContactForCall?.name || lead?.name || 'Unknown'
      });
      toast.success("Call logged");
      setIsCallModalOpen(false);
      setCallNotes("");

      // Create Follow Up if enabled
      if (createFollowUpInCall) {
        try {
          await api.post(`/followups/${id}`, {
            title: followUpTitle,
            date_time: new Date(followUpDate).toISOString(),
            type: followUpType,
            priority: followUpPriority,
            notes: followUpNotes || `Call Follow-Up: ${followUpTitle}`,
            assigned_user: assignedTo === "self" ? "self" : (assignedTo === "other" ? customAssignedTo : assignedTo),
            force: true
          });
          toast.success("Follow-up scheduled!");
        } catch (fuErr: any) {
          toast.error(fuErr.response?.data?.message || "Failed to schedule follow-up");
        }
      }

      // Reset follow-up state
      setFollowUpTitle("");
      setFollowUpDate("");
      setFollowUpNotes("");
      setFollowUpType("Call");
      setFollowUpPriority("Medium");
      setAssignedTo("self");
      setCustomAssignedTo("");
      setCreateFollowUpInCall(false);
      setFuErrors({});

      loadAll();
    } catch {
      toast.error("Failed to log call");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendSms = async () => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    if (!smsData.message.trim()) errors.message = "Message is required";

    if (Object.keys(errors).length > 0) {
      setSmsErrors(errors);
      toast.error("Please enter a message");
      return;
    }

    setIsSubmitting(true);
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
    } catch (err: unknown) {
      toast.error((err as CRMError).response?.data?.message || "Failed to send SMS");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendEmail = async () => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.body.trim()) errors.body = "Message body is required";

    // Use contact email OR manually typed email
    const recipientEmail = selectedContactForEmail?.email || emailData.to?.trim();
    if (!recipientEmail) errors.to = "Recipient email is required";

    if (Object.keys(errors).length > 0) {
      setEmailErrors(errors);
      toast.error("Please fill all email details");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/emails/send", {
        lead_id: id,
        to: recipientEmail,
        cc: emailData.cc.join(", "),
        subject: emailData.subject,
        body: emailData.body
      });
      toast.success("Email sent successfully");
      setIsEmailModalOpen(false);
      setEmailData({ subject: "", body: "", cc: [], to: "" });
      setCcInput("");
      setEmailErrors({});
      loadAll();
    } catch (err: unknown) {
      toast.error((err as CRMError).response?.data?.message || "Failed to send email");
    } finally {
      setIsSubmitting(false);
    }
  };

  const markDone = async (fuId: string) => {
    setTaskToComplete(fuId);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up completed");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
      loadAll();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading) return <AppLayout><div className="p-12 text-center animate-pulse dark:text-muted-foreground">Loading details...</div></AppLayout>;
  if (!lead) return <AppLayout><div className="p-12 text-center"><div className="bg-destructive/10 text-destructive p-4 rounded-lg inline-block font-medium">Lead not found or has been deleted.</div><button onClick={() => navigate(-1)} className="block mx-auto mt-4 text-primary hover:underline font-medium">Go Back</button></div></AppLayout>;

  return (
    <AppLayout>
      <button onClick={() => navigate(-1)} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground dark:hover:text-foreground mb-6 transition-colors">
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
                    <button onClick={() => { setIsEditing(false); populateEditData(lead); }} className="btn-secondary">Cancel</button>
                    <button
                      onClick={() => saveLead()}
                      disabled={isSubmitting}
                      className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Save size={16} /> {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={!isReadOnly ? () => setIsEditing(true) : undefined}
                      disabled={isReadOnly}
                      className={`btn-secondary ${isReadOnly ? 'opacity-40 blur-[0.5px] cursor-not-allowed pointer-events-none' : ''}`}
                      title={isReadOnly ? 'Read-only access' : 'Edit Lead'}
                    >
                      <Edit size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Action Area — disabled + blurred for view_only */}
            <div className={`flex flex-wrap gap-2 mb-8 p-4 bg-accent/20 dark:bg-accent/5 rounded-2xl border border-primary/10 relative ${isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none select-none' : ''}`}>
              {isReadOnly && (
                <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center cursor-not-allowed" title="Read-only access" />
              )}
              <button 
                disabled={isReadOnly} 
                onClick={() => { setSelectedContactForNote(primaryContact); setIsNoteModalOpen(true); }}
                className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider"
              >
                <FileText size={14} /> Add Note
              </button>
              <button 
                disabled={isReadOnly} 
                onClick={() => initiateCall(primaryContact)}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:bg-orange-600 transition-colors"
              >
                <Phone size={14} /> Make Call
              </button>
              <button 
                disabled={isReadOnly} 
                onClick={() => { setSelectedContactForSms(primaryContact); setIsSmsModalOpen(true); }}
                className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider"
              >
                <MessageSquare size={14} /> Send SMS
              </button>
              <button 
                disabled={isReadOnly} 
                onClick={handleOpenFollowUpModal}
                className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider"
              >
                <CalendarPlus size={14} /> Create Follow-Up
              </button>
              <button 
                disabled={isReadOnly} 
                onClick={() => { setSelectedContactForMeeting(primaryContact); setIsMeetingModalOpen(true); }}
                className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider"
              >
                <Video size={14} /> Schedule Meeting
              </button>
              <button 
                disabled={isReadOnly} 
                onClick={() => {
                  setSelectedContactForEmail(primaryContact);
                  setEmailData(prev => ({ ...prev, to: primaryContact?.email || "" }));
                  setIsEmailModalOpen(true);
                }}
                className="btn-secondary flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider"
              >
                <Send size={14} /> Send Email
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { label: "Organization Name", key: "name" },
                { label: "Campaign", key: "campaign_id" },
                { label: "Lead Type", key: "type" },
                { label: "Category / Group", key: "category_group" },
                { label: "Department", key: "department" },
                { label: "Telephone", key: "telephone" },
                { label: "Website", key: "website" },
                { label: "Start and End Time", key: "hours" },
              ].map(({ label, key }) => (
                <div key={key}>
                  {!(isEditing && key === "hours") && (
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{label}</label>
                  )}
                  {isEditing ? (
                    key === "type" ? (
                      <div className="space-y-2">
                        <select
                          name="type"
                          className="input-field dark:bg-card"
                          value={["Public", "Private", "Parent"].includes(editData[key]) ? editData[key] : (editData[key] ? "Other" : "")}
                          onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                        >
                          <option value="">Select type...</option>
                          <option>Public</option>
                          <option>Private</option>
                          <option>Parent</option>
                          <option>Other</option>
                        </select>
                        {(editData[key] === "Other" || (editData[key] && !["Public", "Private", "Parent"].includes(editData[key]))) && (
                          <input
                            placeholder="Specify lead type..."
                            className="input-field animate-in slide-in-from-top-1 duration-200"
                            value={customType}
                            onChange={e => setCustomType(e.target.value)}
                          />
                        )}
                      </div>
                    ) : key === "hours" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Start Time</label>
                          <input
                            type="time"
                            name="start_time"
                            className="input-field w-full dark:bg-card"
                            value={formatTimeForInput(editData.start_time) || ""}
                            onChange={e => setEditData({ ...editData, start_time: e.target.value })}
                          />
                        </div>
                        <span className="text-muted-foreground font-medium px-1 mt-5">to</span>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">End Time</label>
                          <input
                            type="time"
                            name="end_time"
                            className="input-field w-full dark:bg-card"
                            value={formatTimeForInput(editData.end_time) || ""}
                            onChange={e => setEditData({ ...editData, end_time: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : key === "campaign_id" ? (
                      <select
                        name="campaign_id"
                        className="input-field dark:bg-card"
                        value={typeof editData.campaign_id === 'object' ? editData.campaign_id?._id : editData.campaign_id || ""}
                        onChange={e => setEditData({ ...editData, campaign_id: e.target.value })}
                      >
                        <option value="">Select campaign...</option>
                        {campaigns.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    ) : key === "telephone" ? (
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
                          name="telephone"
                          className="input-field flex-1"
                          value={editData[key] || ""}
                          onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                        />
                        <input
                          name="telephone_extension"
                          className="input-field w-20"
                          placeholder="Ext."
                          value={editData.telephone_extension || ""}
                          onChange={setEditData ? e => setEditData({ ...editData, telephone_extension: e.target.value }) : undefined}
                        />
                      </div>
                    ) : (
                      <input
                        name={key}
                        className="input-field dark:bg-card"
                        value={editData[key] || ""}
                        onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                      />
                    )
                  ) : (
                    <p className="text-foreground">
                      {key === "campaign_id"
                        ? (lead.campaign_id?.name || "N/A")
                        : key === "hours"
                        ? `${lead.start_time || "--:--"} to ${lead.end_time || "--:--"}`
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        : ((lead as any)[key] || "N/A")}
                      {key === "telephone" && lead.telephone_extension && ` x${lead.telephone_extension}`}
                    </p>
                  )}
                </div>
              ))}

              {isEditing && (
                <>
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-start gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <User size={16} className="text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">Primary Contact Person</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                        <input name="main_contact_name" className="input-field" value={editData.main_contact_name || ""} onChange={e => setEditData({ ...editData, main_contact_name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title / Role</label>
                        <input name="contact_title" className="input-field" value={editData.contact_title || ""} onChange={e => setEditData({ ...editData, contact_title: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Department</label>
                        <input name="contact_department" className="input-field" value={editData.contact_department || ""} onChange={e => setEditData({ ...editData, contact_department: e.target.value })} />
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
                          <input name="contact_direct_phone" className="input-field flex-1" value={editData.contact_direct_phone || ""} onChange={e => setEditData({ ...editData, contact_direct_phone: e.target.value })} />
                          <input name="contact_extension" className="input-field w-20" placeholder="Ext." value={editData.contact_extension || ""} onChange={e => setEditData({ ...editData, contact_extension: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label>
                        <input name="contact_email" className="input-field" value={editData.contact_email || ""} onChange={e => setEditData({ ...editData, contact_email: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-start gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-orange-500/10">
                        <User size={16} className="text-orange-500" />
                      </div>
                      <h3 className="font-semibold text-foreground">Secondary Contact Person</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Name</label>
                        <input name="secondary_contact_name" className="input-field" value={editData.secondary_contact_name || ""} onChange={e => setEditData({ ...editData, secondary_contact_name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title / Role</label>
                        <input name="secondary_contact_title" className="input-field" value={editData.secondary_contact_title || ""} onChange={e => setEditData({ ...editData, secondary_contact_title: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Secondary Department</label>
                        <input name="secondary_contact_department" className="input-field" value={editData.secondary_contact_department || ""} onChange={e => setEditData({ ...editData, secondary_contact_department: e.target.value })} />
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
                          <input name="secondary_contact_phone" className="input-field flex-1" value={editData.secondary_contact_phone || ""} onChange={e => setEditData({ ...editData, secondary_contact_phone: e.target.value })} />
                          <input name="secondary_contact_extension" className="input-field w-20" placeholder="Ext." value={editData.secondary_contact_extension || ""} onChange={e => setEditData({ ...editData, secondary_contact_extension: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label>
                        <input name="secondary_contact_email" className="input-field" value={editData.secondary_contact_email || ""} onChange={e => setEditData({ ...editData, secondary_contact_email: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Address</label>
                {isEditing ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input name="address_number" className="input-field md:col-span-1 dark:bg-card" placeholder="No." value={editData.address_number || ""} onChange={e => setEditData({ ...editData, address_number: e.target.value })} />
                    <input name="address" className="input-field md:col-span-1 dark:bg-card" placeholder="Street" value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                    <input name="city" className="input-field dark:bg-card" placeholder="City" value={editData.city || ""} onChange={e => setEditData({ ...editData, city: e.target.value })} />
                    <input name="state" className="input-field dark:bg-card" placeholder="State" value={editData.state || ""} onChange={e => setEditData({ ...editData, state: e.target.value })} />
                    <input name="zip" className="input-field dark:bg-card" placeholder="Zip" value={editData.zip || ""} onChange={e => setEditData({ ...editData, zip: e.target.value })} />
                  </div>
                ) : (
                  <p className="text-foreground">{[lead.address_number, lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(" ") || "N/A"}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Status</label>
                {isEditing ? (
                  <select
                    name="status"
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

            </div>
          </div>
          {/* Contacts List */}
          <div className="page-card dark:bg-card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center justify-center gap-2">
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
                        <h3 className="font-semibold text-foreground flex items-center justify-start gap-2">
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
                        <div className={`flex gap-2 ${isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none' : ''}`}>
                        <button
                          onClick={() => !isReadOnly && initiateCall(contact)}
                          disabled={isReadOnly}
                          className="p-1.5 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 rounded-lg transition-colors"
                          title={isReadOnly ? 'Read-only access' : 'Make Call via JustCall'}
                        >
                          <Phone size={14} />
                        </button>
                        <button
                          onClick={() => !isReadOnly && (setSelectedContactForNote(contact), setIsNoteModalOpen(true))}
                          disabled={isReadOnly}
                          className="p-1.5 bg-accent/50 hover:bg-accent rounded-lg text-slate-700 hover:text-primary transition-all border border-border/50"
                          title={isReadOnly ? 'Read-only access' : 'Add Note'}
                        >
                          <FileText size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => !isReadOnly && (setSelectedContactForSms(contact), setIsSmsModalOpen(true))}
                          disabled={isReadOnly}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title={isReadOnly ? 'Read-only access' : 'Send SMS'}
                        >
                          <MessageSquare size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => !isReadOnly && (setSelectedContactForEmail(contact), setEmailData(prev => ({ ...prev, to: contact.email || "" })), setIsEmailModalOpen(true))}
                          disabled={isReadOnly}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title={isReadOnly ? 'Read-only access' : 'Send Email'}
                        >
                          <Mail size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => !isReadOnly && (setSelectedContactForMeeting(contact), setIsMeetingModalOpen(true))}
                          disabled={isReadOnly}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-slate-700 transition-colors border border-border/50"
                          title={isReadOnly ? 'Read-only access' : 'Schedule Meeting'}
                        >
                          <CalendarPlus size={14} strokeWidth={2.5} />
                        </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 mt-3 pt-3 border-t border-border/50">
                      <div
                        className={`flex items-center justify-start gap-2 text-sm transition-colors ${isReadOnly ? 'cursor-default pointer-events-none' : 'cursor-pointer group/phone hover:text-orange-600'}`}
                        onClick={() => !isReadOnly && initiateCall(contact)}
                        title={isReadOnly ? undefined : "Click to call via JustCall"}
                      >
                        <Phone size={14} className={isReadOnly ? "text-muted-foreground" : "text-muted-foreground group-hover/phone:text-orange-600"} />
                        <span className={isReadOnly ? "text-foreground font-medium" : "text-foreground group-hover/phone:text-orange-600 font-medium"}>
                          {contact.direct_phone || "N/A"} {contact.extension && `x${contact.extension}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-start gap-2 text-sm">
                        <Mail size={14} strokeWidth={2.5} className="text-slate-600" />
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="text-primary hover:underline font-medium">{contact.email}</a>
                        ) : (
                          <span className="text-foreground">N/A</span>
                        )}
                      </div>
                      <div className="flex items-center justify-start gap-2 text-sm">
                        <Clock size={14} strokeWidth={2.5} className="text-slate-600" />
                        <span className="text-foreground font-medium">Best time: {contact.best_time || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-start gap-2 text-sm">
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center gap-2">
                <History size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Communication Log</h2>
                <button
                  onClick={() => loadAll()}
                  className="p-1 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-primary"
                  title="Refresh activity feed"
                >
                  <RefreshCw size={14} className={loadingNotes ? "animate-spin" : ""} />
                </button>

                <div className={isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none' : ''}>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete all notes for this lead? This cannot be undone.")) {
                        deleteAllNotes();
                      }
                    }}
                    disabled={isReadOnly}
                    className="text-[9px] text-destructive px-2.5 py-1 bg-destructive/5 hover:bg-destructive hover:text-white border border-destructive/20 rounded-lg font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm ml-1"
                  >
                    <Trash2 size={11} /> Delete All
                  </button>
                </div>
              </div>
            </div>

            {/* Inline note form — hidden for view_only */}
            {!isReadOnly && (
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
            )}

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
                      <p className="text-sm text-foreground mb-1 break-words whitespace-pre-wrap">{formatNoteContent(n.content)}</p>
                      {n.type === 'email' && n.metadata?.subject && (
                        <p className="text-xs text-muted-foreground mb-1 italic">Subject: {n.metadata.subject}</p>
                      )}
                      {n.type === 'call' && n.metadata?.recording_url && (
                        <RecordingPlayer
                          url={n.metadata.recording_url}
                          duration={n.metadata?.recording_duration || n.metadata?.duration}
                        />
                      )}
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className={isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none' : ''}>
                      <button
                        onClick={() => confirmDeleteNote(n._id)}
                        disabled={isReadOnly}
                        className="p-1.5 rounded-lg bg-destructive/5 hover:bg-destructive/20 text-destructive/70 hover:text-destructive transition-all shrink-0 mt-0.5"
                        title="Delete Note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
              <div className="flex items-center justify-center gap-2">
                <CalendarPlus size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Follow-ups</h2>
              </div>
              <button
                onClick={!isReadOnly ? handleOpenFollowUpModal : undefined}
                disabled={isReadOnly}
                className={`text-primary text-sm font-medium ${isReadOnly ? 'opacity-40 blur-[0.5px] cursor-not-allowed pointer-events-none' : 'hover:text-primary/80'}`}
                title={isReadOnly ? 'Read-only access' : 'New follow-up'}
              >
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
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">{f.type}</span>
                            <span className="text-xs font-bold text-foreground">{new Date(f.date_time).toLocaleString()}</span>
                          </div>
                          {f.notes && <p className="text-sm text-muted-foreground mt-0.5">{f.notes}</p>}
                        </div>
                        <button
                          onClick={!isReadOnly ? () => markDone(f._id) : undefined}
                          disabled={isReadOnly}
                          className={`text-xs border px-2 py-1 rounded transition-colors whitespace-nowrap ${isReadOnly ? 'opacity-40 blur-[0.5px] cursor-not-allowed pointer-events-none text-muted-foreground border-border' : 'text-muted-foreground hover:text-success border-border hover:border-success'}`}
                          title={isReadOnly ? 'Read-only access' : 'Mark as done'}
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
            <div className="flex items-center justify-center gap-2 mb-2">
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
      <Dialog
        open={isFollowUpModalOpen}
        onOpenChange={(open) => {
          setIsFollowUpModalOpen(open);
          if (!open) setFuErrors({});
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="date" className="text-sm font-medium">Follow-up Time <span className="text-destructive">*</span></label>
              <input
                id="date"
                type="datetime-local"
                name="date"
                className={`input-field dark:bg-card dark:color-scheme-dark ${fuErrors.date ? "border-destructive focus:ring-destructive/20" : ""}`}
                value={followUpDate || ""}
                onChange={(e) => {
                  setFollowUpDate(e.target.value);
                  if (fuErrors.date) setFuErrors(prev => ({ ...prev, date: "" }));
                }}
                required
              />
              {fuErrors.date && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
                <select
                  name="type"
                  className={`input-field dark:bg-card ${fuErrors.type ? "border-destructive focus:ring-destructive/20" : ""}`}
                  value={followUpType || ""}
                  onChange={e => {
                    setFollowUpType(e.target.value);
                    if (fuErrors.type) setFuErrors(prev => ({ ...prev, type: "" }));
                  }}
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
                  name="priority"
                  className={`input-field dark:bg-card ${fuErrors.priority ? "border-destructive focus:ring-destructive/20" : ""}`}
                  value={followUpPriority || ""}
                  onChange={e => {
                    setFollowUpPriority(e.target.value);
                    if (fuErrors.priority) setFuErrors(prev => ({ ...prev, priority: "" }));
                  }}
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
                name="assignedTo"
                className={`input-field dark:bg-card ${fuErrors.assigned ? "border-destructive focus:ring-destructive/20" : ""}`}
                value={assignedTo || ""}
                onChange={e => {
                  setAssignedTo(e.target.value);
                  if (fuErrors.assigned) setFuErrors(prev => ({ ...prev, assigned: "" }));
                }}
              >
                <option value="self">Assign to Me</option>
                <option value="other">Other</option>
              </select>
              {assignedTo === "other" && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    name="customAssignedTo"
                    ref={customAssignedRef}
                    className={`input-field ${fuErrors.assigned ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Enter name..."
                    value={customAssignedTo || ""}
                    onChange={(e) => {
                      setCustomAssignedTo(e.target.value);
                      if (fuErrors.assigned) setFuErrors(prev => ({ ...prev, assigned: "" }));
                    }}
                  />
                </div>
              )}
              {fuErrors.assigned && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.assigned}</p>}
            </div>
            <div className="grid gap-2">
              <label htmlFor="reason" className="text-sm font-medium">Notes / Instructions <span className="text-destructive">*</span></label>
              <textarea
                id="reason"
                name="notes"
                className={`input-field min-h-[80px] ${fuErrors.notes ? "border-destructive focus:ring-destructive/20" : ""}`}
                placeholder="What needs to happen?"
                value={followUpNotes || ""}
                onChange={(e) => {
                  setFollowUpNotes(e.target.value);
                  if (fuErrors.notes) setFuErrors(prev => ({ ...prev, notes: "" }));
                }}
              />
              {fuErrors.notes && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.notes}</p>}
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsFollowUpModalOpen(false);
              setFuErrors({});
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => submitFollowUp()}
            >
              {isSubmitting ? "Saving..." : "Save Follow-up"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Modal */}
      <Dialog
        open={isMeetingModalOpen}
        onOpenChange={(open) => {
          setIsMeetingModalOpen(open);
          if (!open) setMeetingErrors({});
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Schedule Meeting</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Meeting Title <span className="text-destructive">*</span></label>
                <input
                  name="title"
                  className={`input-field ${meetingErrors.title ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="e.g. Initial Strategy Session"
                  value={meetingData.title || ""}
                  onChange={e => {
                    setMeetingData({ ...meetingData, title: e.target.value });
                    if (e.target.value.trim()) setMeetingErrors({ ...meetingErrors, title: "" });
                  }}
                />
                {meetingErrors.title && <p className="text-xs text-destructive font-medium">{meetingErrors.title}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Date & Time <span className="text-destructive">*</span></label>
                <input
                  type="datetime-local"
                  name="date_time"
                  className={`input-field dark:color-scheme-dark ${meetingErrors.date_time ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  value={meetingData.date_time || ""}
                  onChange={e => {
                    setMeetingData({ ...meetingData, date_time: e.target.value });
                    if (e.target.value) setMeetingErrors({ ...meetingErrors, date_time: "" });
                  }}
                />
                {meetingErrors.date_time && <p className="text-xs text-destructive font-medium">{meetingErrors.date_time}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Meeting Type</label>
                <select
                  name="type"
                  className="input-field dark:bg-card"
                  value={meetingData.type || ""}
                  onChange={e => setMeetingData({ ...meetingData, type: e.target.value })}
                >
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
                    name="cc"
                    placeholder={meetingCc.length === 0 ? "Add email and press Enter..." : ""}
                    value={meetingCcInput || ""}
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
                <textarea
                  name="notes"
                  className="input-field min-h-[80px]"
                  placeholder="Agenda or location details..."
                  value={meetingData.notes || ""}
                  onChange={e => setMeetingData({ ...meetingData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsMeetingModalOpen(false);
              setMeetingCc([]);
              setMeetingCcInput("");
              setMeetingErrors({});
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scheduleMeeting()}
            >
              <CalendarPlus size={16} /> {isSubmitting ? "Scheduling..." : "Schedule & Send Invite"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={(open) => {
        setIsEmailModalOpen(open);
        if (!open) setEmailErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0">
            <DialogTitle className="dark:text-foreground">Send Email to {selectedContactForEmail?.name || lead?.name || "Lead"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">To <span className="text-destructive">*</span></label>
                <input
                  name="to"
                  className={`input-field text-sm ${emailErrors.to ? "border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder={!emailData.to ? "No email on file — type recipient email..." : "Recipient email..."}
                  value={emailData.to || ""}
                  onChange={e => setEmailData({ ...emailData, to: e.target.value })}
                  autoFocus={!!emailData.to}
                />
                {!emailData.to && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 flex items-center gap-1">
                    ⚠️ This contact has no email saved. You can enter one above.
                  </p>
                )}
                {emailErrors.to && <p className="text-[10px] text-destructive font-medium mt-1">{emailErrors.to}</p>}
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
                    name="cc"
                    placeholder={emailData.cc.length === 0 ? "Add email and press Enter..." : ""}
                    value={ccInput || ""}
                    onChange={e => {
                      setCcInput(e.target.value);
                      if (e.target.value.trim()) setEmailErrors({ ...emailErrors, cc: "" });
                    }}
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
                <p className="text-[10px] text-muted-foreground mt-1 ml-1 font-medium italic">
                  Press Enter or Comma to add • Click a tag to edit typos
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
                <input
                  name="subject"
                  className={`input-field ${emailErrors.subject ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="Meeting follow-up"
                  value={emailData.subject || ""}
                  onChange={e => {
                    setEmailData({ ...emailData, subject: e.target.value });
                    if (e.target.value.trim()) setEmailErrors({ ...emailErrors, subject: "" });
                  }}
                />
                {emailErrors.subject && <p className="text-xs text-destructive font-medium">{emailErrors.subject}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Message Body <span className="text-destructive">*</span></label>
                <div className="[&_.ql-editor]:min-h-[180px]">
                  <ReactQuill
                    theme="snow"
                    value={emailData.body}
                    onChange={(content, delta, source, editor) => {
                      setEmailData({ ...emailData, body: content });
                      if (editor.getText().trim()) setEmailErrors({ ...emailErrors, body: "" });
                    }}
                    className="bg-card text-foreground"
                    placeholder="Type your message here..."
                  />
                </div>
                {emailErrors.body && <p className="text-xs text-destructive font-medium">{emailErrors.body}</p>}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsEmailModalOpen(false);
              setEmailErrors({});
            }}>Cancel</button>
            <button
              className={`btn-primary flex items-center justify-center gap-2 ${(emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) || isSubmitting) ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendEmail}
              disabled={emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) || isSubmitting}
            >
              <Send size={16} /> {isSubmitting ? "Sending..." : "Send via Gmail"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Call Outcome Modal (Section 9a) */}
      <Dialog
        open={isCallModalOpen}
        onOpenChange={setIsCallModalOpen}
      >
        <DialogContent aria-describedby={undefined} className="w-[95vw] max-w-xl dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0">
            <DialogTitle className="dark:text-foreground">Log Call Outcome</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Calling: {lead?.contacts?.[0]?.name || "Unknown"} • {lead?.contacts?.[0]?.direct_phone || lead?.telephone}</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
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
                      type="button"
                      key={outcome}
                      onClick={() => setCallOutcome(outcome)}
                      className={`flex-1 min-w-[120px] py-2 px-2 text-[10px] font-bold rounded-lg transition-all relative z-10 ${callOutcome === outcome
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
                <label className="text-sm font-medium">Add Notes</label>
                <textarea
                  name="notes"
                  className="input-field min-h-[80px]"
                  placeholder="Briefly summarize the conversation..."
                  value={callNotes || ""}
                  onChange={e => setCallNotes(e.target.value)}
                />
              </div>

              {/* Seamless Follow-up Checkbox */}
              <div className="flex items-center gap-2 py-2 border-t mt-2">
                <input
                  type="checkbox"
                  id="create-followup-checkbox-detail"
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                  checked={createFollowUpInCall}
                  onChange={e => setCreateFollowUpInCall(e.target.checked)}
                />
                <label htmlFor="create-followup-checkbox-detail" className="text-sm font-bold text-foreground cursor-pointer select-none">
                  Schedule a follow-up task?
                </label>
              </div>

              {createFollowUpInCall && (
                <div className="space-y-4 p-4 rounded-xl border bg-accent/20 animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Follow-up Task Details</h4>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Task Title *</label>
                    <input
                      className={`input-field ${fuErrors.followUpTitle ? "border-destructive focus:ring-destructive/20" : ""}`}
                      placeholder="e.g. Call to finalize contract"
                      value={followUpTitle}
                      onChange={e => {
                        setFollowUpTitle(e.target.value);
                        if (fuErrors.followUpTitle) setFuErrors(prev => ({ ...prev, followUpTitle: "" }));
                      }}
                    />
                    {fuErrors.followUpTitle && <p className="text-[10px] text-destructive font-medium">{fuErrors.followUpTitle}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Date & Time *</label>
                    <input
                      type="datetime-local"
                      className={`input-field dark:color-scheme-dark ${fuErrors.date ? "border-destructive focus:ring-destructive/20" : ""}`}
                      value={followUpDate}
                      onChange={e => {
                        setFollowUpDate(e.target.value);
                        if (fuErrors.date) setFuErrors(prev => ({ ...prev, date: "" }));
                      }}
                    />
                    {fuErrors.date && <p className="text-[10px] text-destructive font-medium">{fuErrors.date}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                      <select className="input-field dark:bg-card" value={followUpType} onChange={e => setFollowUpType(e.target.value)}>
                        <option value="Call">Call</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Task">Task</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Priority</label>
                      <select className="input-field dark:bg-card" value={followUpPriority} onChange={e => setFollowUpPriority(e.target.value)}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Assigned User</label>
                    <select
                      className="input-field dark:bg-card"
                      value={assignedTo}
                      onChange={e => {
                        setAssignedTo(e.target.value);
                        if (fuErrors.assignedTo) setFuErrors(prev => ({ ...prev, assignedTo: "" }));
                      }}
                    >
                      <option value="self">Assign to Me</option>
                      {teamMembers.map(user => (
                        <option key={user._id} value={user.name || user.username}>
                          {user.name || user.username.split('@')[0]} ({user.role === 'sales_rep' ? 'Sales Rep' : user.role})
                        </option>
                      ))}
                      <option value="other">Other (Specify Name)</option>
                    </select>
                    {assignedTo === "other" && (
                      <div className="space-y-1">
                        <input
                          ref={customAssignedRef}
                          className={`input-field mt-2 ${fuErrors.assignedTo ? "border-destructive focus:ring-destructive/20" : ""}`}
                          placeholder="Enter name..."
                          value={customAssignedTo}
                          onChange={(e) => {
                            setCustomAssignedTo(e.target.value);
                            if (fuErrors.assignedTo) setFuErrors(prev => ({ ...prev, assignedTo: "" }));
                          }}
                        />
                        {fuErrors.assignedTo && <p className="text-[10px] text-destructive font-medium">{fuErrors.assignedTo}</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Follow-up Notes</label>
                    <textarea
                      placeholder="Reason for follow-up"
                      className="input-field min-h-[60px]"
                      value={followUpNotes}
                      onChange={e => setFollowUpNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                <p className="text-[10px] font-medium text-center">
                  <span className="font-bold uppercase mr-1">Important:</span>
                  Ensure you click <strong>'Save'</strong> in the JustCall dialer and <strong>'Log & Close'</strong> here to sync activity.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button type="button" className="btn-secondary" onClick={() => setIsCallModalOpen(false)}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => logCall()}
            >
              {isSubmitting ? "Logging..." : "Log & Close"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog
        open={isSmsModalOpen}
        onOpenChange={(open) => {
          setIsSmsModalOpen(open);
          if (!open) setSmsErrors({});
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Send SMS</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
                <div className="p-2 bg-accent/30 rounded border text-sm">
                  {selectedContactForSms 
                    ? `${selectedContactForSms.name} (${selectedContactForSms.direct_phone || selectedContactForSms.email})` 
                    : `${lead?.name} (${lead?.telephone || "No phone number"})`}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
                <textarea
                  name="message"
                  className={`input-field min-h-[120px] ${smsErrors.message ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="Type your SMS message..."
                  value={smsData.message || ""}
                  onChange={e => {
                    setSmsData({ message: e.target.value });
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
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsSmsModalOpen(false);
              setSmsErrors({});
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendSms}
            >
              <MessageSquare size={16} /> {isSubmitting ? "Sending..." : "Send SMS"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Note Modal */}
      <Dialog
        open={isNoteModalOpen}
        onOpenChange={(open) => {
          setIsNoteModalOpen(open);
          if (!open) setNoteError(false);
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Add Note</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Note Details</label>
                <textarea
                  name="note"
                  className={`input-field min-h-[150px] ${noteError ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="Type your notes here..."
                  value={noteContent || ""}
                  onChange={e => {
                    setNoteContent(e.target.value);
                    if (e.target.value.trim()) setNoteError(false);
                  }}
                />
                {noteError && <p className="text-xs text-destructive mt-1 font-medium">Please fill the notes first</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsNoteModalOpen(false);
              setNoteError(false);
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => addNote()}
            >
              {isSubmitting ? "Saving..." : "Save Note"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Done Confirmation Modal */}
      <Dialog
        open={isConfirmDoneOpen}
        onOpenChange={setIsConfirmDoneOpen}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
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
            <button
              disabled={isSubmitting}
              className={`btn-primary flex-1 bg-success hover:bg-success/90 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={handleConfirmDone}
            >
              {isSubmitting ? "Processing..." : "Yes, Mark Done"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation Modal */}
      <Dialog
        open={isDeleteNoteModalOpen}
        onOpenChange={setIsDeleteNoteModalOpen}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-sm dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
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
            <button
              disabled={isSubmitting}
              className={`btn-primary flex-1 bg-destructive hover:bg-destructive/90 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={deleteNote}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}










