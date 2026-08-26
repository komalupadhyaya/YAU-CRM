import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { getRelativeDateLabel } from "../utils/dateHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { countryCodes } from "../utils/countryCodes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Sparkles,
  Eye,
  Edit2,
  Trash2,
  MoreVertical,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Layers,
  Hash,
  Send,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  User,
  Users,
  Building,
  ChevronUp,
  ChevronDown,
  MapPin,
  Headphones,
  Copy,
  Check,
  Play,
  Pause,
  ExternalLink,
  Bot,
  FileText
} from "lucide-react";

interface EALead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  dateSubmitted: string;
  submissionCount: number;
  isConsent: boolean;
  createdAt: string;
  updatedAt: string;
  smsHistory?: Array<{
    direction: "inbound" | "outbound";
    message: string;
    timestamp: string;
    isBulk?: boolean;
    status?: 'pending' | 'sent' | 'failed' | 'received';
    twilioSid?: string;
    _id?: string;
  }>;
  callHistory?: Array<{
    callSid: string;
    parentCallSid?: string;
    direction: "inbound" | "outbound";
    duration: number;
    recordingUrl?: string;
    status: string;
    timestamp: string;
    source?: string;
    retellCallId?: string;
    aiSummary?: string;
    callerSentiment?: string;
    transcript?: string;
    _id?: string;
  }>;
}

export default function EALeads() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  if (!permissions.viewEALeads) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-center">
          <AlertCircle size={40} className="text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            You do not have permission to view the EA Leads section. Please contact your administrator.
          </p>
        </div>
      </AppLayout>
    );
  }

  const [searchParams] = useSearchParams();

  // Leads state
  const [leads, setLeads] = useState<EALead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  // Modal states
  const [selectedLead, setSelectedLead] = useState<EALead | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [callSubTabs, setCallSubTabs] = useState<Record<string, 'summary' | 'transcript'>>({});

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Bulk SMS Modal state
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState("");
  const [sendingBulkSms, setSendingBulkSms] = useState(false);

  // 1-on-1 SMS state
  const [singleSmsMessage, setSingleSmsMessage] = useState("");
  const [sendingSingleSms, setSendingSingleSms] = useState(false);

  // Conversion state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<EALead | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertFormData, setConvertFormData] = useState({
    name: "",
    type: "",
    category_group: "",
    department: "",
    main_contact_name: "",
    main_contact_email: "",
    telephone: "",
    telephone_extension: "",
    city: "",
    state: "",
    address: "",
    address_number: "",
    zip: "",
    website: "",
    start_time: "",
    end_time: "",
    // Primary Contact Person
    contact_title: "",
    contact_department: "",
    contact_direct_phone: "",
    contact_extension: "",
    contact_email: "",
    contact_best_time: "",
    contact_preferred_method: "",
    // Secondary Contact
    secondary_contact_name: "",
    secondary_contact_title: "",
    secondary_contact_department: "",
    secondary_contact_phone: "",
    secondary_contact_extension: "",
    secondary_contact_email: "",
    // Prefixes
    contact_phone_prefix: "+1",
    secondary_phone_prefix: "+1",
    telephone_prefix: "+1",
  });
  const [convertCustomTitle, setConvertCustomTitle] = useState("");
  const [convertSecondaryCustomTitle, setConvertSecondaryCustomTitle] = useState("");
  const [convertCustomLeadType, setConvertCustomLeadType] = useState("");
  const [showConvertSecondary, setShowConvertSecondary] = useState(false);
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({});

  // Manual Add Form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addSource, setAddSource] = useState("Manual Add");
  const [addIsConsent, setAddIsConsent] = useState(true);
  const [adding, setAdding] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit Form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editDateSubmitted, setEditDateSubmitted] = useState("");
  const [editIsConsent, setEditIsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await api.get("/ea-leads");
      setLeads(res.data || []);
    } catch {
      toast.error("Failed to load EA leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [refreshTrigger]);

  // Reset page to 1 when search query or leads list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, leads.length]);

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateString;
    }
  };

  // Convert Date to YYYY-MM-DDTHH:MM for datetime-local input
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());
      const hh = pad(date.getHours());
      const min = pad(date.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    } catch {
      return "";
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (lead: EALead) => {
    setSelectedLead(lead);
    setEditName(lead.name);
    setEditEmail(lead.email);
    setEditPhone(lead.phone);
    setEditSource(lead.source);
    setEditDateSubmitted(formatDateForInput(lead.dateSubmitted));
    setEditIsConsent(lead.isConsent || false);
    setEditDialogOpen(true);
  };

  // Open Add Lead Dialog
  const handleOpenAdd = () => {
    setAddName("");
    setAddEmail("");
    setAddPhone("");
    setAddSource("Manual Add");
    setAddIsConsent(true);
    setAddDialogOpen(true);
  };

  // Save Manual Add Lead
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addName.trim() || !addEmail.trim() || !addPhone.trim()) {
      toast.error("Name, Email, and Phone number are required.");
      return;
    }

    setAdding(true);
    try {
      const updatedData = {
        name: addName,
        email: addEmail,
        phone: addPhone,
        source: addSource,
        isConsent: addIsConsent,
      };

      await api.post("/ea-leads", updatedData);
      
      setRefreshTrigger(prev => prev + 1);
      toast.success("Lead created successfully.");
      setAddDialogOpen(false);
    } catch {
      // API error interceptor already toasts specific duplicate/validation error
      setRefreshTrigger(prev => prev + 1);
    } finally {
      setAdding(false);
    }
  };

  // Handle form change for conversion
  const handleConvertFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConvertFormData(prev => ({ ...prev, [name]: value }));
    if (convertErrors[name]) {
      setConvertErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleConvertRadioChange = (field: string, value: string) => {
    setConvertFormData(prev => ({ ...prev, [field]: value }));
    if (convertErrors[field]) {
      setConvertErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Fetch campaigns for dropdown
  const fetchCampaigns = async () => {
    try {
      const res = await api.get("/campaigns");
      const fetchedCampaigns = res.data || [];
      
      // Check if "EA-Lead" campaign exists case-insensitively
      const eaLeadCampaign = fetchedCampaigns.find(
        (c: any) => c.name.toLowerCase() === "ea-lead"
      );
      
      let finalCampaigns = [...fetchedCampaigns];
      let selectId = "";

      if (eaLeadCampaign) {
        selectId = eaLeadCampaign._id;
      } else {
        // If it does not exist, insert a virtual campaign option at the beginning of the list
        const virtualOption = { _id: "default-ea-lead-campaign", name: "EA-Lead" };
        finalCampaigns = [virtualOption, ...fetchedCampaigns];
        selectId = "default-ea-lead-campaign";
      }

      setCampaigns(finalCampaigns);
      setSelectedCampaignId(selectId);
    } catch {
      toast.error("Failed to fetch campaigns.");
    }
  };

  // Open Convert Dialog
  const handleOpenConvert = (lead: EALead) => {
    setLeadToConvert(lead);
    
    // Clean up country code prefix if it starts with +
    let cleanedPhone = lead.phone || "";
    let matchedPrefix = "+1";
    
    const found = countryCodes.find(c => cleanedPhone.startsWith(c.dialCode));
    if (found) {
      matchedPrefix = found.dialCode;
      cleanedPhone = cleanedPhone.substring(found.dialCode.length);
    } else if (cleanedPhone.startsWith("+")) {
      // General match
      const plusMatch = cleanedPhone.match(/^\+\d+/);
      if (plusMatch) {
        matchedPrefix = plusMatch[0];
        cleanedPhone = cleanedPhone.substring(matchedPrefix.length);
      }
    }

    setConvertFormData({
      name: lead.name,
      type: "",
      category_group: "",
      department: "",
      main_contact_name: lead.name,
      main_contact_email: lead.email,
      telephone: cleanedPhone,
      telephone_extension: "",
      city: "",
      state: "",
      address: "",
      address_number: "",
      zip: "",
      website: "",
      start_time: "",
      end_time: "",
      contact_title: "",
      contact_department: "EA-Lead",
      contact_direct_phone: cleanedPhone,
      contact_extension: "",
      contact_email: lead.email,
      contact_best_time: "Anytime",
      contact_preferred_method: "Text",
      secondary_contact_name: "",
      secondary_contact_title: "",
      secondary_contact_department: "",
      secondary_contact_phone: "",
      secondary_contact_extension: "",
      secondary_contact_email: "",
      contact_phone_prefix: matchedPrefix,
      secondary_phone_prefix: "+1",
      telephone_prefix: matchedPrefix,
    });

    setConvertCustomTitle("");
    setConvertSecondaryCustomTitle("");
    setConvertCustomLeadType("");
    setShowConvertSecondary(false);
    setConvertErrors({});
    fetchCampaigns();
    setConvertDialogOpen(true);
  };

  // Validate Convert Form
  const validateConvertForm = () => {
    const newErrors: Record<string, string> = {};
    if (!convertFormData.name.trim()) newErrors.name = "Organization / School name is required";

    // Primary Contact Person Validation
    if (!convertFormData.main_contact_name.trim()) newErrors.main_contact_name = "Primary contact name is required";
    if (!convertFormData.contact_title) {
      newErrors.contact_title = "Please select a title / role";
    } else if (convertFormData.contact_title === "Other" && !convertCustomTitle.trim()) {
      newErrors.contact_title = "Please specify the custom title";
    }
    if (!convertFormData.contact_department.trim()) newErrors.contact_department = "Department name is required";
    if (!convertFormData.contact_direct_phone.trim()) newErrors.contact_direct_phone = "Direct phone number is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!convertFormData.contact_email.trim()) {
      newErrors.contact_email = "Primary contact email is required";
    } else if (!emailRegex.test(convertFormData.contact_email)) {
      newErrors.contact_email = "Please enter a valid email address";
    }

    if (!convertFormData.contact_best_time) newErrors.contact_best_time = "Please select the best time to call";
    if (!convertFormData.contact_preferred_method) newErrors.contact_preferred_method = "Please select a preferred contact method";

    setConvertErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Lead Conversion
  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadToConvert || !selectedCampaignId) return;

    if (!validateConvertForm()) {
      toast.error("Please fill in all required fields marked with *");
      return;
    }

    setConverting(true);
    try {
      const finalTitle = convertFormData.contact_title === "Other" ? convertCustomTitle.trim() : convertFormData.contact_title;
      const finalSecondaryTitle = convertFormData.secondary_contact_title === "Other" ? convertSecondaryCustomTitle.trim() : convertFormData.secondary_contact_title;

      const payload = {
        ...convertFormData,
        campaignId: selectedCampaignId,
        type: convertFormData.type === "Other" ? convertCustomLeadType : convertFormData.type,
        contact_direct_phone: convertFormData.contact_phone_prefix + convertFormData.contact_direct_phone.replace(/\D/g, ''),
        secondary_contact_phone: convertFormData.secondary_contact_phone ? (convertFormData.secondary_phone_prefix + convertFormData.secondary_contact_phone.replace(/\D/g, '')) : "",
        telephone: convertFormData.telephone ? (convertFormData.telephone_prefix + convertFormData.telephone.replace(/\D/g, '')) : "",
        contact_title: finalTitle,
        secondary_contact_title: finalSecondaryTitle
      };

      await api.post(`/ea-leads/${leadToConvert._id}/convert`, payload);
      toast.success("Lead successfully converted to main CRM Lead.");
      setConvertDialogOpen(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to convert lead.");
    } finally {
      setConverting(false);
    }
  };

  const handleReenableConsent = async () => {
    if (!selectedLead) return;
    try {
      const res = await api.post(`/sms/consent/${selectedLead._id}`, {
        leadType: 'ea_lead',
        consent: true
      });
      toast.success(res.data.message || 'SMS consent successfully re-enabled');
      const freshDetails = { ...selectedLead, isConsent: true };
      setSelectedLead(freshDetails);
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? freshDetails : l));
    } catch (err: any) {
      console.error("Failed to re-enable consent:", err);
      toast.error(err.response?.data?.error || "Failed to re-enable consent");
    }
  };

  // Open View Dialog
  const handleOpenView = async (lead: EALead) => {
    setSelectedLead(lead);
    setViewDialogOpen(true);
    setActiveTab("details");
    try {
      const res = await api.get(`/ea-leads/${lead._id}`);
      setSelectedLead(res.data);
      setLeads(prev => prev.map(l => l._id === lead._id ? res.data : l));
    } catch (err) {
      console.error("Failed to fetch fresh lead details:", err);
    }
  };

  // Open Messages Dialog directly
  const handleOpenMessages = async (lead: EALead) => {
    setSelectedLead(lead);
    setViewDialogOpen(true);
    setActiveTab("messages");
    try {
      const res = await api.get(`/ea-leads/${lead._id}`);
      setSelectedLead(res.data);
      setLeads(prev => prev.map(l => l._id === lead._id ? res.data : l));
    } catch (err) {
      console.error("Failed to fetch fresh lead details:", err);
    }
  };

  // Open Calls Dialog directly
  const handleOpenCalls = async (lead: EALead) => {
    setSelectedLead(lead);
    setViewDialogOpen(true);
    setActiveTab("calls");
    try {
      const res = await api.get(`/ea-leads/${lead._id}`);
      setSelectedLead(res.data);
      setLeads(prev => prev.map(l => l._id === lead._id ? res.data : l));
    } catch (err) {
      console.error("Failed to fetch fresh lead details:", err);
    }
  };

  // Poll for messages when view dialog is open and active tab is "messages"
  useEffect(() => {
    if (!viewDialogOpen || !selectedLead || activeTab !== "messages") return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/ea-leads/${selectedLead._id}`);
        // Only update if there are new messages to avoid state jump
        if (JSON.stringify(res.data.smsHistory) !== JSON.stringify(selectedLead.smsHistory)) {
          setSelectedLead(res.data);
          setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
        }
      } catch (err) {
        console.error("Error polling messages:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [viewDialogOpen, selectedLead?._id, activeTab, selectedLead?.smsHistory]);

  // Open Delete Dialog
  const handleOpenDelete = (lead: EALead) => {
    setSelectedLead(lead);
    setDeleteDialogOpen(true);
  };

  // Save Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (!editName.trim() || !editEmail.trim() || !editPhone.trim()) {
      toast.error("Name, Email, and Phone number are required.");
      return;
    }

    setSaving(true);
    try {
      // Parse the datetime-local string as a plain wall-clock date (no TZ conversion).
      // new Date("YYYY-MM-DDTHH:mm") is treated as UTC by JS spec, which causes
      // a timezone shift. Instead, we interpret the string literally by splitting
      // the parts and constructing the date in local time (no offset applied).
      let dateSubmittedISO: string | undefined = undefined;
      if (editDateSubmitted) {
        const [datePart, timePart = "00:00"] = editDateSubmitted.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        // new Date(year, month-1, day, hour, minute) uses local time — no UTC shift
        const localDate = new Date(year, month - 1, day, hour, minute);
        dateSubmittedISO = localDate.toISOString();
      }

      const updatedData = {
        name: editName,
        email: editEmail,
        phone: editPhone,
        source: editSource,
        dateSubmitted: dateSubmittedISO,
        isConsent: editIsConsent,
      };

      const res = await api.put(`/ea-leads/${selectedLead._id}`, updatedData);
      
      // Update local state
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
      toast.success("Lead details updated successfully.");
      setEditDialogOpen(false);
    } catch {
      // API error is automatically toasted by the global response interceptor in api.ts
    } finally {
      setSaving(false);
    }
  };

  // Delete Lead
  const handleDeleteLead = async () => {
    if (!selectedLead) return;

    setDeleting(true);
    try {
      await api.delete(`/ea-leads/${selectedLead._id}`);
      
      // Update local state
      setLeads(prev => prev.filter(l => l._id !== selectedLead._id));
      toast.success("Lead deleted successfully.");
      setDeleteDialogOpen(false);
    } catch {
      toast.error("Failed to delete lead");
    } finally {
      setDeleting(false);
    }
  };

  // Filter leads based on query
  const filteredLeads = leads.filter(lead => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q) ||
      lead.source.toLowerCase().includes(q)
    );
  });

  // Client-side pagination logic
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Helper to generate pagination items with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push("...");
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push("...");
      }
      
      pages.push(totalPages);
    }
    return pages;
  };

  const renderPagination = (position: "top" | "bottom") => {
    if (totalPages <= 1) return null;

    const pageNumbers = getPageNumbers();
    const borderClass = position === "top" ? "border-b border-border" : "border-t border-border";
    const paddingClass = position === "top" ? "px-4 py-3 sm:px-6 bg-muted/5" : "px-4 py-4 sm:px-6";

    return (
      <div className={`flex items-center justify-between ${borderClass} ${paddingClass} flex-shrink-0`}>
        {/* Mobile layout */}
        <div className="flex flex-1 justify-between sm:hidden">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="border-border text-foreground hover:bg-muted/50"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="border-border text-foreground hover:bg-muted/50"
          >
            Next
          </Button>
        </div>
        
        {/* Desktop layout */}
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-foreground/80 flex items-center gap-1 select-none">
              Showing
              <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border/40">
                {((currentPage - 1) * itemsPerPage) + 1}
              </span>
              to
              <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border/40">
                {Math.min(currentPage * itemsPerPage, filteredLeads.length)}
              </span>
              of
              <span className="font-semibold text-foreground px-0.5">
                {filteredLeads.length}
              </span>
              results
            </p>
          </div>
          <div>
            <div className="inline-flex gap-1.5 font-sans" aria-label="Pagination">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </Button>
              
              {pageNumbers.map((page, idx) => {
                if (page === "...") {
                  return (
                    <span
                      key={`ellipsis-${position}-${idx}`}
                      className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground select-none"
                    >
                      ...
                    </span>
                  );
                }
                const pageNum = page as number;
                return (
                  <Button
                    key={`page-${position}-${pageNum}`}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 text-xs transition-all ${
                      currentPage === pageNum
                        ? "shadow-sm font-semibold"
                        : "border-border text-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allVisibleIds = filteredLeads.map(l => l._id);
      setSelectedIds(allVisibleIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, leadId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== leadId));
    }
  };

  // Submit SMS requests
  const handleSendBulkSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkSmsMessage.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    setSendingBulkSms(true);
    try {
      const res = await api.post("/ea-leads/bulk-sms", {
        message: bulkSmsMessage,
        leadIds: selectedIds
      });
      if (res.data?.failCount > 0) {
        if (res.data?.successCount === 0) {
          toast.error(res.data.message || "Bulk SMS failed to send. Check Twilio Console logs.");
        } else {
          toast.warning(res.data.message || "Bulk SMS partially sent. Some messages failed.");
        }
      } else {
        toast.success(res.data?.message || "Bulk SMS sent successfully.");
      }
      setBulkSmsMessage("");
      setSelectedIds([]);
      setBulkSmsOpen(false);
      fetchLeads();
      
      // Instant message list refresh if the target lead is currently being viewed
      if (selectedLead && selectedIds.includes(selectedLead._id)) {
        const leadRes = await api.get(`/ea-leads/${selectedLead._id}`);
        setSelectedLead(leadRes.data);
      }
    } catch {
      toast.error("Failed to send bulk SMS.");
    } finally {
      setSendingBulkSms(false);
    }
  };

  const handleSendSingleSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !singleSmsMessage.trim()) return;

    setSendingSingleSms(true);
    try {
      const res = await api.post(`/ea-leads/${selectedLead._id}/send-sms`, {
        message: singleSmsMessage
      });
      setSelectedLead(res.data);
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? res.data : l));
      setSingleSmsMessage("");
      toast.success("SMS sent successfully.");
    } catch {
      toast.error("Failed to send SMS.");
    } finally {
      setSendingSingleSms(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-primary" />
              </span>
              EA Leads
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              All Evening Activity leads captured from the website form.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-accent flex items-center gap-1.5"
              onClick={() => setBulkSmsOpen(true)}
              disabled={selectedIds.length === 0}
            >
              <MessageSquare size={16} />
              Send Bulk SMS ({selectedIds.length})
            </Button>
            {permissions.createEdit && (
              <Button
                onClick={handleOpenAdd}
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-1.5"
              >
                <Sparkles size={16} />
                Add EA Lead
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              id="search-ea-leads"
              name="search-ea-leads"
              placeholder="Search by name, email, phone, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border text-foreground w-full"
            />
          </div>
          {/* Items Per Page Selector */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Label htmlFor="items-per-page" className="text-xs text-muted-foreground whitespace-nowrap">
              Show:
            </Label>
            <select
              id="items-per-page"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={30}>30 per page</option>
              <option value={40}>40 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-sm">Loading Evening Activity leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/5 border border-dashed border-border m-4 rounded-xl">
              <AlertCircle className="text-muted-foreground/60 mb-2" size={36} />
              <h3 className="font-semibold text-sm">No EA Leads Found</h3>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs text-center">
                {searchQuery ? "Try refining your search query." : "Leads from the website form will appear here automatically."}
              </p>
            </div>
          ) : (
            <>
              {renderPagination("top")}
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-b border-border">
                    <TableHead className="w-[50px] pl-4">
                      <Checkbox
                        checked={filteredLeads.length > 0 && selectedIds.length === filteredLeads.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead className="text-center">Source</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead className="w-[80px] text-center pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead) => (
                    <TableRow key={lead._id} className="hover:bg-accent/40 border-b border-border">
                      <TableCell className="w-[50px] pl-4">
                        <Checkbox
                           checked={selectedIds.includes(lead._id)}
                           onCheckedChange={(checked) => handleSelectLead(lead._id, !!checked)}
                           aria-label={`Select ${lead.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground truncate max-w-[200px]">
                        {lead.name}
                        {lead.submissionCount > 1 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary border border-primary/20" title={`Submitted ${lead.submissionCount} times`}>
                            x{lead.submissionCount}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">{lead.email}</TableCell>
                      <TableCell className="text-muted-foreground font-medium">{lead.phone}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          {lead.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${lead.isConsent ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500"}`}>
                           {lead.isConsent ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        {formatDateDisplay(lead.dateSubmitted)}
                      </TableCell>
                      <TableCell className="w-[80px] text-center pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-accent text-muted-foreground hover:text-foreground relative"
                              title="Actions"
                            >
                              <MoreVertical size={15} />
                              {lead.callHistory && lead.callHistory.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 bg-card border-border text-foreground shadow-lg">
                            <DropdownMenuItem 
                              onClick={() => handleOpenView(lead)} 
                              className="gap-2.5 cursor-pointer py-2 text-xs font-medium"
                            >
                              <Eye size={14} className="text-muted-foreground" />
                              <span>View Details</span>
                            </DropdownMenuItem>

                            {permissions.createEdit && (
                              <DropdownMenuItem 
                                onClick={() => handleOpenEdit(lead)} 
                                className="gap-2.5 cursor-pointer py-2 text-xs font-medium"
                              >
                                <Edit2 size={14} className="text-muted-foreground" />
                                <span>Edit Lead</span>
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem 
                              onClick={() => handleOpenMessages(lead)} 
                              className="gap-2.5 cursor-pointer py-2 text-xs font-medium"
                            >
                              <MessageSquare size={14} className="text-primary" />
                              <span>Send / View SMS</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={() => handleOpenCalls(lead)} 
                              className="gap-2.5 cursor-pointer py-2 text-xs font-medium justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <Phone size={14} className="text-purple-500" />
                                <span>Call & Voice History</span>
                              </div>
                              {lead.callHistory && lead.callHistory.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  {lead.callHistory.length}
                                </span>
                              )}
                            </DropdownMenuItem>

                            {permissions.createEdit && (
                              <>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem 
                                  onClick={() => handleOpenConvert(lead)} 
                                  className="gap-2.5 cursor-pointer py-2 text-xs font-medium text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400"
                                >
                                  <Shuffle size={14} />
                                  <span>Convert to CRM Lead</span>
                                </DropdownMenuItem>
                              </>
                            )}

                            {permissions.deleteRecords && (
                              <>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem 
                                  onClick={() => handleOpenDelete(lead)} 
                                  className="gap-2.5 cursor-pointer py-2 text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete Lead</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {renderPagination("bottom")}
            </>
          )}
        </div>
      </div>      {/* View Lead Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[650px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles size={12} className="text-primary" />
              </span>
              EA Lead Details & Messages
            </DialogTitle>
            <DialogDescription className="sr-only">
              View details and message history for this EA Lead.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 border border-border/60 mb-4 p-1 rounded-xl">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="messages" className="flex items-center gap-1.5">
                  <MessageSquare size={14} /> Messages
                </TabsTrigger>
                <TabsTrigger value="calls" className="flex items-center gap-1.5">
                  <Phone size={14} />
                  <span>Voice & AI</span>
                  {selectedLead.callHistory && selectedLead.callHistory.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      {selectedLead.callHistory.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <div className="grid gap-3 py-2 text-sm max-h-[400px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Hash size={14} /> Name:
                    </span>
                    <span className="col-span-2 font-bold text-foreground">{selectedLead.name}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Mail size={14} /> Email:
                    </span>
                    <span className="col-span-2 font-medium text-foreground select-all">{selectedLead.email}</span>
                  </div>

                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Phone size={14} /> Phone:
                    </span>
                    <span className="col-span-2 font-medium text-foreground select-all">{selectedLead.phone}</span>
                  </div>

                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Layers size={14} /> Source:
                    </span>
                    <span className="col-span-2 font-semibold">
                      <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {selectedLead.source}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Calendar size={14} /> Submitted:
                    </span>
                    <span className="col-span-2 font-semibold text-foreground">
                      {formatDateDisplay(selectedLead.dateSubmitted)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Hash size={14} /> Consent Given:
                    </span>
                    <span className="col-span-2 font-semibold">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${selectedLead.isConsent ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500"}`}>
                        {selectedLead.isConsent ? "Yes" : "No"}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 items-start gap-4 pb-1">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Hash size={14} /> Submissions:
                    </span>
                    <span className="col-span-2 font-semibold text-foreground">
                      {selectedLead.submissionCount} {selectedLead.submissionCount === 1 ? "time" : "times"}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages">
                <TooltipProvider>
                  <div className="flex flex-col h-[400px] border rounded-xl overflow-hidden bg-background">
                    {/* Chat message area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[330px]">
                      {!selectedLead.smsHistory || selectedLead.smsHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 py-12">
                          <MessageSquare className="opacity-40" size={24} />
                          <p className="text-xs">No message history with this lead yet.</p>
                        </div>
                      ) : (
                        (() => {
                          let lastDateLabel = '';
                          return selectedLead.smsHistory.map((msg, i) => {
                            const isInbound = msg.direction === 'inbound';
                            const isFailed = !isInbound && msg.status === 'failed';
                            const isPending = !isInbound && msg.status === 'pending';
                            const dateLabel = getRelativeDateLabel(msg.timestamp);
                            const showDateSeparator = dateLabel !== lastDateLabel;
                            if (showDateSeparator) {
                              lastDateLabel = dateLabel;
                            }
                            return (
                              <React.Fragment key={msg._id || i}>
                                {showDateSeparator && (
                                  <div className="flex justify-center my-3 w-full">
                                    <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-border/50 uppercase tracking-wider">
                                      {dateLabel}
                                    </span>
                                  </div>
                                )}
                                <div
                                  className={`flex flex-col max-w-[80%] ${isInbound ? 'self-start mr-auto' : 'self-end ml-auto items-end'}`}
                                >
                                  <div className={`flex items-center gap-2 ${isInbound ? 'justify-start' : 'justify-end'}`}>
                                    {!isInbound && msg.isBulk && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer bg-secondary border border-border p-1 rounded-full transition-colors shrink-0">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="p-1.5 text-[10px] shadow-md bg-popover text-popover-foreground rounded border border-border">
                                          Bulk
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <div
                                      className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                        isInbound
                                          ? 'bg-muted text-foreground rounded-tl-none'
                                          : isFailed
                                            ? 'bg-destructive/90 text-white rounded-tr-none'
                                            : 'bg-primary text-primary-foreground rounded-tr-none'
                                      }`}
                                    >
                                      {msg.message}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 px-1">
                                    {isFailed && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-destructive/15 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-full font-semibold leading-tight">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        Failed
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()
                      )}
                    </div>

                    {/* Send chat message input */}
                    {selectedLead.isConsent === false ? (
                      <div className="p-3 border-t bg-destructive/5 flex flex-col items-center justify-center gap-1.5 text-center animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-destructive text-[11px] font-bold">
                          <AlertCircle size={13} /> SMS Consent Revoked
                        </div>
                        <p className="text-[10px] text-muted-foreground max-w-[320px]">
                          This contact has opted out of SMS messages (sent STOP). Outbound messaging is disabled.
                        </p>
                        {isPrivileged && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleReenableConsent}
                            className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all px-2.5 rounded-md shadow-sm"
                          >
                            Re-enable Consent
                          </Button>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSendSingleSMS} className="p-2 border-t flex gap-1.5 bg-card shrink-0">
                        <Input
                          placeholder={selectedLead.isConsent ? "Type SMS message..." : "Lead has not given SMS consent"}
                          value={singleSmsMessage}
                          onChange={(e) => setSingleSmsMessage(e.target.value)}
                          disabled={sendingSingleSms || !selectedLead.isConsent}
                          className="flex-1 bg-background text-xs h-8 border-border"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          disabled={sendingSingleSms || !singleSmsMessage.trim() || !selectedLead.isConsent}
                        >
                          {sendingSingleSms ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </TooltipProvider>
              </TabsContent>
              <TabsContent value="calls">
                <div className="flex flex-col h-[420px] border rounded-xl overflow-hidden bg-background">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[410px] custom-scrollbar">
                    {!selectedLead.callHistory || selectedLead.callHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-16">
                        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                          <Phone className="opacity-40" size={24} />
                        </div>
                        <p className="text-xs font-semibold text-foreground">No voice call history with this lead yet.</p>
                        <p className="text-[10px] text-muted-foreground/70 text-center max-w-xs">
                          Inbound calls handled by Retell AI Voice or manual team calls will automatically be recorded and displayed here.
                        </p>
                      </div>
                    ) : (
                      [...selectedLead.callHistory]
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((call, idx) => {
                          const callKey = call.callSid || `call-${idx}`;
                          const currentSubTab = callSubTabs[callKey] || 'summary';
                          const isPositive = call.callerSentiment?.toLowerCase().includes('pos');
                          const isNegative = call.callerSentiment?.toLowerCase().includes('neg');
                          
                          return (
                            <div key={callKey} className="p-4 bg-card border border-border/80 rounded-2xl space-y-3.5 shadow-xs">
                              {/* Header: Call Direction, Duration, Sentiment & Date */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    call.direction === 'inbound' 
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                    {call.direction === 'inbound' ? '📲 Inbound Call' : '📞 Outbound Call'}
                                  </span>
                                  <span className="text-xs font-mono font-medium text-muted-foreground">
                                    {Math.floor(call.duration / 60)}m {call.duration % 60}s
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  {call.callerSentiment && (
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-2xs ${
                                      isPositive
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                        : isNegative
                                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        isPositive ? 'bg-emerald-500' : isNegative ? 'bg-red-500' : 'bg-blue-500'
                                      }`} />
                                      {call.callerSentiment}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {new Date(call.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                              </div>

                              {/* 2-Mode Segmented Pill Toggle */}
                              <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => setCallSubTabs(prev => ({ ...prev, [callKey]: 'summary' }))}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    currentSubTab === 'summary'
                                      ? 'bg-card text-foreground shadow-xs border border-border/50'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <Bot size={13} className={currentSubTab === 'summary' ? "text-purple-600 dark:text-purple-400" : ""} />
                                  <span>Recording & AI Summary</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCallSubTabs(prev => ({ ...prev, [callKey]: 'transcript' }))}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    currentSubTab === 'transcript'
                                      ? 'bg-card text-foreground shadow-xs border border-border/50'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <MessageSquare size={13} className={currentSubTab === 'transcript' ? "text-blue-500" : ""} />
                                  <span>Full Call Transcript</span>
                                </button>
                              </div>

                              {/* Mode 1: Recording & AI Summary */}
                              {currentSubTab === 'summary' && (
                                <div className="space-y-3 pt-1 animate-in fade-in-0 duration-200">
                                  {/* Audio Player */}
                                  {call.recordingUrl ? (
                                    <div className="p-3 bg-muted/30 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                          <Headphones size={14} />
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-foreground">Call Audio Recording</p>
                                          <p className="text-[10px] text-muted-foreground">{Math.floor(call.duration / 60)}m {call.duration % 60}s</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <audio controls src={call.recordingUrl} className="h-7 max-w-full sm:w-52 accent-primary" />
                                        <a
                                          href={call.recordingUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1.5 rounded-lg bg-card border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                          title="Open audio in new tab"
                                        >
                                          <ExternalLink size={13} />
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-muted/20 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                                      No audio recording available for this call.
                                    </div>
                                  )}

                                  {/* AI Summary */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                      <Sparkles size={13} />
                                      <span>AI Call Summary</span>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs text-foreground leading-relaxed shadow-xs">
                                      {call.aiSummary ? (
                                        <p className="whitespace-pre-wrap">{call.aiSummary}</p>
                                      ) : (
                                        <p className="text-muted-foreground italic">No AI summary generated for this call.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Mode 2: Full Call Transcript */}
                              {currentSubTab === 'transcript' && (
                                <div className="space-y-2 pt-1 animate-in fade-in-0 duration-200">
                                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <MessageSquare size={13} />
                                    <span>Full Call Transcript</span>
                                  </div>

                                  <div className="p-3.5 rounded-xl bg-muted/20 border border-border max-h-72 overflow-y-auto custom-scrollbar space-y-3">
                                    {call.transcript && call.transcript.trim() ? (
                                      (() => {
                                        const rawLines = call.transcript.split('\n').map((l: string) => l.trim()).filter(Boolean);
                                        const turns: Array<{ role: 'agent' | 'user'; text: string }> = [];
                                        let currentTurn: { role: 'agent' | 'user'; text: string } | null = null;

                                        for (const line of rawLines) {
                                          const isAgent = /^agent:|^assistant:|^bot:|^ai:/i.test(line);
                                          const isUser = /^user:|^caller:|^customer:|^human:/i.test(line);
                                          const cleanContent = line.replace(/^(agent|assistant|bot|ai|user|caller|customer|human):\s*/i, '').trim();

                                          if (isAgent) {
                                            if (currentTurn) turns.push(currentTurn);
                                            currentTurn = { role: 'agent', text: cleanContent };
                                          } else if (isUser) {
                                            if (currentTurn) turns.push(currentTurn);
                                            currentTurn = { role: 'user', text: cleanContent };
                                          } else {
                                            if (currentTurn) {
                                              currentTurn.text += '\n' + line;
                                            } else {
                                              currentTurn = { role: 'agent', text: line };
                                            }
                                          }
                                        }
                                        if (currentTurn) turns.push(currentTurn);

                                        return turns.map((turn, tIdx) => (
                                          <div
                                            key={tIdx}
                                            className={`flex flex-col max-w-[85%] ${
                                              turn.role === 'agent' ? 'self-start mr-auto items-start' : 'self-end ml-auto items-end'
                                            }`}
                                          >
                                            <span className={`text-[10px] font-bold mb-1 px-1 flex items-center gap-1 ${
                                              turn.role === 'agent' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
                                            }`}>
                                              {turn.role === 'agent' ? (
                                                <><Bot size={11} /> AI Agent</>
                                              ) : (
                                                <><User size={11} /> Caller / Parent</>
                                              )}
                                            </span>
                                            <div
                                              className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                                turn.role === 'agent'
                                                  ? 'bg-purple-500/10 border border-purple-500/20 text-foreground rounded-tl-sm shadow-2xs'
                                                  : 'bg-primary text-primary-foreground rounded-tr-sm shadow-2xs'
                                              }`}
                                            >
                                              {turn.text}
                                            </div>
                                          </div>
                                        ));
                                      })()
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic text-center py-4">
                                        No transcript text recorded for this call.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4 border-t border-border/30 pt-3">
            <Button variant="outline" className="border-border text-foreground" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk SMS Modal */}
      <Dialog open={bulkSmsOpen} onOpenChange={setBulkSmsOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <MessageSquare className="text-primary" size={20} />
              Send Bulk SMS
            </DialogTitle>
            <DialogDescription className="sr-only">
              Send personalized bulk SMS messages to the selected contacts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendBulkSMS} className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground bg-muted/30 border p-3 rounded-lg">
              Sending to <strong className="text-foreground">{selectedIds.length}</strong> selected lead(s) who have given SMS consent.
              <br />
              <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                Pro-tip: Use <code className="bg-muted px-1 py-0.5 rounded text-foreground font-semibold font-mono">{"{{name}}"}</code> to personalize the text message with the lead's name.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-message">Message Body</Label>
              <textarea
                id="bulk-message"
                rows={4}
                placeholder="Hi {{name}}! Just checking in to see if you have any questions..."
                value={bulkSmsMessage}
                onChange={(e) => setBulkSmsMessage(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-border text-foreground resize-none"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="border-border text-foreground" onClick={() => setBulkSmsOpen(false)} disabled={sendingBulkSms}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingBulkSms || !bulkSmsMessage.trim()}>
                {sendingBulkSms ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" /> Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Edit2 size={12} className="text-primary" />
              </span>
              Edit EA Lead Record
            </DialogTitle>
            <DialogDescription className="sr-only">
              Update the details of this EA Lead record.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Name</Label>
              <Input
                id="lead-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email Address</Label>
              <Input
                id="lead-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone Number</Label>
              <Input
                id="lead-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Source</Label>
              <Input
                id="lead-source"
                value={editSource}
                onChange={(e) => setEditSource(e.target.value)}
                className="bg-background border-border text-foreground"
                required
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-date-submitted">Date Submitted</Label>
              <Input
                id="lead-date-submitted"
                type="datetime-local"
                value={editDateSubmitted}
                onChange={(e) => setEditDateSubmitted(e.target.value)}
                className="bg-background border-border text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                disabled
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="lead-is-consent"
                type="checkbox"
                checked={editIsConsent}
                onChange={(e) => setEditIsConsent(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
              />
              <Label htmlFor="lead-is-consent" className="text-sm font-medium text-foreground cursor-pointer select-none">
                Consent Given (Permit SMS/Email campaigns)
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" className="border-border text-foreground" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Lead Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles size={16} className="text-primary" />
              Add EA Lead Record
            </DialogTitle>
            <DialogDescription className="sr-only">
              Manually add a new EA Lead record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdd} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-lead-name">Name</Label>
              <Input
                id="add-lead-name"
                placeholder="Jane Doe"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-lead-email">Email Address</Label>
              <Input
                id="add-lead-email"
                type="email"
                placeholder="jane.doe@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-lead-phone">Phone Number</Label>
              <Input
                id="add-lead-phone"
                placeholder="+15555555555"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-lead-source">Source</Label>
              <Input
                id="add-lead-source"
                value={addSource}
                onChange={(e) => setAddSource(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="add-lead-is-consent"
                type="checkbox"
                checked={addIsConsent}
                onChange={(e) => setAddIsConsent(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
              />
              <Label htmlFor="add-lead-is-consent" className="text-sm font-medium text-foreground cursor-pointer select-none">
                Consent Given (Permit SMS/Email campaigns)
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" className="border-border text-foreground" onClick={() => setAddDialogOpen(false)} disabled={adding}>
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" /> Creating...
                  </>
                ) : (
                  "Add Lead"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert Lead Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-3xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Shuffle size={16} className="text-primary" />
              Add Lead to {campaigns.find(c => c._id === selectedCampaignId)?.name || 'Testing'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Convert this EA Lead into a main CRM Lead.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConvertLead} className="grid grid-cols-1 gap-6 py-2 p-1 pr-3">
            {/* Target Campaign Selection */}
            <div className="space-y-1.5 border-b pb-4">
              <Label htmlFor="convert-campaign-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Target Campaign *</Label>
              <select
                id="convert-campaign-select"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                required
              >
                {campaigns.length === 0 ? (
                  <option value="" disabled>Loading campaigns...</option>
                ) : (
                  campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Primary Contact Person */}
            <div className="space-y-4 border-b pb-6">
              <div className="flex items-center justify-start gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Users size={16} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Primary Contact Person</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Name */}
                <div className="space-y-1">
                  <Label htmlFor="convert-main_contact_name" className="text-xs font-medium">Contact Full Name *</Label>
                  <Input
                    id="convert-main_contact_name"
                    name="main_contact_name"
                    placeholder="e.g. Davina Midgette"
                    className={`bg-background border-border text-foreground ${convertErrors.main_contact_name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.main_contact_name}
                    onChange={handleConvertFormChange}
                    required
                  />
                  {convertErrors.main_contact_name && <p className="text-[10px] text-destructive">{convertErrors.main_contact_name}</p>}
                </div>

                {/* Title / Role */}
                <div className="space-y-1">
                  <Label htmlFor="convert-contact_title" className="text-xs font-medium">Title / Role *</Label>
                  <select
                    id="convert-contact_title"
                    name="contact_title"
                    className={`w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer ${convertErrors.contact_title ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.contact_title}
                    onChange={handleConvertFormChange}
                    required
                  >
                    <option value="">Select title...</option>
                    <option>Principal</option>
                    <option>Assistant Principal</option>
                    <option>Athletic Director</option>
                    <option>After-School Coordinator</option>
                    <option>Front Office Administrator</option>
                    <option>PTA/PTO Contact</option>
                    <option>Other</option>
                  </select>
                  {convertErrors.contact_title && <p className="text-[10px] text-destructive">{convertErrors.contact_title}</p>}
                  {convertFormData.contact_title === "Other" && (
                    <Input
                      id="convert-please-specify-title"
                      placeholder="Please specify title..."
                      className="bg-background border-border text-foreground mt-2"
                      value={convertCustomTitle}
                      onChange={(e) => setConvertCustomTitle(e.target.value)}
                      required
                    />
                  )}
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <Label htmlFor="convert-contact_department" className="text-xs font-medium">Department *</Label>
                  <Input
                    id="convert-contact_department"
                    name="contact_department"
                    placeholder="e.g. Administration"
                    className={`bg-background border-border text-foreground ${convertErrors.contact_department ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.contact_department}
                    onChange={handleConvertFormChange}
                    required
                  />
                  {convertErrors.contact_department && <p className="text-[10px] text-destructive">{convertErrors.contact_department}</p>}
                </div>

                {/* Direct Phone */}
                <div className="space-y-1">
                  <Label htmlFor="convert-contact_direct_phone" className="text-xs font-medium flex items-center gap-1">
                    <Phone size={12} /> Direct Phone *
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {convertFormData.contact_phone_prefix}
                      </div>
                      <select
                        id="convert-contact_phone_prefix"
                        name="contact_phone_prefix"
                        className="w-full h-[38px] dark:bg-card border border-border px-2 text-transparent appearance-none bg-no-repeat rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        style={{
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === convertFormData.contact_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={convertFormData.contact_phone_prefix}
                        onChange={(e) => setConvertFormData({ ...convertFormData, contact_phone_prefix: e.target.value })}
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
                    <Input
                      id="convert-contact_direct_phone"
                      name="contact_direct_phone"
                      placeholder="Phone"
                      className={`flex-1 bg-background border-border text-foreground ${convertErrors.contact_direct_phone ? "border-destructive focus:ring-destructive/20" : ""}`}
                      value={convertFormData.contact_direct_phone}
                      onChange={handleConvertFormChange}
                      required
                    />
                    <Input
                      id="convert-contact_extension"
                      name="contact_extension"
                      placeholder="Ext."
                      className="w-20 bg-background border-border text-foreground"
                      value={convertFormData.contact_extension}
                      onChange={handleConvertFormChange}
                    />
                  </div>
                  {convertErrors.contact_direct_phone && <p className="text-[10px] text-destructive">{convertErrors.contact_direct_phone}</p>}
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <Label htmlFor="convert-contact_email" className="text-xs font-medium">Email Address *</Label>
                  <Input
                    id="convert-contact_email"
                    name="contact_email"
                    type="email"
                    placeholder="email@example.com"
                    className={`bg-background border-border text-foreground ${convertErrors.contact_email ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.contact_email}
                    onChange={handleConvertFormChange}
                    required
                  />
                  {convertErrors.contact_email && <p className="text-[10px] text-destructive">{convertErrors.contact_email}</p>}
                </div>

                {/* Best Time to Call */}
                <div className="space-y-1">
                  <Label htmlFor="convert-contact_best_time" className="text-xs font-medium">Best Time to Call *</Label>
                  <select
                    id="convert-contact_best_time"
                    name="contact_best_time"
                    className={`w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer ${convertErrors.contact_best_time ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.contact_best_time}
                    onChange={handleConvertFormChange}
                    required
                  >
                    <option value="">Select time...</option>
                    <option>Morning (8am–11am)</option>
                    <option>Midday (11am–1pm)</option>
                    <option>Afternoon (1pm–4pm)</option>
                    <option>Late Afternoon (4pm–6pm)</option>
                    <option>Anytime</option>
                  </select>
                  {convertErrors.contact_best_time && <p className="text-[10px] text-destructive">{convertErrors.contact_best_time}</p>}
                </div>

                {/* Preferred Method */}
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <span className="text-xs font-medium block">Preferred Contact Method *</span>
                  <div className="flex gap-4">
                    {["Call", "Email", "Text"].map(method => (
                      <label key={method} className="flex items-center justify-center gap-2 cursor-pointer text-xs text-foreground">
                        <input
                          type="radio"
                          name="contact_preferred_method"
                          value={method}
                          checked={convertFormData.contact_preferred_method === method}
                          onChange={() => handleConvertRadioChange("contact_preferred_method", method)}
                          className="h-4 w-4 border-border text-primary focus:ring-primary bg-background cursor-pointer"
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                  {convertErrors.contact_preferred_method && <p className="text-[10px] text-destructive">{convertErrors.contact_preferred_method}</p>}
                </div>
              </div>
            </div>

            {/* Secondary Contact (Optional) */}
            <div className="space-y-4 border-b pb-6">
              <button
                type="button"
                onClick={() => setShowConvertSecondary(!showConvertSecondary)}
                className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConvertSecondary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Add Secondary Contact (Optional)
              </button>

              {showConvertSecondary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <Label htmlFor="convert-secondary_contact_name" className="text-xs font-medium">Secondary Name</Label>
                    <Input
                      id="convert-secondary_contact_name"
                      name="secondary_contact_name"
                      placeholder="Name"
                      className="bg-background border-border text-foreground"
                      value={convertFormData.secondary_contact_name}
                      onChange={handleConvertFormChange}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="convert-secondary_contact_title" className="text-xs font-medium">Secondary Title</Label>
                    <select
                      id="convert-secondary_contact_title"
                      name="secondary_contact_title"
                      className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                      value={convertFormData.secondary_contact_title}
                      onChange={handleConvertFormChange}
                    >
                      <option value="">Select title...</option>
                      <option>Principal</option>
                      <option>Assistant Principal</option>
                      <option>Athletic Director</option>
                      <option>After-School Coordinator</option>
                      <option>Front Office Administrator</option>
                      <option>PTA/PTO Contact</option>
                      <option>Other</option>
                    </select>
                    {convertFormData.secondary_contact_title === "Other" && (
                      <Input
                        id="convert-please-specify-secondary-title"
                        placeholder="Please specify title..."
                        className="bg-background border-border text-foreground mt-2"
                        value={convertSecondaryCustomTitle}
                        onChange={(e) => setConvertSecondaryCustomTitle(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="convert-secondary_contact_department" className="text-xs font-medium">Secondary Department</Label>
                    <Input
                      id="convert-secondary_contact_department"
                      name="secondary_contact_department"
                      placeholder="Department"
                      className="bg-background border-border text-foreground"
                      value={convertFormData.secondary_contact_department}
                      onChange={handleConvertFormChange}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="convert-secondary_contact_phone" className="text-xs font-medium flex items-center gap-1">
                      <Phone size={12} /> Secondary Phone
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative w-28 shrink-0">
                        <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                          {convertFormData.secondary_phone_prefix}
                        </div>
                        <select
                          id="convert-secondary_phone_prefix"
                          name="secondary_phone_prefix"
                          className="w-full h-[38px] dark:bg-card border border-border px-2 text-transparent appearance-none bg-no-repeat rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          style={{
                            backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === convertFormData.secondary_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                            backgroundPosition: 'left 0.5rem center'
                          }}
                          value={convertFormData.secondary_phone_prefix}
                          onChange={(e) => setConvertFormData({ ...convertFormData, secondary_phone_prefix: e.target.value })}
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
                      <Input
                        id="convert-secondary_contact_phone"
                        name="secondary_contact_phone"
                        placeholder="Phone"
                        className="flex-1 bg-background border-border text-foreground"
                        value={convertFormData.secondary_contact_phone}
                        onChange={handleConvertFormChange}
                      />
                      <Input
                        id="convert-secondary_contact_extension"
                        name="secondary_contact_extension"
                        placeholder="Ext."
                        className="w-20 bg-background border-border text-foreground"
                        value={convertFormData.secondary_contact_extension}
                        onChange={handleConvertFormChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="convert-secondary_contact_email" className="text-xs font-medium">Secondary Email</Label>
                    <Input
                      id="convert-secondary_contact_email"
                      name="secondary_contact_email"
                      type="email"
                      placeholder="email@example.com"
                      className="bg-background border-border text-foreground"
                      value={convertFormData.secondary_contact_email}
                      onChange={handleConvertFormChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Organization Details */}
            <div className="space-y-4 border-b pb-6">
              <div className="flex items-center justify-start gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Building size={16} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Organization Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="convert-org-name" className="text-xs font-medium">Name / Organization *</Label>
                  <Input
                    id="convert-org-name"
                    name="name"
                    placeholder="Lead Name"
                    className={`bg-background border-border text-foreground ${convertErrors.name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={convertFormData.name}
                    onChange={handleConvertFormChange}
                    required
                  />
                  {convertErrors.name && <p className="text-[10px] text-destructive">{convertErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-lead-type" className="text-xs font-medium">Lead Type</Label>
                  <select
                    id="convert-lead-type"
                    name="type"
                    className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    value={convertFormData.type}
                    onChange={handleConvertFormChange}
                  >
                    <option value="">Select type...</option>
                    <option>Public School</option>
                    <option>Private School</option>
                    <option>Charter School</option>
                    <option>Community Center</option>
                    <option>Other</option>
                  </select>
                  {convertFormData.type === "Other" && (
                    <Input
                      id="convert-custom-lead-type"
                      placeholder="Please specify type..."
                      className="bg-background border-border text-foreground mt-2"
                      value={convertCustomLeadType}
                      onChange={(e) => setConvertCustomLeadType(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-category-group" className="text-xs font-medium">Category / Group</Label>
                  <Input
                    id="convert-category-group"
                    name="category_group"
                    placeholder="Category"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.category_group}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-org-department" className="text-xs font-medium">Department</Label>
                  <Input
                    id="convert-org-department"
                    name="department"
                    placeholder="e.g. Sales, Marketing"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.department}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-telephone" className="text-xs font-medium flex items-center gap-1">
                    <Phone size={12} /> Main Phone
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {convertFormData.telephone_prefix}
                      </div>
                      <select
                        id="convert-telephone_prefix"
                        name="telephone_prefix"
                        className="w-full h-[38px] dark:bg-card border border-border px-2 text-transparent appearance-none bg-no-repeat rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        style={{
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === convertFormData.telephone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={convertFormData.telephone_prefix}
                        onChange={(e) => setConvertFormData({ ...convertFormData, telephone_prefix: e.target.value })}
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
                    <Input
                      id="convert-telephone"
                      name="telephone"
                      placeholder="Phone"
                      className="flex-1 bg-background border-border text-foreground"
                      value={convertFormData.telephone}
                      onChange={handleConvertFormChange}
                    />
                    <Input
                      id="convert-telephone_extension"
                      name="telephone_extension"
                      placeholder="Ext."
                      className="w-20 bg-background border-border text-foreground"
                      value={convertFormData.telephone_extension}
                      onChange={handleConvertFormChange}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-website" className="text-xs font-medium">Website</Label>
                  <Input
                    id="convert-website"
                    name="website"
                    placeholder="https://..."
                    className="bg-background border-border text-foreground"
                    value={convertFormData.website}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-start-time" className="text-xs font-medium">Start Time</Label>
                  <Input
                    id="convert-start-time"
                    name="start_time"
                    type="time"
                    className="bg-background border-border text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                    value={convertFormData.start_time}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-end-time" className="text-xs font-medium">End Time</Label>
                  <Input
                    id="convert-end-time"
                    name="end_time"
                    type="time"
                    className="bg-background border-border text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                    value={convertFormData.end_time}
                    onChange={handleConvertFormChange}
                  />
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-start gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <MapPin size={16} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Address Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="convert-address-number" className="text-xs font-medium">Number</Label>
                  <Input
                    id="convert-address-number"
                    name="address_number"
                    placeholder="123"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.address_number}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-address" className="text-xs font-medium">Street</Label>
                  <Input
                    id="convert-address"
                    name="address"
                    placeholder="Street Address"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.address}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-city" className="text-xs font-medium">City</Label>
                  <Input
                    id="convert-city"
                    name="city"
                    placeholder="City"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.city}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-state" className="text-xs font-medium">State</Label>
                  <Input
                    id="convert-state"
                    name="state"
                    placeholder="ST"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.state}
                    onChange={handleConvertFormChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="convert-zip" className="text-xs font-medium">Zip</Label>
                  <Input
                    id="convert-zip"
                    name="zip"
                    placeholder="Zip"
                    className="bg-background border-border text-foreground"
                    value={convertFormData.zip}
                    onChange={handleConvertFormChange}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button type="button" variant="outline" className="border-border text-foreground" onClick={() => setConvertDialogOpen(false)} disabled={converting}>
                Cancel
              </Button>
              <Button type="submit" disabled={converting || !selectedCampaignId}>
                {converting ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" /> Converting...
                  </>
                ) : (
                  "Convert Lead"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Lead Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
              <AlertCircle size={20} />
              Confirm Delete
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirm whether you want to delete this EA Lead record.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete the lead <strong className="text-foreground">{selectedLead?.name}</strong>? This action is permanent and cannot be undone.
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="border-border text-foreground" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteLead} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" /> Deleting...
                </>
              ) : (
                "Delete Lead"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
