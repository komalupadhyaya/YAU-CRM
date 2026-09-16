import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  Users,
  Search,
  RefreshCw,
  Download,
  School,
  MapPin,
  Smartphone,
  Sparkles,
  CheckCircle,
  Copy,
  Check,
  Trash2,
  Eye,
  Loader2,
  Code2,
  Calendar,
  Layers,
  ArrowUpDown,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Edit2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface MarketingContact {
  _id: string;
  parentName: string;
  email: string;
  phone?: string;
  entryPoint: "school" | "location" | "free_app";
  schoolName?: string;
  schoolId?: string;
  locationName?: string;
  locationId?: string;
  source?: string;
  metadata?: Record<string, any>;
  submissionCount: number;
  lastRegisteredAt: string;
  createdAt: string;
  status: "active" | "opted_out" | "bounced";
  isEmailConsent: boolean;
}

interface StatsData {
  total: number;
  school: number;
  location: number;
  free_app: number;
  deduplicated: number;
}

export default function MarketingContacts() {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [entryPointFilter, setEntryPointFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deduplicatedOnly, setDeduplicatedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState("lastRegisteredAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Stats
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    school: 0,
    location: 0,
    free_app: 0,
    deduplicated: 0
  });

  // Modal States
  const [selectedContact, setSelectedContact] = useState<MarketingContact | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<MarketingContact | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [isWebhookGuideOpen, setIsWebhookGuideOpen] = useState(false);
  const [copiedWebhookPayload, setCopiedWebhookPayload] = useState<string | null>(null);

  // Add Contact Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [addForm, setAddForm] = useState({
    parentName: "",
    email: "",
    phone: "",
    entryPoint: "school" as "school" | "location" | "free_app",
    schoolName: "",
    schoolId: "",
    locationName: "",
    locationId: "",
    source: "Manual CRM Entry"
  });

  const resetAddForm = () => {
    setAddForm({
      parentName: "",
      email: "",
      phone: "",
      entryPoint: "school",
      schoolName: "",
      schoolId: "",
      locationName: "",
      locationId: "",
      source: "Manual CRM Entry"
    });
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.parentName.trim()) {
      toast.error("Please enter a parent name");
      return;
    }
    if (!addForm.email.trim() || !addForm.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSavingContact(true);
    try {
      const res = await api.post("/marketing-contacts", addForm);
      if (res.data?.success) {
        toast.success(res.data.message || "Contact saved successfully!");
        setIsAddModalOpen(false);
        resetAddForm();
        fetchContacts(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create contact");
    } finally {
      setSavingContact(false);
    }
  };

  // Edit / Update Contact Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<MarketingContact | null>(null);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [editForm, setEditForm] = useState({
    parentName: "",
    email: "",
    phone: "",
    entryPoint: "school" as "school" | "location" | "free_app",
    schoolName: "",
    schoolId: "",
    locationName: "",
    locationId: "",
    source: "Manual CRM Entry",
    status: "active" as "active" | "opted_out"
  });

  const handleOpenEdit = (contact: MarketingContact) => {
    setContactToEdit(contact);
    setEditForm({
      parentName: contact.parentName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      entryPoint: contact.entryPoint || "school",
      schoolName: contact.schoolName || "",
      schoolId: contact.schoolId || "",
      locationName: contact.locationName || "",
      locationId: contact.locationId || "",
      source: contact.source || "Manual CRM Entry",
      status: (contact.status === "opted_out" ? "opted_out" : "active")
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactToEdit) return;
    if (!editForm.parentName.trim()) {
      toast.error("Please enter a parent name");
      return;
    }
    if (!editForm.email.trim() || !editForm.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setUpdatingContact(true);
    try {
      const res = await api.put(`/marketing-contacts/${contactToEdit._id}`, editForm);
      if (res.data?.success) {
        toast.success(res.data.message || "Contact updated successfully!");
        setIsEditModalOpen(false);
        setContactToEdit(null);
        fetchContacts(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update contact");
    } finally {
      setUpdatingContact(false);
    }
  };

  // Fetch Contacts
  const fetchContacts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery.trim(),
        entryPoint: entryPointFilter,
        deduplicatedOnly: deduplicatedOnly ? "true" : "false",
        sortBy,
        sortOrder
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const res = await api.get(`/marketing-contacts?${params.toString()}`);
      if (res.data?.success) {
        setContacts(res.data.contacts || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch marketing contacts:", err);
      toast.error(err.response?.data?.message || "Failed to load marketing contacts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, searchQuery, entryPointFilter, statusFilter, deduplicatedOnly, sortBy, sortOrder]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Handle Manual Refresh with guaranteed smooth rotation animation
  const handleManualRefresh = async () => {
    if (isRotating || refreshing) return;
    setIsRotating(true);
    const start = Date.now();
    try {
      await fetchContacts(true);
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 650 - elapsed);
      setTimeout(() => {
        setIsRotating(false);
      }, delay);
    }
  };

  // Handle Toggle Status (Active <-> Opted Out)
  const handleToggleStatus = async (contact: MarketingContact) => {
    const newStatus = contact.status === "opted_out" ? "active" : "opted_out";
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/marketing-contacts/${contact._id}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Contact status changed to ${newStatus === "active" ? "Active" : "Opted Out"}`);
        setSelectedContact(prev => prev ? { ...prev, status: newStatus, isEmailConsent: newStatus === "active" } : null);
        fetchContacts(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update contact status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Re-subscribe (opted-out contact -> active)
  const handleResubscribe = async (contact: MarketingContact) => {
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/marketing-contacts/${contact._id}/status`, { status: "active" });
      if (res.data?.success) {
        toast.success(`Re-subscribed "${contact.parentName}" (${contact.email}) successfully!`);
        fetchContacts(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to re-subscribe contact");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Copy Email
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Handle Delete
  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/marketing-contacts/${contactToDelete._id}`);
      toast.success(`Deleted contact for "${contactToDelete.parentName}"`);
      setIsDeleteModalOpen(false);
      setContactToDelete(null);
      fetchContacts(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.error("No contacts available to export");
      return;
    }

    const headers = ["Parent Name", "Email Address", "Phone Number", "Entry Point", "School", "Location", "Source", "Submissions", "Last Registered"];
    const rows = contacts.map(c => [
      c.parentName || "",
      c.email || "",
      c.phone || "",
      c.entryPoint || "",
      c.schoolName || "",
      c.locationName || "",
      c.source || "",
      c.submissionCount || 1,
      c.lastRegisteredAt ? new Date(c.lastRegisteredAt).toLocaleString() : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Marketing_Contacts_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded successfully!");
  };

  const getEntryPointBadge = (entryPoint: string) => {
    switch (entryPoint) {
      case "school":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <School size={11} /> School
          </span>
        );
      case "location":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <MapPin size={11} /> Location
          </span>
        );
      case "free_app":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            <Smartphone size={11} /> Free App
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-muted text-muted-foreground">
            {entryPoint}
          </span>
        );
    }
  };

  return (
    <AppLayout>
      <div className="p-4 pt-1 space-y-4 max-w-7xl mx-auto flex-1 flex flex-col min-h-0">
        {/* Tier 1: Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">Marketing Contacts</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                  {totalCount} Records
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master database of parent contacts ingested via webhooks across all 4 registration entry points.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
              className="btn-primary h-9 px-3.5 text-xs font-bold flex items-center gap-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Add New Marketing Contact"
            >
              <UserPlus size={14} /> Add Contact
            </button>
            <button
              type="button"
              onClick={() => setIsWebhookGuideOpen(true)}
              className="btn-secondary h-9 px-3 text-xs font-bold flex items-center gap-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Webhook API Guide & Developer Integration Docs"
            >
              <Code2 size={14} className="text-primary" /> Webhook API Guide
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-secondary h-9 px-3 text-xs font-bold flex items-center gap-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Export visible contacts to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || isRotating}
              className="btn-secondary h-9 w-9 p-0 flex items-center justify-center rounded-xl transition-all shadow-2xs cursor-pointer group active:scale-95 disabled:opacity-70"
              title="Refresh Contact List"
            >
              <RefreshCw
                size={14}
                className={`transition-transform duration-500 ${
                  refreshing || isRotating ? "animate-spin text-primary" : "group-hover:rotate-45"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tier 2: Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Users size={11} className="text-primary" /> Total Ingested
            </span>
            <div className="text-xl font-black text-foreground">{stats.total}</div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <School size={11} /> School Signups
            </span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400">{stats.school}</div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <MapPin size={11} /> Location Signups
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.location}</div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Smartphone size={11} /> Free App Members
            </span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.free_app}</div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle size={11} /> Deduplicated (2x+)
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.deduplicated}</div>
          </div>
        </div>

        {/* Tier 3: Search, Channel Tabs & Filters */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-card p-2.5 px-3.5 rounded-2xl border shadow-2xs shrink-0">
          {/* Channel Filter Pills */}
          <div className="flex items-center bg-accent/40 border p-1 rounded-xl overflow-x-auto custom-scrollbar text-xs font-bold gap-1 shrink-0">
            {[
              { id: "all", label: "All Contacts", count: stats.total },
              { id: "school", label: "Schools", count: stats.school },
              { id: "location", label: "Locations", count: stats.location },
              { id: "free_app", label: "Free App", count: stats.free_app }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEntryPointFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  entryPointFilter === tab.id
                    ? "bg-card text-foreground shadow-2xs font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-accent/60 opacity-80">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Search bar & Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <div className="relative w-40 sm:w-52 lg:w-48 xl:w-56 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-9 input-field text-xs !pl-9 pr-3 w-full rounded-xl dark:bg-card"
              />
            </div>

            {/* Compact Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-32 shrink-0 rounded-xl px-2.5 bg-background dark:bg-card border border-input text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">🟢 Active</option>
              <option value="opted_out">🔴 Opted Out</option>
            </select>

            {/* Items Per Page Selector (Show:) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">
                Show:
              </span>
              <select
                id="items-per-page"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-9 shrink-0 rounded-xl px-2.5 bg-background dark:bg-card border border-input text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 shadow-2xs"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tier 4: Data Table */}
        <div className="border rounded-2xl overflow-hidden bg-card shadow-xs flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card z-10">
                  <th className="p-3.5 pl-5 align-middle">Parent Contact</th>
                  <th className="p-3.5 align-middle">Email Address</th>
                  <th className="p-3.5 align-middle">Channel & Location</th>
                  <th className="p-3.5 align-middle">Registration Source</th>
                  <th className="p-3.5 align-middle text-center">Status</th>
                  <th className="p-3.5 pr-5 align-middle text-center w-[70px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-primary h-6 w-6" />
                        <span className="text-xs font-semibold">Loading marketing contacts...</span>
                      </div>
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={36} className="opacity-40 mb-1" />
                        <span className="text-sm font-bold text-foreground">No Marketing Contacts Found</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {searchQuery || entryPointFilter !== "all" || statusFilter !== "all" || deduplicatedOnly
                            ? "Try adjusting your search query or filter options."
                            : "Incoming parent registrations from your mobile app, registration portal, or admin panel will appear here automatically."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map(contact => {
                    const initials = contact.parentName
                      ? contact.parentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                      : contact.email.slice(0, 2).toUpperCase();
                    const isCopied = copiedEmail === contact._id;
                    const isDeduplicated = (contact.submissionCount || 1) > 1;

                    return (
                      <tr
                        key={contact._id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setIsDetailsModalOpen(true);
                        }}
                        className="hover:bg-accent/30 transition-colors cursor-pointer group"
                      >
                        {/* Parent Name & Phone */}
                        <td className="p-3.5 pl-5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0 border border-primary/20">
                              {initials}
                            </div>
                            <div className="min-w-0 text-left">
                              <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors">
                                {contact.parentName}
                              </span>
                              {contact.phone && (
                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                  {contact.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email Address */}
                        <td className="p-3.5 align-middle">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <span className="truncate max-w-[240px]">{contact.email}</span>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleCopy(contact.email, contact._id);
                              }}
                              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer p-1 rounded-md hover:bg-accent transition-colors"
                              title="Copy Email"
                            >
                              {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>

                        {/* Channel & Location */}
                        <td className="p-3.5 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            {getEntryPointBadge(contact.entryPoint)}
                            {(contact.schoolName || contact.locationName) ? (
                              <span className="text-xs font-semibold text-foreground truncate max-w-[220px]" title={contact.schoolName || contact.locationName}>
                                {contact.schoolName || contact.locationName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic">N/A</span>
                            )}
                          </div>
                        </td>

                        {/* Registration Source */}
                        <td className="p-3.5 align-middle">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent/40 border border-border/60 text-foreground truncate max-w-[180px]" title={contact.source || "App Registration"}>
                            {contact.source || "App Registration"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3.5 align-middle text-center">
                          {contact.status === "opted_out" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
                              <AlertCircle size={10} /> Opted Out
                            </span>
                          ) : contact.status === "bounced" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Bounced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle size={10} /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions Dropdown matching /ea-leads */}
                        <td className="w-[70px] text-center pr-4" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-accent text-muted-foreground hover:text-foreground relative cursor-pointer"
                                title="Actions"
                              >
                                <MoreVertical size={15} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground shadow-lg z-50">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="gap-2.5 cursor-pointer py-2 text-xs font-medium"
                              >
                                <Eye size={14} className="text-muted-foreground" />
                                <span>View Details</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(contact)}
                                className="gap-2.5 cursor-pointer py-2 text-xs font-medium"
                              >
                                <Edit2 size={14} className="text-muted-foreground" />
                                <span>Edit Contact</span>
                              </DropdownMenuItem>

                              {contact.status === "opted_out" && (
                                <DropdownMenuItem
                                  onClick={() => handleResubscribe(contact)}
                                  className="gap-2.5 cursor-pointer py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 focus:bg-emerald-500/10"
                                >
                                  <CheckCircle size={14} className="text-emerald-500" />
                                  <span>Re-subscribe</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="bg-border" />

                              <DropdownMenuItem
                                onClick={() => {
                                  setContactToDelete(contact);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="gap-2.5 cursor-pointer py-2 text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 size={14} />
                                <span>Delete Contact</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 px-5 border-t bg-card shrink-0 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing <strong className="text-foreground">{totalCount === 0 ? 0 : (page - 1) * limit + 1}</strong> to <strong className="text-foreground">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-foreground">{totalCount}</strong> contacts
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary h-7.5 px-3 text-xs disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-bold text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary h-7.5 px-3 text-xs disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: CONTACT DETAILS & METADATA VIEWER --- */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-[95vw] max-w-xl p-0 flex flex-col overflow-hidden dark:bg-card">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-card">
            <div className="flex items-center gap-2.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                {selectedContact?.parentName?.substring(0, 2).toUpperCase() || "MC"}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <span>{selectedContact?.parentName}</span>
                  {selectedContact && getEntryPointBadge(selectedContact.entryPoint)}
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{selectedContact?.email}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
            {/* Essential Fields Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-accent/10 border rounded-xl">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Email Address</span>
                <span className="font-bold text-foreground">{selectedContact?.email}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Phone Number</span>
                <span className="font-bold text-foreground">{selectedContact?.phone || "None"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">School / Location</span>
                <span className="font-bold text-foreground">{selectedContact?.schoolName || selectedContact?.locationName || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Registration Source</span>
                <span className="font-bold text-foreground">{selectedContact?.source || "App Registration"}</span>
              </div>
            </div>

            {/* Email Marketing Status Strip */}
            <div className="p-3.5 rounded-xl border bg-card flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Email Subscription Status</span>
                <div className="flex items-center gap-2">
                  {selectedContact?.status === "opted_out" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
                      <AlertCircle size={11} /> Opted Out (Unsubscribed)
                    </span>
                  ) : selectedContact?.status === "bounced" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
                      Bounced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                      <CheckCircle size={11} /> Active Subscriber
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {selectedContact?.status === "opted_out" ? "Excluded from marketing campaigns" : "Eligible to receive marketing emails"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleStatus(selectedContact!)}
                disabled={updatingStatus}
                className={`btn-secondary h-8 px-3 text-xs font-bold shrink-0 cursor-pointer ${
                  selectedContact?.status === "opted_out" 
                    ? "!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 border-emerald-500/30 hover:!bg-emerald-500/20" 
                    : "!bg-rose-500/10 !text-rose-600 dark:!text-rose-400 border-rose-500/30 hover:!bg-rose-500/20"
                }`}
              >
                {updatingStatus ? "Updating..." : selectedContact?.status === "opted_out" ? "Reactivate Subscriber" : "Mark Opted Out"}
              </button>
            </div>

            {/* Deduplication Metric Strip */}
            <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Submissions Merged</span>
                <div className="text-base font-black text-foreground flex items-center gap-1.5 mt-0.5">
                  <span>{selectedContact?.submissionCount || 1} Total Submissions</span>
                  {(selectedContact?.submissionCount || 1) > 1 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Deduplicated
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Last Registered</span>
                <span className="text-xs font-semibold text-foreground">
                  {selectedContact?.lastRegisteredAt ? new Date(selectedContact.lastRegisteredAt).toLocaleString() : "-"}
                </span>
              </div>
            </div>

            {/* Raw Metadata Viewer */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Payload Metadata</span>
              <pre className="p-3 bg-accent/20 border rounded-xl text-[10px] font-mono overflow-x-auto text-foreground max-h-40">
                {JSON.stringify(selectedContact?.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">ID: {selectedContact?._id}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedContact) {
                    setIsDetailsModalOpen(false);
                    handleOpenEdit(selectedContact);
                  }
                }}
                className="btn-secondary text-xs h-8.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 size={13} /> Edit Contact
              </button>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="btn-secondary text-xs h-8.5 px-4 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 2: DELETE CONFIRMATION MODAL --- */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="w-[90vw] max-w-md p-6 dark:bg-card text-left">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertCircle size={18} /> Delete Marketing Contact
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete the marketing contact for <strong className="text-foreground">{contactToDelete?.parentName}</strong> ({contactToDelete?.email})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
              className="btn-secondary text-xs h-8.5 px-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteContact}
              disabled={deleting}
              className="btn-primary text-xs h-8.5 px-3 !bg-destructive hover:!bg-destructive/90 text-white font-bold"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 3: WEBHOOK INTEGRATION GUIDE MODAL --- */}
      <Dialog open={isWebhookGuideOpen} onOpenChange={setIsWebhookGuideOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden dark:bg-card">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                <Code2 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-extrabold tracking-tight text-foreground">
                  API Bridge: Unified Marketing Registration Webhook
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Single webhook endpoint for all platforms (Mobile App, Registration Portal, Evening Inquiries & Admin Panel).
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
            {/* Endpoint URL */}
            <div className="p-3.5 bg-accent/20 border border-border/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Single Ingestion Webhook URL
                </span>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                  POST Method
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-card border rounded-lg p-2 px-3 font-mono text-[11px] text-foreground">
                <span className="truncate">https://api.yauapp.com/api/webhooks/marketing-registration</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("https://api.yauapp.com/api/webhooks/marketing-registration");
                    setCopiedWebhookPayload("url");
                    toast.success("Webhook URL copied to clipboard!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-7 px-2.5 text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedWebhookPayload === "url" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedWebhookPayload === "url" ? "Copied" : "Copy URL"}</span>
                </button>
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="font-bold text-primary flex items-center gap-1">
                  <CheckCircle size={13} /> Strict Deduplication
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Parents registering multiple times with the same email update the existing contact and increment submission count without creating duplicate records.
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={13} /> Auto List Sync
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Automatically creates and routes into matching School, Location, and Free App audiences in Email Center.
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-1">
                <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <CheckCircle size={13} /> Safe Deletion Policy
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Any school or location deletions in the external admin panel leave the CRM list and its parent contacts 100% intact.
                </p>
              </div>
            </div>

            {/* Sample Payload */}
            <div className="border rounded-xl p-3.5 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">Standard Registration Payload Schema</span>
                <button
                  type="button"
                  onClick={() => {
                    const payload = JSON.stringify({
                      parentName: "Jane Doe",
                      email: "jane.doe@example.com",
                      phone: "555-123-4567",
                      entryPoint: "school",
                      schoolName: "Lincoln Elementary",
                      schoolId: "sch_12345",
                      locationName: "North Gym",
                      locationId: "loc_67890",
                      source: "App Registration",
                      metadata: {}
                    }, null, 2);
                    navigator.clipboard.writeText(payload);
                    setCopiedWebhookPayload("sample");
                    toast.success("Sample JSON payload copied!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-6.5 px-2 text-[10px] font-bold flex items-center gap-1"
                >
                  {copiedWebhookPayload === "sample" ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copiedWebhookPayload === "sample" ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-accent/20 rounded-lg text-[10px] font-mono overflow-x-auto text-foreground">
{`{
  "parentName": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "555-123-4567",
  "entryPoint": "school", // "school" | "location" | "free_app"
  "schoolName": "Lincoln Elementary",
  "schoolId": "sch_12345",
  "locationName": "North Gym",
  "locationId": "loc_67890",
  "source": "App Registration",
  "metadata": {},
  "status": "active" // "active" | "opted_out" (automatically set to "opted_out" when contact clicks Unsubscribe)
}`}
              </pre>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Status: <strong className="text-emerald-600 dark:text-emerald-400">Live & Listening</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsWebhookGuideOpen(false)}
              className="btn-primary text-xs h-9 px-4 font-bold cursor-pointer"
            >
              Close Documentation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 3: ADD MARKETING CONTACT MODAL --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg p-0 flex flex-col overflow-hidden dark:bg-card">
          <form onSubmit={handleAddContact} className="flex flex-col h-full">
            <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-card">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-base font-extrabold tracking-tight text-foreground">
                    Add Marketing Contact
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manually add a parent contact to the marketing database and route into an audience list.
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
              {/* Parent Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Parent Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={addForm.parentName}
                    onChange={e => setAddForm(prev => ({ ...prev, parentName: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane.doe@example.com"
                    value={addForm.email}
                    onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>

              {/* Phone & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 555-123-4567"
                    value={addForm.phone}
                    onChange={e => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Registration Source
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Manual CRM Entry"
                    value={addForm.source}
                    onChange={e => setAddForm(prev => ({ ...prev, source: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>

              {/* Channel / Entry Point Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-foreground block">
                  Registration Channel / Entry Point <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "school", label: "School List", desc: "Afterschool Programs", icon: School, color: "text-blue-600" },
                    { id: "location", label: "Location List", desc: "Evening Activities", icon: MapPin, color: "text-emerald-600" },
                    { id: "free_app", label: "Free App Member", desc: "App Downloads", icon: Smartphone, color: "text-amber-600" }
                  ].map(channel => {
                    const Icon = channel.icon;
                    const isSelected = addForm.entryPoint === channel.id;
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setAddForm(prev => ({ ...prev, entryPoint: channel.id as any }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? "bg-primary/5 border-primary shadow-2xs"
                            : "bg-card border-border/70 hover:border-primary/40"
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-accent/60 " + channel.color}`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`font-bold block text-xs ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {channel.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {channel.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional: School Info */}
              {addForm.entryPoint === "school" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                      School Name <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lincoln Elementary"
                      value={addForm.schoolName}
                      onChange={e => setAddForm(prev => ({ ...prev, schoolName: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                      School ID <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. sch_12345"
                      value={addForm.schoolId}
                      onChange={e => setAddForm(prev => ({ ...prev, schoolId: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Location Info */}
              {addForm.entryPoint === "location" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      Location / Facility Name <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. North Community Gym"
                      value={addForm.locationName}
                      onChange={e => setAddForm(prev => ({ ...prev, locationName: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      Location ID <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. loc_67890"
                      value={addForm.locationId}
                      onChange={e => setAddForm(prev => ({ ...prev, locationId: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-accent/20 border rounded-xl text-[11px] text-muted-foreground space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-500" /> Automatic Audience Synchronization
                </span>
                <p>
                  This contact will automatically be routed into the matching Email Center segment and deduplicated by email address.
                </p>
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={savingContact}
                className="btn-secondary text-xs h-9 px-4 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingContact}
                className="btn-primary text-xs h-9 px-4 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {savingContact ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <UserPlus size={13} /> Save Contact
                  </>
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 5: EDIT / UPDATE CONTACT MODAL --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
          <DialogHeader className="p-5 pb-4 border-b shrink-0 bg-card">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Edit2 size={18} className="text-primary" /> Edit Marketing Contact
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update parent contact information, entry point channel, and subscription status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateContact} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Parent Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={editForm.parentName}
                    onChange={e => setEditForm(prev => ({ ...prev, parentName: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="jane.doe@example.com"
                    value={editForm.email}
                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="555-123-4567"
                    value={editForm.phone}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground block">
                    Marketing Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as "active" | "opted_out" }))}
                    className="h-9 w-full rounded-xl px-2.5 bg-background dark:bg-card border border-input text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    <option value="active">🟢 Active (Subscribed)</option>
                    <option value="opted_out">🔴 Opted Out (Unsubscribed)</option>
                  </select>
                </div>
              </div>

              {/* Channel / Entry Point Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-foreground block">
                  Registration Channel / Entry Point <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "school", label: "School", icon: School, color: "text-blue-500", desc: "School flyer/fair" },
                    { id: "location", label: "Location", icon: MapPin, color: "text-emerald-500", desc: "Facility signup" },
                    { id: "free_app", label: "Free App", icon: Smartphone, color: "text-amber-500", desc: "Mobile user" }
                  ].map(channel => {
                    const Icon = channel.icon;
                    const isSelected = editForm.entryPoint === channel.id;
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, entryPoint: channel.id as any }))}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                            : "hover:bg-accent/40 border-border"
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg bg-card border shrink-0 ${channel.color}`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`font-bold block text-xs ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {channel.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {channel.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional: School Info */}
              {editForm.entryPoint === "school" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                      School Name <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lincoln Elementary"
                      value={editForm.schoolName}
                      onChange={e => setEditForm(prev => ({ ...prev, schoolName: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                      School ID <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. sch_12345"
                      value={editForm.schoolId}
                      onChange={e => setEditForm(prev => ({ ...prev, schoolId: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Location Info */}
              {editForm.entryPoint === "location" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      Location / Facility Name <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. North Community Gym"
                      value={editForm.locationName}
                      onChange={e => setEditForm(prev => ({ ...prev, locationName: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      Location ID <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. loc_67890"
                      value={editForm.locationId}
                      onChange={e => setEditForm(prev => ({ ...prev, locationId: e.target.value }))}
                      className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-accent/20 border rounded-xl text-[11px] text-muted-foreground space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-500" /> Automatic Audience Synchronization
                </span>
                <p>
                  Updating this contact automatically syncs their details and status to the appropriate Email Center segment.
                </p>
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={updatingContact}
                className="btn-secondary text-xs h-9 px-4 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingContact}
                className="btn-primary text-xs h-9 px-4 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {updatingContact ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={13} /> Save Changes
                  </>
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
