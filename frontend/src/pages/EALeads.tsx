import React, { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Search,
  Sparkles,
  Eye,
  Edit2,
  Trash2,
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
  ChevronRight
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
    _id?: string;
  }>;
}

export default function EALeads() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);

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

  // Leads state
  const [leads, setLeads] = useState<EALead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedLead, setSelectedLead] = useState<EALead | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

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
      toast.error("Failed to update lead details");
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
      toast.success(res.data?.message || "Bulk SMS sent successfully.");
      setBulkSmsMessage("");
      setSelectedIds([]);
      setBulkSmsOpen(false);
      fetchLeads();
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
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-accent flex items-center gap-1.5"
                onClick={() => setBulkSmsOpen(true)}
              >
                <MessageSquare size={16} />
                Send Bulk SMS ({selectedIds.length})
              </Button>
            )}
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
                    <TableHead>Source</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
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
                      <TableCell>
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-accent hover:text-foreground"
                            onClick={() => handleOpenView(lead)}
                            title="View Lead Record"
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-accent hover:text-foreground text-primary"
                            onClick={() => handleOpenMessages(lead)}
                            title="Send/View Messages"
                          >
                            <MessageSquare size={14} />
                          </Button>
                          {permissions.createEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-accent hover:text-foreground"
                              onClick={() => handleOpenEdit(lead)}
                              title="Edit Lead"
                            >
                              <Edit2 size={14} />
                            </Button>
                          )}
                          {permissions.deleteRecords && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleOpenDelete(lead)}
                              title="Delete Lead"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
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
        <DialogContent className="sm:max-w-[550px] bg-card border-border text-foreground">
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
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-border/60 mb-4 p-1 rounded-xl">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="messages" className="flex items-center gap-1.5">
                  <MessageSquare size={14} /> Messages
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
                <div className="flex flex-col h-[400px] border rounded-xl overflow-hidden bg-background">
                  {/* Chat message area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[330px]">
                    {!selectedLead.smsHistory || selectedLead.smsHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 py-12">
                        <MessageSquare className="opacity-40" size={24} />
                        <p className="text-xs">No message history with this lead yet.</p>
                      </div>
                    ) : (
                      selectedLead.smsHistory.map((msg, i) => {
                        const isInbound = msg.direction === 'inbound';
                        return (
                          <div
                            key={msg._id || i}
                            className={`flex flex-col max-w-[80%] ${isInbound ? 'self-start mr-auto' : 'self-end ml-auto items-end'}`}
                          >
                            <div
                              className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                isInbound
                                  ? 'bg-muted text-foreground rounded-tl-none'
                                  : 'bg-primary text-primary-foreground rounded-tr-none'
                              }`}
                            >
                              {msg.message}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Send chat message input */}
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
