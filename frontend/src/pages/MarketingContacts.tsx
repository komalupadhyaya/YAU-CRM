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
  Code,
  Calendar,
  Layers,
  ArrowUpDown,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Edit2,
  Edit3,
  Phone,
  Shield,
  Flame,
  Globe,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  ArrowRight,
  ArrowLeft,
  LayoutGrid,
  Table,
  HelpCircle,
  User,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from "@/components/ui/hover-card";
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
  entryPoint?: string;
  source?: string;
  schoolName?: string;
  locationName?: string;
  sport?: string;
  gradeBand?: string;
  planType?: string;
  studentName?: string;
  metadata?: Record<string, any>;
  submissionCount: number;
  lastRegisteredAt: string;
  createdAt: string;
  status: "active" | "opted_out" | "bounced";
  isEmailConsent: boolean;
}

interface StatsData {
  total: number;
  deduplicated: number;
  bySource?: Record<string, number>;
  mobile?: number;
  web_portal?: number;
  afterschool?: number;
  manual?: number;
  school?: number;
  location?: number;
  free_app?: number;
}

export default function MarketingContacts() {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deduplicatedOnly, setDeduplicatedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState("lastRegisteredAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Stats
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    deduplicated: 0,
    bySource: {}
  });

  // View Mode: "contacts" (table view) vs "lists" (School & Location lists view)
  const [viewMode, setViewModeState] = useState<"contacts" | "lists">(() => {
    try {
      const saved = localStorage.getItem("yau_marketing_contacts_view_mode");
      return (saved === "lists" || saved === "contacts") ? saved : "contacts";
    } catch {
      return "contacts";
    }
  });

  const setViewMode = (mode: "contacts" | "lists") => {
    setViewModeState(mode);
    try {
      localStorage.setItem("yau_marketing_contacts_view_mode", mode);
    } catch (err) {
      console.warn("Failed to save view mode to localStorage", err);
    }
  };

  const [selectedListFilter, setSelectedListFilter] = useState<string | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [backfillingLists, setBackfillingLists] = useState(false);

  // School & Location List View States (Grid vs Table)
  const [listDisplayMode, setListDisplayModeState] = useState<"grid" | "table">(() => {
    try {
      const saved = localStorage.getItem("yau_marketing_contacts_list_display_mode") 
        || localStorage.getItem("yau_marketing_view_mode");
      return (saved === "table" || saved === "grid") ? saved : "grid";
    } catch {
      return "grid";
    }
  });

  const setListDisplayMode = (mode: "grid" | "table") => {
    setListDisplayModeState(mode);
    try {
      localStorage.setItem("yau_marketing_contacts_list_display_mode", mode);
      localStorage.setItem("yau_marketing_view_mode", mode);
    } catch (err) {
      console.warn("Failed to save list display mode to localStorage", err);
    }
  };
  const [activeDrillDownList, setActiveDrillDownList] = useState<{
    name: string;
    category: string;
    description?: string;
    contacts: MarketingContact[];
    count: number;
  } | null>(null);
  const [drillDownSearch, setDrillDownSearch] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [showSyncInfo, setShowSyncInfo] = useState(false);

  // Modal States
  const [selectedContact, setSelectedContact] = useState<MarketingContact | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [showRawMetadata, setShowRawMetadata] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<MarketingContact | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedContactJson, setCopiedContactJson] = useState(false);
  const [isWebhookGuideOpen, setIsWebhookGuideOpen] = useState(false);
  const [copiedWebhookPayload, setCopiedWebhookPayload] = useState<string | null>(null);
  const [webhookPayloadTab, setWebhookPayloadTab] = useState<"full" | "school" | "location" | "app">("full");

  // Add Contact Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [addForm, setAddForm] = useState({
    parentName: "",
    email: "",
    phone: "",
    source: "Manual CRM Entry",
    schoolName: "",
    locationName: "",
    sport: "",
    gradeBand: "",
    planType: "",
    studentName: ""
  });

  const resetAddForm = () => {
    setAddForm({
      parentName: "",
      email: "",
      phone: "",
      source: "Manual CRM Entry",
      schoolName: "",
      locationName: "",
      sport: "",
      gradeBand: "",
      planType: "",
      studentName: ""
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

  // Helper: Resolve Dedicated List Name for each contact per client routing rules
  const getAssignedListName = useCallback((contact: MarketingContact) => {
    const src = (contact.source || "").toLowerCase();
    const school = (contact.schoolName || contact.metadata?.schoolName || contact.metadata?.school || "").trim();
    const location = (contact.locationName || contact.metadata?.locationName || contact.metadata?.location || "").trim();

    if (src.includes("manual")) {
      return "Manual CRM Entries";
    }
    if (src.includes("mobile") || src.includes("app")) {
      if (school) return `${school} - Mobile App`;
      if (location) return `${location} - Mobile App`;
      return "Free App Members";
    }
    if (src.includes("portal") || src.includes("web") || src.includes("evening") || (location && !school)) {
      return `${location || "General"} - Evening Activities`;
    }
    if (src.includes("afterschool") || src.includes("school") || (school && !location)) {
      return `${school || "General"} - After School`;
    }
    if (school) return `${school} - After School`;
    if (location) return `${location} - Evening Activities`;
    return "Free App Members";
  }, []);

  // Helper: Identify if contact is associated with AfterSchool
  const isAfterSchoolContact = useCallback((contact: MarketingContact | null | undefined): boolean => {
    if (!contact) return false;
    const src = (contact.source || "").toLowerCase();
    const entryPoint = (contact.entryPoint || "").toLowerCase();
    const assignedList = getAssignedListName(contact).toLowerCase();
    const school = (contact.schoolName || contact.metadata?.schoolName || contact.metadata?.school || "").trim();
    const location = (contact.locationName || contact.metadata?.locationName || contact.metadata?.location || "").trim();

    return (
      src.includes("afterschool") ||
      src.includes("school") ||
      entryPoint === "school" ||
      entryPoint.includes("afterschool") ||
      assignedList.includes("after school") ||
      (Boolean(school) && !location)
    );
  }, [getAssignedListName]);

  // Helper: Resolve Plan Type with default fallback to "Free Plan" for AfterSchool
  const getContactPlan = useCallback((contact: MarketingContact | null | undefined): string => {
    if (!contact) return "";
    const meta = contact.metadata || {};
    const explicitPlan = (contact.planType || meta.planType || meta.plan || "").trim();
    if (explicitPlan) return explicitPlan;

    if (isAfterSchoolContact(contact)) {
      return "Free Plan";
    }
    return "";
  }, [isAfterSchoolContact]);

  // Edit / Update Contact Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<MarketingContact | null>(null);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [editForm, setEditForm] = useState({
    parentName: "",
    email: "",
    phone: "",
    source: "App Registration",
    schoolName: "",
    locationName: "",
    sport: "",
    gradeBand: "",
    planType: "",
    studentName: "",
    status: "active" as "active" | "opted_out"
  });

  const handleOpenEdit = (contact: MarketingContact) => {
    setContactToEdit(contact);
    const meta = contact.metadata || {};
    setEditForm({
      parentName: contact.parentName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      source: contact.source || "App Registration",
      schoolName: contact.schoolName || meta.schoolName || meta.school || "",
      locationName: contact.locationName || meta.locationName || meta.location || "",
      sport: contact.sport || meta.sportsInterest || meta.sport || "",
      gradeBand: contact.gradeBand || meta.grade || meta.gradeBand || "",
      planType: contact.planType || meta.planType || meta.plan || (isAfterSchoolContact(contact) ? "Free Plan" : ""),
      studentName: contact.studentName || meta.studentName || meta.childName || "",
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

  // Fetch Contacts on initial mount or manual refresh / mutation
  const fetchContacts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch master marketing contacts list without channel filtering
      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
        source: "all"
      });

      const res = await api.get(`/marketing-contacts?${params.toString()}`);
      if (res.data?.success) {
        setContacts(res.data.contacts || []);
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
  }, []);

  const fetchSegments = useCallback(async () => {
    setLoadingSegments(true);
    try {
      let res;
      try {
        res = await api.get("/emails/segments");
      } catch {
        res = await api.get("/segments");
      }
      if (Array.isArray(res?.data)) {
        setSegments(res.data);
      }
    } catch (err) {
      console.error("Failed to load segments:", err);
    } finally {
      setLoadingSegments(false);
    }
  }, []);

  const handleRunBackfill = async () => {
    if (backfillingLists) return;
    setBackfillingLists(true);
    try {
      let res;
      try {
        res = await api.post("/emails/segments/backfill-lists");
      } catch {
        res = await api.post("/segments/backfill-lists");
      }
      if (res?.data?.success) {
        const stats = res.data.results;
        const countMsg = stats?.routedCount
          ? ` (${stats.routedCount} contacts organized into ${Object.keys(stats.distribution || {}).length} lists)`
          : "";
        toast.success(`Registration lists synchronized successfully!${countMsg}`);
        await Promise.all([fetchContacts(true), fetchSegments()]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to backfill registration lists");
    } finally {
      setBackfillingLists(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchSegments();
  }, [fetchContacts, fetchSegments]);



  // Compute Organized Lists & Categories for the Lists View (Strictly registration lists from emailmarketingcontacts)
  const organizedLists = useMemo(() => {
    const schoolListsMap = new Map<string, MarketingContact[]>();
    const locationListsMap = new Map<string, MarketingContact[]>();
    const appListsMap = new Map<string, MarketingContact[]>();
    const manualListsMap = new Map<string, MarketingContact[]>();

    // 1. Group all ingested contacts into their dedicated lists strictly from email_marketing_contacts
    contacts.forEach(contact => {
      const listName = getAssignedListName(contact);
      const lower = listName.toLowerCase();
      if (lower.includes("manual") || (contact.source || "").toLowerCase().includes("manual")) {
        const key = "Manual CRM Entries";
        if (!manualListsMap.has(key)) manualListsMap.set(key, []);
        manualListsMap.get(key)!.push(contact);
      } else if (lower.includes("after school")) {
        if (!schoolListsMap.has(listName)) schoolListsMap.set(listName, []);
        schoolListsMap.get(listName)!.push(contact);
      } else if (lower.includes("evening activities")) {
        if (!locationListsMap.has(listName)) locationListsMap.set(listName, []);
        locationListsMap.get(listName)!.push(contact);
      } else {
        if (!appListsMap.has(listName)) appListsMap.set(listName, []);
        appListsMap.get(listName)!.push(contact);
      }
    });

    // 2. Filter out any lists with 0 contacts so that every visible list has real data
    const schoolLists = Array.from(schoolListsMap.entries())
      .map(([name, listContacts]) => ({
        name,
        category: "school",
        description: `Dedicated email list for After School parents at ${name.replace(" - After School", "")}`,
        contacts: listContacts,
        count: listContacts.length
      }))
      .filter(l => l.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const locationLists = Array.from(locationListsMap.entries())
      .map(([name, listContacts]) => ({
        name,
        category: "location",
        description: `Dedicated email list for Evening Activities members at ${name.replace(" - Evening Activities", "")}`,
        contacts: listContacts,
        count: listContacts.length
      }))
      .filter(l => l.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const appLists = Array.from(appListsMap.entries())
      .map(([name, listContacts]) => ({
        name,
        category: "mobile",
        description: `Dedicated email list for mobile app registrations`,
        contacts: listContacts,
        count: listContacts.length
      }))
      .filter(l => l.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const manualLists = Array.from(manualListsMap.entries())
      .map(([name, listContacts]) => ({
        name,
        category: "manual",
        description: `Dedicated email list for contacts added manually into the CRM`,
        contacts: listContacts,
        count: listContacts.length
      }))
      .filter(l => l.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const mobileAndOtherLists = [...appLists];
    const allActiveLists = [...schoolLists, ...locationLists, ...appLists, ...manualLists];

    return {
      schoolLists,
      afterSchoolLists: schoolLists,
      locationLists,
      eveningActivityLists: locationLists,
      appLists,
      mobileAndOtherLists,
      manualLists,
      customLists: [],
      allActiveLists
    };
  }, [contacts, getAssignedListName]);

  // Filtered Lists for School & Location Toolbar
  const filteredActiveLists = useMemo(() => {
    const lists = organizedLists.allActiveLists || [];
    if (!listSearchQuery.trim()) return lists;
    const q = listSearchQuery.toLowerCase().trim();
    return lists.filter(l => l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q));
  }, [organizedLists.allActiveLists, listSearchQuery]);

  // Filtered Contacts inside Active Drill-down List
  const filteredDrillDownContacts = useMemo(() => {
    if (!activeDrillDownList) return [];
    const listContacts = activeDrillDownList.contacts || [];
    if (!drillDownSearch.trim()) return listContacts;
    const q = drillDownSearch.toLowerCase().trim();
    return listContacts.filter(c => {
      const meta = c.metadata || {};
      const matchName = (c.parentName || "").toLowerCase().includes(q);
      const matchEmail = (c.email || "").toLowerCase().includes(q);
      const matchPhone = (c.phone || "").toLowerCase().includes(q);
      const matchSport = (c.sport || meta.sportsInterest || meta.sport || "").toLowerCase().includes(q);
      const matchStudent = (c.studentName || meta.studentName || meta.childName || "").toLowerCase().includes(q);
      const matchGrade = (c.gradeBand || meta.grade || meta.gradeBand || "").toLowerCase().includes(q);
      const matchPlan = getContactPlan(c).toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchSport || matchStudent || matchGrade || matchPlan;
    });
  }, [activeDrillDownList, drillDownSearch, getContactPlan]);

  // Client-Side In-Memory Filtering (Zero network calls on filter/toggle)
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // 0. Dedicated List Filter
      if (selectedListFilter) {
        const assigned = getAssignedListName(contact);
        if (assigned !== selectedListFilter) {
          return false;
        }
      }
      // 1. Source filter
      if (sourceFilter !== "all") {
        const src = (contact.source || "").toLowerCase();
        if (sourceFilter === "mobile") {
          if (!src.includes("mobile")) return false;
        } else if (sourceFilter === "web_portal" || sourceFilter === "portal") {
          if (!src.includes("portal") && !src.includes("web")) return false;
        } else if (sourceFilter === "afterschool") {
          if (!src.includes("afterschool")) return false;
        } else if (sourceFilter === "manual") {
          if (!src.includes("manual")) return false;
        } else {
          if (!src.includes(sourceFilter.toLowerCase())) return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== "all" && contact.status !== statusFilter) {
        return false;
      }

      // 3. Deduplicated only filter
      if (deduplicatedOnly && (contact.submissionCount || 1) <= 1) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = contact.parentName?.toLowerCase().includes(q);
        const matchEmail = contact.email?.toLowerCase().includes(q);
        const matchPhone = contact.phone?.toLowerCase().includes(q);
        const matchSource = contact.source?.toLowerCase().includes(q);
        const matchSchool = (contact.schoolName || contact.metadata?.schoolName || "").toLowerCase().includes(q);
        const matchLocation = (contact.locationName || contact.metadata?.locationName || "").toLowerCase().includes(q);
        const matchSport = (contact.sport || contact.metadata?.sportsInterest || "").toLowerCase().includes(q);
        const matchStudent = (contact.studentName || contact.metadata?.studentName || "").toLowerCase().includes(q);
        const matchPlan = getContactPlan(contact).toLowerCase().includes(q);

        if (!matchName && !matchEmail && !matchPhone && !matchSource && !matchSchool && !matchLocation && !matchSport && !matchStudent && !matchPlan) {
          return false;
        }
      }

      return true;
    });
  }, [contacts, sourceFilter, statusFilter, deduplicatedOnly, searchQuery, selectedListFilter, getAssignedListName, getContactPlan]);

  // Client-Side Sorting
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let valA: any = a[sortBy as keyof MarketingContact] ?? "";
      let valB: any = b[sortBy as keyof MarketingContact] ?? "";

      if (sortBy === "lastRegisteredAt" || sortBy === "createdAt") {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredContacts, sortBy, sortOrder]);

  // Client-Side Pagination & Counts
  const totalCount = sortedContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const paginatedContacts = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedContacts.slice(start, start + limit);
  }, [sortedContacts, page, limit]);

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
    const exportData = filteredContacts.length > 0 ? filteredContacts : contacts;
    if (exportData.length === 0) {
      toast.error("No contacts available to export");
      return;
    }

    const headers = [
      "Parent Name",
      "Email Address",
      "Phone Number",
      "Registration Source",
      "School Name",
      "Location Name",
      "Sport",
      "Grade Band",
      "Plan Type",
      "Student / Athlete Name",
      "Submissions",
      "Last Registered"
    ];
    const rows = exportData.map(c => {
      const meta = c.metadata || {};
      return [
        c.parentName || "",
        c.email || "",
        c.phone || "",
        c.source || "App Registration",
        c.schoolName || meta.schoolName || meta.school || "",
        c.locationName || meta.locationName || meta.location || "",
        c.sport || meta.sportsInterest || meta.sport || "",
        c.gradeBand || meta.grade || meta.gradeBand || "",
        getContactPlan(c),
        c.studentName || meta.studentName || meta.childName || "",
        c.submissionCount || 1,
        c.lastRegisteredAt ? new Date(c.lastRegisteredAt).toLocaleString() : ""
      ];
    });

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

  const getSourceCount = useCallback((srcKey: string) => {
    let sum = 0;
    const lower = srcKey.toLowerCase();
    contacts.forEach(c => {
      const src = (c.source || "").toLowerCase();
      if (lower === "web_portal" || lower === "portal") {
        if (src.includes("portal") || src.includes("web")) {
          sum += 1;
        }
      } else if (lower === "mobile") {
        if (src.includes("mobile")) {
          sum += 1;
        }
      } else if (lower === "afterschool") {
        if (src.includes("afterschool")) {
          sum += 1;
        }
      } else if (lower === "manual") {
        if (src.includes("manual")) {
          sum += 1;
        }
      } else if (src.includes(lower)) {
        sum += 1;
      }
    });

    if (sum === 0 && stats.bySource) {
      if (stats.bySource[srcKey] !== undefined) return stats.bySource[srcKey];
      Object.entries(stats.bySource).forEach(([k, count]) => {
        const kLower = k.toLowerCase();
        if (lower === "web_portal" || lower === "portal") {
          if (kLower.includes("portal") || kLower.includes("web")) sum += count;
        } else if (lower === "mobile" && kLower.includes("mobile")) {
          sum += count;
        } else if (lower === "afterschool" && kLower.includes("afterschool")) {
          sum += count;
        } else if (lower === "manual" && kLower.includes("manual")) {
          sum += count;
        } else if (kLower.includes(lower)) {
          sum += count;
        }
      });
    }
    return sum;
  }, [contacts, stats]);

  const deduplicatedCount = useMemo(() => {
    const inMem = contacts.filter(c => (c.submissionCount || 1) > 1).length;
    return inMem || stats.deduplicated || 0;
  }, [contacts, stats]);

  const getSourceBadge = (source?: string) => {
    const src = (source || "App Registration").trim();
    const lower = src.toLowerCase();

    if (lower.includes("mobile")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
          <Smartphone size={11} /> {src}
        </span>
      );
    }
    if (lower.includes("portal") || lower.includes("web")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
          <Globe size={11} /> {src}
        </span>
      );
    }
    if (lower.includes("afterschool")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
          <GraduationCap size={11} /> {src}
        </span>
      );
    }
    if (lower.includes("manual")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          <UserPlus size={11} /> {src}
        </span>
      );
    }
    if (lower.includes("school")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
          <School size={11} /> {src}
        </span>
      );
    }
    if (lower.includes("location")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          <MapPin size={11} /> {src}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
        <Sparkles size={11} /> {src}
      </span>
    );
  };
  const getEntryPointBadge = getSourceBadge;

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
                  {contacts.length || stats.total} Records
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master database of parent contacts ingested via webhooks across all 4 registration entry points.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* View Mode Switcher: All Contacts vs School & Location Lists */}
            <div className="flex items-center bg-accent/30 border p-1 rounded-xl gap-1 shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setViewMode("contacts");
                  setSelectedListFilter(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "contacts" && !selectedListFilter
                    ? "bg-card text-foreground shadow-2xs font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users size={13} />
                <span>All Contacts</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("lists")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "lists"
                    ? "bg-card text-primary shadow-2xs font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers size={13} />
                <span>School & Location Lists</span>
              </button>
            </div>

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Users size={11} className="text-primary" /> Total Ingested
            </span>
            <div className="text-xl font-black text-foreground">{stats.total || contacts.length}</div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1">
              <Smartphone size={11} /> Mobile Signups
            </span>
            <div className="text-xl font-black text-violet-600 dark:text-violet-400">
              {getSourceCount("mobile")}
            </div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Globe size={11} /> Web Portal Signups
            </span>
            <div className="text-xl font-black text-sky-600 dark:text-sky-400">
              {getSourceCount("web_portal")}
            </div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <GraduationCap size={11} /> AfterSchool Signups
            </span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {getSourceCount("afterschool")}
            </div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <UserPlus size={11} /> Manual CRM
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {getSourceCount("manual")}
            </div>
          </div>

          <div className="p-3 bg-card border rounded-2xl shadow-2xs text-left space-y-1 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle size={11} /> Deduplicated (2x+)
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{deduplicatedCount}</div>
          </div>
        </div>

        {viewMode === "lists" ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {activeDrillDownList ? (
              /* --- INLINE CONTACTS TABLE DRILL-DOWN --- */
              <div className="space-y-4">
                {/* Drill-down Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrillDownList(null);
                        setDrillDownSearch("");
                      }}
                      className="h-9 px-3 rounded-xl border bg-accent/40 hover:bg-accent text-foreground font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <ArrowLeft size={13} />
                      <span>Back to Lists</span>
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-foreground tracking-tight">
                          {activeDrillDownList.name}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          activeDrillDownList.category === "school"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : activeDrillDownList.category === "location"
                            ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                            : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                        }`}>
                          {activeDrillDownList.category === "school" ? "After School" : activeDrillDownList.category === "location" ? "Evening Activities" : "Mobile App"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                          {activeDrillDownList.count} Enrolled Contacts
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeDrillDownList.description || `Registered contacts belonging to ${activeDrillDownList.name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search list contacts..."
                        value={drillDownSearch}
                        onChange={e => setDrillDownSearch(e.target.value)}
                        className="h-8.5 input-field text-xs !pl-9 pr-3 w-44 sm:w-56 dark:bg-card rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Drill-down Contacts Data Table */}
                <div className="border rounded-2xl bg-card overflow-hidden shadow-2xs flex flex-col min-h-0">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          <th className="p-3.5 pl-5 align-middle">Parent / Lead</th>
                          <th className="p-3.5 align-middle">Contact Info</th>
                          <th className="p-3.5 align-middle">Registration Details</th>
                          <th className="p-3.5 align-middle text-center">Submissions</th>
                          <th className="p-3.5 align-middle text-center">Status</th>
                          <th className="p-3.5 pr-5 align-middle text-center w-[90px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredDrillDownContacts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-muted-foreground">
                              <Users size={32} className="opacity-40 mx-auto mb-2" />
                              <p className="text-xs font-bold text-foreground">No Contacts Found</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {drillDownSearch ? "No contacts match your search query." : "No contacts enrolled in this list."}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredDrillDownContacts.map(contact => {
                            const initials = contact.parentName
                              ? contact.parentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                              : "MC";
                            const meta = contact.metadata || {};
                            const sport = contact.sport || meta.sportsInterest || meta.sport || "";
                            const grade = contact.gradeBand || meta.grade || meta.gradeBand || "";
                            const plan = getContactPlan(contact);
                            const student = contact.studentName || meta.studentName || meta.childName || "";

                            return (
                              <tr
                                key={contact._id}
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="hover:bg-accent/30 transition-colors cursor-pointer group"
                              >
                                <td className="p-3.5 pl-5 align-middle">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8.5 w-8.5 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-foreground text-xs truncate max-w-[170px]">
                                        {contact.parentName}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {getSourceBadge(contact.source)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3.5 align-middle">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                      <span className="truncate max-w-[190px]">{contact.email}</span>
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          handleCopy(contact.email, contact._id);
                                        }}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer opacity-70 group-hover:opacity-100"
                                      >
                                        {copiedEmail === contact._id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                      </button>
                                    </div>
                                    {contact.phone && (
                                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Phone size={10} /> {contact.phone}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5 align-middle">
                                  <div className="space-y-1 text-xs">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {sport && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                          ⚽ {sport}
                                        </span>
                                      )}
                                      {grade && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                                          🎓 {grade}
                                        </span>
                                      )}
                                      {plan && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                          💳 {plan}
                                        </span>
                                      )}
                                    </div>
                                    {student && (
                                      <div className="text-[11px] text-muted-foreground">
                                        Athlete: <strong className="text-foreground">{student}</strong>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5 align-middle text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    (contact.submissionCount || 1) > 1
                                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                      : "bg-muted text-muted-foreground border"
                                  }`}>
                                    {contact.submissionCount || 1}x
                                  </span>
                                </td>
                                <td className="p-3.5 align-middle text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    contact.status === "opted_out"
                                      ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  }`}>
                                    {contact.status || "active"}
                                  </span>
                                </td>
                                <td className="p-3.5 pr-5 align-middle text-center" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedContact(contact);
                                      setIsDetailsModalOpen(true);
                                    }}
                                    className="h-7.5 px-2.5 rounded-lg border bg-accent/40 hover:bg-accent text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Eye size={12} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 px-5 border-t bg-card text-xs text-muted-foreground flex items-center justify-between">
                    <span>Showing <strong className="text-foreground">{filteredDrillDownContacts.length}</strong> of <strong className="text-foreground">{activeDrillDownList.count}</strong> contacts in this list</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrillDownList(null);
                        setDrillDownSearch("");
                      }}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      ← Return to Lists Overview
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- LISTS OVERVIEW (GRID VS TABLE) --- */
              <div className="space-y-3.5 flex-1 flex flex-col min-h-0">
                {/* Lists Toolbar: Search, Count, Compact Sync with Info ?, Grid/Table Switcher */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-2 px-3 rounded-2xl border shadow-2xs shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search school & location lists..."
                        value={listSearchQuery}
                        onChange={e => setListSearchQuery(e.target.value)}
                        className="h-8.5 input-field text-xs !pl-9 pr-3 w-48 sm:w-64 dark:bg-card rounded-xl"
                      />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground px-2.5 py-1 bg-accent/40 rounded-xl border border-border/50">
                      Active Lists: <strong className="text-foreground">{filteredActiveLists.length}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Compact Sync All Lists Button + Interactive ? Info UI */}
                    <div className="relative flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleRunBackfill}
                        disabled={backfillingLists}
                        className="btn-secondary text-xs h-8.5 px-3 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 border rounded-xl font-bold"
                        title="Synchronize and backfill registration lists"
                      >
                        <RefreshCw size={12} className={backfillingLists ? "animate-spin text-primary" : "text-primary"} />
                        <span>{backfillingLists ? "Syncing..." : "Sync All Lists"}</span>
                      </button>

                      {/* Small ? UI Button */}
                      <button
                        type="button"
                        onClick={() => setShowSyncInfo(prev => !prev)}
                        onMouseEnter={() => setShowSyncInfo(true)}
                        onMouseLeave={() => setShowSyncInfo(false)}
                        className="h-8.5 w-8.5 rounded-xl border bg-card hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        aria-label="List routing info"
                        title="What does this do?"
                      >
                        <HelpCircle size={14} className="text-muted-foreground hover:text-primary transition-colors" />
                      </button>

                      {/* Popover Card explaining the routing & sync */}
                      {showSyncInfo && (
                        <div
                          onMouseEnter={() => setShowSyncInfo(true)}
                          onMouseLeave={() => setShowSyncInfo(false)}
                          className="absolute right-0 top-10 z-50 w-80 sm:w-88 p-3.5 bg-popover text-popover-foreground border rounded-2xl shadow-xl space-y-2 text-xs animate-in fade-in zoom-in-95 backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-1.5 font-extrabold text-foreground border-b pb-2">
                            <Sparkles size={13} className="text-primary" />
                            <span>School & Location Auto-Routing</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
                            <p>
                              • 🏫 <strong>After School</strong>: Each school automatically has its own dedicated list (<code className="font-semibold text-foreground px-1 py-0.2 rounded bg-accent text-[10px]">[School] - After School</code>).
                            </p>
                            <p>
                              • 📍 <strong>Evening Activities</strong>: Each location gets its own list (<code className="font-semibold text-foreground px-1 py-0.2 rounded bg-accent text-[10px]">[Location] - Evening Activities</code>).
                            </p>
                            <p>
                              • 📱 <strong>Mobile App</strong>: Users without a school/location drop into <code className="font-semibold text-foreground px-1 py-0.2 rounded bg-accent text-[10px]">Free App Members</code>.
                            </p>
                            <p className="pt-1 border-t text-[10px] text-primary font-semibold">
                              💡 <strong>Sync All Lists</strong>: Scans all parent registrations and automatically populates/routes them into their dedicated CRM lists.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grid vs Table Switcher (Styled like /email-center?tab=segments) */}
                    <div className="flex items-center bg-accent/60 dark:bg-accent/20 border border-border/80 p-1 rounded-xl text-xs shrink-0 h-8.5 w-[140px] gap-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setListDisplayMode('grid')}
                        className={`flex-1 h-full rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                          listDisplayMode === 'grid'
                            ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/40 font-medium'
                        }`}
                        title="Cards Grid View"
                      >
                        <LayoutGrid size={13} className={listDisplayMode === 'grid' ? 'text-primary' : 'text-muted-foreground'} />
                        <span>Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setListDisplayMode('table')}
                        className={`flex-1 h-full rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                          listDisplayMode === 'table'
                            ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/40 font-medium'
                        }`}
                        title="Tabular List View"
                      >
                        <Table size={13} className={listDisplayMode === 'table' ? 'text-primary' : 'text-muted-foreground'} />
                        <span>Table</span>
                      </button>
                    </div>
                  </div>
                </div>

                {loadingSegments ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-card rounded-2xl border">
                    <Loader2 className="animate-spin text-primary h-6 w-6" />
                    <span className="text-xs font-semibold">Loading school and location lists...</span>
                  </div>
                ) : filteredActiveLists.length === 0 ? (
                  <div className="p-12 rounded-2xl border border-dashed bg-card text-center text-muted-foreground space-y-2">
                    <Users size={36} className="opacity-40 mx-auto" />
                    <h4 className="text-sm font-bold text-foreground">No School or Location Lists with Contacts Found</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Lists are only created and displayed when corresponding registration data is present. Ingest parent registrations or click "Backfill & Sync All Lists".
                    </p>
                  </div>
                ) : listDisplayMode === 'table' ? (
                  /* --- TABLE VIEW OF LISTS --- */
                  <div className="border rounded-2xl overflow-hidden bg-card shadow-2xs">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            <th className="p-3.5 pl-5 align-middle">List / Audience Name</th>
                            <th className="p-3.5 align-middle">Category</th>
                            <th className="p-3.5 align-middle text-center">Enrolled Contacts</th>
                            <th className="p-3.5 pr-5 align-middle text-right w-[140px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredActiveLists.map(list => (
                            <tr
                              key={list.name}
                              onClick={() => {
                                setActiveDrillDownList(list);
                                setDrillDownSearch("");
                              }}
                              className="hover:bg-accent/30 transition-colors cursor-pointer group"
                            >
                              <td className="p-3.5 pl-5 align-middle">
                                <div className="space-y-0.5">
                                  <div className="font-extrabold text-foreground group-hover:text-primary transition-colors text-xs flex items-center gap-2">
                                    {list.category === "school" ? (
                                      <GraduationCap size={14} className="text-amber-500 shrink-0" />
                                    ) : list.category === "location" ? (
                                      <MapPin size={14} className="text-sky-500 shrink-0" />
                                    ) : list.category === "manual" ? (
                                      <UserPlus size={14} className="text-emerald-500 shrink-0" />
                                    ) : (
                                      <Smartphone size={14} className="text-purple-500 shrink-0" />
                                    )}
                                    <span>{list.name}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {list.description || `Dedicated email list for registered members`}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3.5 align-middle">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  list.category === "school"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    : list.category === "location"
                                    ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                                    : list.category === "manual"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                }`}>
                                  {list.category === "school" ? "After School" : list.category === "location" ? "Evening Activities" : list.category === "manual" ? "Manual Entry" : "Mobile App"}
                                </span>
                              </td>
                              <td className="p-3.5 align-middle text-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                                  <Users size={11} /> {list.count} Contacts
                                </span>
                              </td>
                              <td className="p-3.5 pr-5 align-middle text-right" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDrillDownList(list);
                                    setDrillDownSearch("");
                                  }}
                                  className="h-8 px-3 rounded-xl border bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                >
                                  <Eye size={12} />
                                  <span>View Contacts</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* --- GRID VIEW OF LISTS --- */
                  <div className="space-y-6">
                    {/* 1. After School Lists */}
                    {organizedLists.afterSchoolLists.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <GraduationCap size={16} />
                            </div>
                            <h4 className="text-sm font-black text-foreground">
                              After School Dedicated Lists ({organizedLists.afterSchoolLists.length})
                            </h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Format: [School Name] - After School
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {organizedLists.afterSchoolLists
                            .filter(l => !listSearchQuery.trim() || l.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
                            .map(list => (
                              <div
                                key={list.name}
                                onClick={() => {
                                  setActiveDrillDownList(list);
                                  setDrillDownSearch("");
                                }}
                                className="p-4 rounded-xl border bg-card hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                                      {list.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                                      {list.count} contacts
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                                    {list.description || `Dedicated email list for parents registered via ${list.name}`}
                                  </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  <span>View Contacts</span>
                                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Evening Activities Lists */}
                    {organizedLists.eveningActivityLists.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                              <MapPin size={16} />
                            </div>
                            <h4 className="text-sm font-black text-foreground">
                              Evening Activities Dedicated Lists ({organizedLists.eveningActivityLists.length})
                            </h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Format: [Location Name] - Evening Activities
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {organizedLists.eveningActivityLists
                            .filter(l => !listSearchQuery.trim() || l.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
                            .map(list => (
                              <div
                                key={list.name}
                                onClick={() => {
                                  setActiveDrillDownList(list);
                                  setDrillDownSearch("");
                                }}
                                className="p-4 rounded-xl border bg-card hover:border-sky-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-extrabold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                                      {list.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/10 text-sky-600 border border-sky-500/20 shrink-0">
                                      {list.count} contacts
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                                    {list.description || `Dedicated email list for evening activity members at ${list.name}`}
                                  </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] font-bold text-sky-600 dark:text-sky-400">
                                  <span>View Contacts</span>
                                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Mobile App & General Lists */}
                    {organizedLists.mobileAndOtherLists.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              <Smartphone size={16} />
                            </div>
                            <h4 className="text-sm font-black text-foreground">
                              Mobile App &amp; General Audience Lists ({organizedLists.mobileAndOtherLists.length})
                            </h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Free App Members &amp; Custom Lists
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {organizedLists.mobileAndOtherLists
                            .filter(l => !listSearchQuery.trim() || l.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
                            .map(list => (
                              <div
                                key={list.name}
                                onClick={() => {
                                  setActiveDrillDownList(list);
                                  setDrillDownSearch("");
                                }}
                                className="p-4 rounded-xl border bg-card hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-extrabold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                                      {list.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-600 border border-purple-500/20 shrink-0">
                                      {list.count} contacts
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                                    {list.description || `Registered mobile app users and general marketing list`}
                                  </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                  <span>View Contacts</span>
                                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Manual Added Data Lists */}
                    {organizedLists.manualLists.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <UserPlus size={16} />
                            </div>
                            <h4 className="text-sm font-black text-foreground">
                              Manual Added Data Lists ({organizedLists.manualLists.length})
                            </h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Manually added &amp; imported CRM contacts
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {organizedLists.manualLists
                            .filter(l => !listSearchQuery.trim() || l.name.toLowerCase().includes(listSearchQuery.toLowerCase()))
                            .map(list => (
                              <div
                                key={list.name}
                                onClick={() => {
                                  setActiveDrillDownList(list);
                                  setDrillDownSearch("");
                                }}
                                className="p-4 rounded-xl border bg-card hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                                      {list.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                      {list.count} contacts
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                                    {list.description || `Dedicated email list for contacts added manually`}
                                  </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <span>View Contacts</span>
                                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active Dedicated List Filter Banner */}
            {selectedListFilter && (
              <div className="p-3 px-4 rounded-xl border bg-primary/10 border-primary/30 flex items-center justify-between gap-3 text-xs text-foreground shrink-0 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-primary shrink-0" />
                  <span>
                    Filtered by CRM List: <strong className="font-extrabold text-primary">{selectedListFilter}</strong>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                    {filteredContacts.length} contacts
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedListFilter(null)}
                  className="px-2.5 py-1 rounded-lg border bg-card hover:bg-accent text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X size={12} />
                  <span>Clear Filter</span>
                </button>
              </div>
            )}

            {/* Tier 3: Search, Channel Tabs & Filters */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-card p-2.5 px-3.5 rounded-2xl border shadow-2xs shrink-0">
          {/* Channel Filter Pills */}
          <div className="flex items-center bg-accent/40 border p-1 rounded-xl overflow-x-auto custom-scrollbar text-xs font-bold gap-1 shrink-0">
            {[
              { id: "all", label: "All Contacts", count: contacts.length || stats.total },
              { id: "mobile", label: "Mobile", count: getSourceCount("mobile") },
              { id: "web_portal", label: "Web Portal", count: getSourceCount("web_portal") },
              { id: "afterschool", label: "AfterSchool", count: getSourceCount("afterschool") },
              { id: "manual", label: "Manual CRM Entry", count: getSourceCount("manual") }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSourceFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  sourceFilter === tab.id
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
                  <th className="p-3.5 align-middle">Source</th>
                  <th className="p-3.5 align-middle min-w-[250px]">Registration Details</th>
                  <th className="p-3.5 align-middle text-center">Submissions</th>
                  <th className="p-3.5 align-middle text-center">Status</th>
                  <th className="p-3.5 pr-5 align-middle text-center w-[70px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-primary h-6 w-6" />
                        <span className="text-xs font-semibold">Loading marketing contacts...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={36} className="opacity-40 mb-1" />
                        <span className="text-sm font-bold text-foreground">No Marketing Contacts Found</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {searchQuery || sourceFilter !== "all" || statusFilter !== "all" || deduplicatedOnly
                            ? "Try adjusting your search query or filter options."
                            : "Incoming parent registrations from your mobile app, registration portal, or admin panel will appear here automatically."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map(contact => {
                    const initials = contact.parentName
                      ? contact.parentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                      : "MC";
                    const isCopied = copiedEmail === contact._id;
                    const meta = contact.metadata || {};
                    const school = contact.schoolName || meta.schoolName || meta.school || "";
                    const location = contact.locationName || meta.locationName || meta.location || "";
                    const sport = contact.sport || meta.sportsInterest || meta.sport || "";
                    const grade = contact.gradeBand || meta.grade || meta.gradeBand || "";
                    const plan = getContactPlan(contact);
                    const student = contact.studentName || meta.studentName || meta.childName || "";

                    return (
                      <tr
                        key={contact._id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setIsDetailsModalOpen(true);
                        }}
                        className="hover:bg-accent/30 transition-colors cursor-pointer group"
                      >
                        {/* Parent Contact */}
                        <td className="p-3.5 pl-5 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-foreground text-xs truncate max-w-[180px]">
                                {contact.parentName}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                {contact.phone ? (
                                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                                    <Phone size={10} /> {contact.phone}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/60 italic">No phone</span>
                                )}
                              </div>
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

                        {/* Registration Source */}
                        <td className="p-3.5 align-middle">
                          {getSourceBadge(contact.source)}
                        </td>

                        {/* Registration Details with Interactive HoverCard */}
                        <td className="p-3 align-middle" onClick={e => e.stopPropagation()}>
                          <HoverCard openDelay={150} closeDelay={150}>
                            <HoverCardTrigger asChild>
                              <div
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="group/cell flex flex-col gap-1.5 p-2 rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/40 transition-all cursor-pointer max-w-[320px]"
                              >
                                {/* Primary Line: School/Location Badge + Sport/Plan Tag */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {school ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 max-w-[170px] truncate shadow-2xs">
                                      <School size={10} className="shrink-0" />
                                      <span className="truncate">{school}</span>
                                    </span>
                                  ) : location ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 max-w-[170px] truncate shadow-2xs">
                                      <MapPin size={10} className="shrink-0" />
                                      <span className="truncate">{location}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shadow-2xs">
                                      <Sparkles size={10} className="shrink-0" />
                                      <span>Direct App Profile</span>
                                    </span>
                                  )}

                                  {sport && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
                                      <Award size={10} className="shrink-0" />
                                      <span className="truncate max-w-[110px]">{sport}</span>
                                    </span>
                                  )}

                                  {plan && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                      {plan}
                                    </span>
                                  )}
                                </div>

                                {/* Secondary Line: Student / Athlete, Grade Band & Assigned CRM List */}
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                                  {student && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-accent/60 px-1.5 py-0.5 rounded border border-border/40 truncate max-w-[140px]">
                                      <User size={9} className="text-muted-foreground shrink-0" />
                                      <span className="truncate">{student}</span>
                                    </span>
                                  )}

                                  {grade && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-medium border border-border/40">
                                      {grade}
                                    </span>
                                  )}

                                  {/* Assigned Dedicated List Tag */}
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 truncate max-w-[150px]">
                                    <Layers size={9} className="shrink-0" />
                                    <span className="truncate">{getAssignedListName(contact)}</span>
                                  </span>
                                </div>
                              </div>
                            </HoverCardTrigger>

                            {/* Rich Radix HoverCard Popover */}
                            <HoverCardContent
                              align="start"
                              side="top"
                              sideOffset={8}
                              className="w-[340px] p-0 rounded-2xl border bg-card text-foreground shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95"
                            >
                              {/* Header Card Strip */}
                              <div className="p-3.5 pb-2.5 bg-muted/40 border-b flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                    <Sparkles size={13} />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-extrabold text-foreground truncate">
                                      Registration Overview
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      Source: <strong className="text-foreground capitalize">{contact.source ? contact.source.replace(/_/g, " ") : "Direct"}</strong>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/70 border text-muted-foreground shrink-0">
                                  {contact.status === "opted_out" ? "Opted Out" : "Active"}
                                </span>
                              </div>

                              {/* Structured Field Grid */}
                              <div className="p-3.5 space-y-2.5 text-xs">
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  {/* School Name */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <School size={10} className="text-blue-500" /> School Name
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={school || "Not specified"}>
                                      {school || "Not specified"}
                                    </div>
                                  </div>

                                  {/* Location Name */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <MapPin size={10} className="text-emerald-500" /> Location Name
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={location || "Not specified"}>
                                      {location || "Not specified"}
                                    </div>
                                  </div>

                                  {/* Student / Athlete */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <User size={10} className="text-primary" /> Athlete / Student
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={student || "Not specified"}>
                                      {student || "Not specified"}
                                    </div>
                                  </div>

                                  {/* Sport Registered */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <Award size={10} className="text-amber-500" /> Sport Registered
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={sport || "General Sports"}>
                                      {sport || "General Sports"}
                                    </div>
                                  </div>

                                  {/* Grade Band */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <GraduationCap size={10} className="text-purple-500" /> Grade Band
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={grade || "Not specified"}>
                                      {grade || "Not specified"}
                                    </div>
                                  </div>

                                  {/* Plan Type */}
                                  <div className="p-2 rounded-xl bg-accent/25 border border-border/50">
                                    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <Sparkles size={10} className="text-indigo-500" /> Plan Type
                                    </div>
                                    <div className="font-bold text-foreground text-xs truncate" title={plan || "Standard"}>
                                      {plan || "Standard"}
                                    </div>
                                  </div>
                                </div>

                                {/* Assigned CRM List Routing Banner */}
                                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Layers size={13} className="text-primary shrink-0" />
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">CRM Segment:</span>
                                    <span className="font-bold text-primary truncate text-xs">{getAssignedListName(contact)}</span>
                                  </div>
                                </div>

                                {/* Custom Meta Indicator */}
                                {Object.keys(meta).length > 0 && (
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-1 border-t">
                                    <span>Payload Attributes:</span>
                                    <span className="font-bold text-foreground bg-accent/50 px-2 py-0.5 rounded-full border">
                                      {Object.keys(meta).length} custom fields recorded
                                    </span>
                                  </div>
                                )}

                                <div className="text-[10px] text-center text-muted-foreground/70 italic pt-0.5">
                                  Click contact to view complete JSON payload & edit
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>

                        {/* Submissions */}
                        <td className="p-3.5 align-middle text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent/60 text-foreground border border-border/60">
                            <Flame size={11} className="text-amber-500" /> {contact.submissionCount || 1}
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
      </>
    )}
  </div>

      {/* --- MODAL 1: CONTACT DETAILS & METADATA VIEWER --- */}
      <Dialog
        open={isDetailsModalOpen}
        onOpenChange={(open) => {
          setIsDetailsModalOpen(open);
          if (!open) setShowRawMetadata(false);
        }}
      >
        <DialogContent className="w-[95vw] max-w-3xl max-h-[88vh] p-0 flex flex-col overflow-hidden dark:bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 pb-3.5 pr-14 sm:pr-16 border-b shrink-0 bg-card">
            <div className="flex items-center justify-between gap-3 text-left flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                  {selectedContact?.parentName?.substring(0, 2).toUpperCase() || "MC"}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2 flex-wrap">
                    <span>{selectedContact?.parentName}</span>
                    {selectedContact && getSourceBadge(selectedContact.source)}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground truncate">{selectedContact?.email}</p>
                </div>
              </div>

              {/* Status Action Button */}
              {selectedContact && (
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedContact)}
                  disabled={updatingStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 ${
                    selectedContact.status === "opted_out"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                  }`}
                >
                  {updatingStatus ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : selectedContact.status === "opted_out" ? (
                    <CheckCircle size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  <span>{selectedContact.status === "opted_out" ? "Reactivate Contact" : "Opt Out Contact"}</span>
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
            {/* 1. Contact & Account Overview */}
            <div className="p-4 bg-card border rounded-xl space-y-2.5 shadow-2xs">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                <span>Contact & Account Details</span>
                <span className="font-semibold normal-case text-foreground">{selectedContact?.source || "Registration"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">Parent Name:</span>
                  <span className="font-semibold text-foreground">{selectedContact?.parentName}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">Email Address:</span>
                  <span className="font-semibold text-foreground break-all">{selectedContact?.email}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">Phone Number:</span>
                  <span className="font-semibold text-foreground">{selectedContact?.phone || "None"}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">Registration Source:</span>
                  <span className="font-semibold text-foreground">{selectedContact?.source || "App Registration"}</span>
                </div>
                <div className="flex items-baseline gap-1.5 col-span-1 sm:col-span-2">
                  <span className="font-bold text-muted-foreground shrink-0">Assigned CRM List:</span>
                  <span className="font-bold text-primary flex items-center gap-1">
                    <Layers size={11} /> {selectedContact ? getAssignedListName(selectedContact) : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Program & Registration Details (Uniform Label: Value format, only shown ONCE) */}
            <div className="p-4 bg-card border rounded-xl space-y-2.5 shadow-2xs">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                <Sparkles size={13} /> Registration & Program Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-1 text-xs">
                {/* School Name */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">School Name:</span>
                  <span className="font-bold text-foreground">
                    {selectedContact?.schoolName || selectedContact?.metadata?.schoolName || selectedContact?.metadata?.school || "Not specified"}
                  </span>
                </div>

                {/* Location Name */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">Location Name:</span>
                  <span className="font-bold text-foreground">
                    {selectedContact?.locationName || selectedContact?.metadata?.locationName || selectedContact?.metadata?.location || "Not specified"}
                  </span>
                </div>

                {/* Sport Registered For */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">Sport Registered For:</span>
                  <span className="font-bold text-foreground">
                    {selectedContact?.sport || selectedContact?.metadata?.sportsInterest || selectedContact?.metadata?.sport || "General Sports"}
                  </span>
                </div>

                {/* Grade Band */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">Grade Band:</span>
                  <span className="font-bold text-foreground">
                    {selectedContact?.gradeBand || selectedContact?.metadata?.grade || selectedContact?.metadata?.gradeBand || "Not specified"}
                  </span>
                </div>

                {/* Plan Type */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">Plan Type:</span>
                  <span className="font-bold text-foreground">
                    {getContactPlan(selectedContact) || "Not specified"}
                  </span>
                </div>

                {/* Student / Athlete */}
                <div className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                  <span className="font-bold text-muted-foreground shrink-0">Student / Athlete:</span>
                  <span className="font-bold text-foreground">
                    {selectedContact?.studentName || selectedContact?.metadata?.studentName || selectedContact?.metadata?.childName || "Not specified"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Consent & Activity Tracking */}
            <div className="p-4 bg-card border rounded-xl space-y-2.5 shadow-2xs">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5">
                Consent & Activity Tracking
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground shrink-0">Email Status:</span>
                  {selectedContact?.status === "opted_out" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <AlertCircle size={11} /> Opted Out
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle size={11} /> Active & Subscribed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground shrink-0">SMS Consent:</span>
                  {selectedContact?.metadata?.smsConsent === true || selectedContact?.metadata?.smsConsent === "true" || selectedContact?.metadata?.smsConsent === "yes" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Check size={11} /> Granted (Yes)
                    </span>
                  ) : selectedContact?.metadata?.smsConsent === false || selectedContact?.metadata?.smsConsent === "false" || selectedContact?.metadata?.smsConsent === "no" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/40 text-muted-foreground">
                      No
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Not specified</span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">First Ingested:</span>
                  <span className="font-semibold text-foreground">
                    {selectedContact?.createdAt ? new Date(selectedContact.createdAt).toLocaleString() : "N/A"}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-muted-foreground shrink-0">Latest Submission:</span>
                  <span className="font-semibold text-foreground">
                    {selectedContact?.lastRegisteredAt ? new Date(selectedContact.lastRegisteredAt).toLocaleString() : "N/A"}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 col-span-1 sm:col-span-2">
                  <span className="font-bold text-muted-foreground shrink-0">Submission Count:</span>
                  <span className="font-bold text-primary flex items-center gap-1">
                    <Flame size={12} /> {selectedContact?.submissionCount || 1} submissions recorded
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Deduplicated Extra Custom Details (Only non-standard fields) */}
            {(() => {
              const standardKeys = new Set([
                "schoolName", "school",
                "locationName", "location",
                "sport", "sportsInterest",
                "gradeBand", "grade",
                "planType", "plan",
                "studentName", "childName",
                "parentName", "email", "phone",
                "smsConsent", "source"
              ]);
              const extraEntries = Object.entries(selectedContact?.metadata || {}).filter(
                ([key]) => !standardKeys.has(key)
              );

              return (
                <div className="space-y-3">
                  {extraEntries.length > 0 && (
                    <div className="p-4 bg-card border rounded-xl space-y-2.5 shadow-2xs">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Additional Custom Details</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                          {extraEntries.length} custom fields
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-1 text-xs">
                        {extraEntries.map(([key, val]) => {
                          const label = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/[_-]/g, " ")
                            .replace(/^./, (str) => str.toUpperCase())
                            .trim();

                          return (
                            <div key={key} className="flex items-baseline gap-1.5 p-2 rounded-lg bg-accent/15 border">
                              <span className="font-bold text-muted-foreground shrink-0">{label}:</span>
                              <span className="font-semibold text-foreground break-words">
                                {typeof val === "boolean"
                                  ? val ? "Granted (Yes)" : "No"
                                  : val === null || val === undefined || val === ""
                                  ? "None"
                                  : typeof val === "object"
                                  ? JSON.stringify(val)
                                  : String(val)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Collapsible Technical Payload Toggle */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowRawMetadata(!showRawMetadata)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border hover:bg-accent/40 cursor-pointer"
                    >
                      <Code2 size={12} />
                      <span>{showRawMetadata ? "Hide Structured JSON Payload" : "View Structured JSON Payload"}</span>
                      {showRawMetadata ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showRawMetadata && (() => {
                      const structuredPayload = {
                        parentName: selectedContact?.parentName,
                        email: selectedContact?.email,
                        phone: selectedContact?.phone || null,
                        source: selectedContact?.source || "App Registration",
                        assignedList: selectedContact ? getAssignedListName(selectedContact) : "N/A",
                        registrationDetails: {
                          schoolName: selectedContact?.schoolName || selectedContact?.metadata?.schoolName || selectedContact?.metadata?.school || null,
                          locationName: selectedContact?.locationName || selectedContact?.metadata?.locationName || selectedContact?.metadata?.location || null,
                          sport: selectedContact?.sport || selectedContact?.metadata?.sportsInterest || selectedContact?.metadata?.sport || null,
                          gradeBand: selectedContact?.gradeBand || selectedContact?.metadata?.grade || selectedContact?.metadata?.gradeBand || null,
                          planType: getContactPlan(selectedContact) || null,
                          studentName: selectedContact?.studentName || selectedContact?.metadata?.studentName || selectedContact?.metadata?.childName || null
                        },
                        status: selectedContact?.status || "subscribed",
                        consent: {
                          smsConsent: selectedContact?.metadata?.smsConsent === true || selectedContact?.metadata?.smsConsent === "true" || selectedContact?.metadata?.smsConsent === "yes",
                          isEmailConsent: selectedContact?.isEmailConsent ?? true
                        },
                        activity: {
                          submissionCount: selectedContact?.submissionCount || 1,
                          createdAt: selectedContact?.createdAt || null,
                          lastRegisteredAt: selectedContact?.lastRegisteredAt || null
                        },
                        ...(extraEntries.length > 0 ? { customAttributes: Object.fromEntries(extraEntries) } : {})
                      };

                      const jsonString = JSON.stringify(structuredPayload, null, 2);

                      return (
                        <div className="mt-2 p-3 bg-accent/20 border rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 custom-scrollbar relative">
                          <div className="flex items-center justify-between pb-1.5 border-b mb-2">
                            <span className="text-[10px] font-sans font-bold text-muted-foreground uppercase tracking-wider">
                              Standard Structured Contact Payload
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(jsonString);
                                setCopiedContactJson(true);
                                toast.success("Structured JSON copied to clipboard!");
                                setTimeout(() => setCopiedContactJson(false), 2000);
                              }}
                              className="btn-secondary h-6 px-2 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {copiedContactJson ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              <span>{copiedContactJson ? "Copied" : "Copy JSON"}</span>
                            </button>
                          </div>
                          <pre className="text-foreground whitespace-pre-wrap select-all">
                            {jsonString}
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (!selectedContact) return;
                setIsDetailsModalOpen(false);
                handleOpenEdit(selectedContact);
              }}
              className="btn-secondary text-xs h-8 px-3 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={12} /> Edit Details
            </button>
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(false)}
              className="btn-primary text-xs h-8 px-4 font-bold cursor-pointer"
            >
              Close
            </button>
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

      {/* --- MODAL 2: WEBHOOK API DOCUMENTATION MODAL --- */}
      <Dialog open={isWebhookGuideOpen} onOpenChange={setIsWebhookGuideOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border shadow-2xl dark:bg-card">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 bg-card">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                <Code2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-extrabold tracking-tight text-foreground truncate">
                  API Bridge: Unified Marketing Registration Webhook
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Single webhook endpoint for all platforms (Mobile App, Registration Portal, Evening Inquiries & Admin).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
            {/* Endpoint Pill */}
            <div className="p-3 bg-accent/20 border border-border/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  HTTP Webhook Ingestion Endpoint
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                  POST
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="p-2 bg-background dark:bg-card border rounded-lg font-mono text-xs text-foreground flex-1 select-all break-all shadow-2xs">
                  https://api.yauapp.com/api/webhooks/marketing-registration
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("https://api.yauapp.com/api/webhooks/marketing-registration");
                    setCopiedWebhookPayload("url");
                    toast.success("Webhook URL copied to clipboard!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-8 px-2.5 shrink-0 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedWebhookPayload === "url" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedWebhookPayload === "url" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" /> Smart Deduplication
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Same email automatically increments submission count without creating duplicate records.
                </p>
              </div>
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <Sparkles size={12} className="text-purple-500 shrink-0" /> Auto CRM List Routing
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Automatically sorts parents into dedicated School, Location, and App lists in real-time.
                </p>
              </div>
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <Shield size={12} className="text-blue-500 shrink-0" /> Database Protection
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Deletions in external panels leave your CRM contacts and lists 100% intact.
                </p>
              </div>
            </div>

            {/* Sample Payload Schema with Tabs */}
            <div className="border rounded-xl p-3 bg-card space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-accent/40 p-0.5 rounded-lg border text-[11px] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("full")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "full" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Full Schema
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("school")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "school" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🏫 After School
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("location")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "location" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📍 Evening Activities
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("app")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "app" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📱 Mobile App
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const payloads = {
                      full: {
                        parentName: "Sarah Connor",
                        email: "sarah.connor@example.com",
                        phone: "555-123-4567",
                        source: "After School Registration",
                        schoolName: "Brandywine Elementary",
                        locationName: "Brandywine Youth Pavilion",
                        sport: "Track & Field",
                        gradeBand: "4th – 5th Grade",
                        planType: "Seasonal",
                        studentName: "John Connor",
                        status: "active",
                        isEmailConsent: true,
                        metadata: {
                          smsConsent: true,
                          shirtSize: "Youth Small",
                          emergencyContact: "Uncle Bob (302-555-9988)"
                        }
                      },
                      school: {
                        parentName: "Sarah Connor",
                        email: "sarah.connor@example.com",
                        phone: "555-123-4567",
                        source: "After School Registration",
                        schoolName: "Brandywine Elementary",
                        studentName: "John Connor",
                        gradeBand: "4th – 5th Grade",
                        sport: "Track & Field",
                        isEmailConsent: true
                      },
                      location: {
                        parentName: "John Smith",
                        email: "john.smith@example.com",
                        phone: "555-987-6543",
                        source: "Evening Activities",
                        locationName: "Brandywine Youth Pavilion",
                        sport: "Basketball",
                        isEmailConsent: true
                      },
                      app: {
                        parentName: "Sam Wilson",
                        email: "sam.wilson@example.com",
                        phone: "555-333-2222",
                        source: "Mobile App",
                        schoolName: "Allenwood Elementary",
                        isEmailConsent: true
                      }
                    };
                    const payload = JSON.stringify(payloads[webhookPayloadTab], null, 2);
                    navigator.clipboard.writeText(payload);
                    setCopiedWebhookPayload(webhookPayloadTab);
                    toast.success("Payload copied to clipboard!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-6.5 px-2 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-auto"
                >
                  {copiedWebhookPayload === webhookPayloadTab ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copiedWebhookPayload === webhookPayloadTab ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>

              <pre className="p-2.5 bg-accent/20 rounded-lg text-[10px] font-mono overflow-x-auto max-h-44 custom-scrollbar text-foreground leading-relaxed">
{webhookPayloadTab === "full" ? `{
  "parentName": "Sarah Connor",
  "email": "sarah.connor@example.com",
  "phone": "555-123-4567",
  "source": "After School Registration", // "After School Registration" | "Evening Activities" | "Mobile App"
  "schoolName": "Brandywine Elementary",
  "locationName": "Brandywine Youth Pavilion",
  "sport": "Track & Field",
  "gradeBand": "4th – 5th Grade",
  "planType": "Seasonal",
  "studentName": "John Connor",
  "status": "active", // "active" | "opted_out"
  "isEmailConsent": true,
  "metadata": {
    "smsConsent": true,
    "shirtSize": "Youth Small",
    "emergencyContact": "Uncle Bob (302-555-9988)"
  }
}` : webhookPayloadTab === "school" ? `{
  "parentName": "Sarah Connor",
  "email": "sarah.connor@example.com",
  "phone": "555-123-4567",
  "source": "After School Registration",
  "schoolName": "Brandywine Elementary",
  "studentName": "John Connor",
  "gradeBand": "4th – 5th Grade",
  "sport": "Track & Field",
  "isEmailConsent": true
}` : webhookPayloadTab === "location" ? `{
  "parentName": "John Smith",
  "email": "john.smith@example.com",
  "phone": "555-987-6543",
  "source": "Evening Activities",
  "locationName": "Brandywine Youth Pavilion",
  "sport": "Basketball",
  "isEmailConsent": true
}` : `{
  "parentName": "Sam Wilson",
  "email": "sam.wilson@example.com",
  "phone": "555-333-2222",
  "source": "Mobile App",
  "schoolName": "Allenwood Elementary", // optional school association
  "isEmailConsent": true
}`}
              </pre>
            </div>
          </div>

          <DialogFooter className="p-3.5 px-5 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Status: <strong className="text-emerald-600 dark:text-emerald-400">Live &amp; Listening</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsWebhookGuideOpen(false)}
              className="btn-primary text-xs h-8.5 px-4 font-bold cursor-pointer"
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
                    placeholder="e.g. Manual CRM Entry, Mobile, AfterSchool"
                    value={addForm.source}
                    onChange={e => setAddForm(prev => ({ ...prev, source: e.target.value }))}
                    className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>

              {/* Registration Specific Details */}
              <div className="p-3.5 bg-muted/40 border rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-foreground block">
                  Registration & Program Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      School Name (After School / Mobile)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Brandywine Elementary"
                      value={addForm.schoolName}
                      onChange={e => setAddForm(prev => ({ ...prev, schoolName: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Location Name (Evening / Mobile)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bowie"
                      value={addForm.locationName}
                      onChange={e => setAddForm(prev => ({ ...prev, locationName: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Sport Registered
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flag Football, Cheer"
                      value={addForm.sport}
                      onChange={e => setAddForm(prev => ({ ...prev, sport: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Grade Band
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2nd/3rd, K - 5th"
                      value={addForm.gradeBand}
                      onChange={e => setAddForm(prev => ({ ...prev, gradeBand: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Plan Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Monthly, Seasonal"
                      value={addForm.planType}
                      onChange={e => setAddForm(prev => ({ ...prev, planType: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground block">
                    Student / Athlete Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jordan Doe"
                    value={addForm.studentName}
                    onChange={e => setAddForm(prev => ({ ...prev, studentName: e.target.value }))}
                    className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>




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

              {/* Registration Source */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground block">
                  Registration Source
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mobile, Web Portal, AfterSchool, Manual CRM Entry"
                  value={editForm.source}
                  onChange={e => setEditForm(prev => ({ ...prev, source: e.target.value }))}
                  className="h-9 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                />
              </div>

              {/* Registration Specific Details */}
              <div className="p-3.5 bg-muted/40 border rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-foreground block">
                  Registration & Program Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      School Name (After School / Mobile)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Brandywine Elementary"
                      value={editForm.schoolName}
                      onChange={e => setEditForm(prev => ({ ...prev, schoolName: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Location Name (Evening / Mobile)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bowie"
                      value={editForm.locationName}
                      onChange={e => setEditForm(prev => ({ ...prev, locationName: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Sport Registered
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flag Football, Cheer"
                      value={editForm.sport}
                      onChange={e => setEditForm(prev => ({ ...prev, sport: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Grade Band
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2nd/3rd, K - 5th"
                      value={editForm.gradeBand}
                      onChange={e => setEditForm(prev => ({ ...prev, gradeBand: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground block">
                      Plan Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Monthly, Seasonal"
                      value={editForm.planType}
                      onChange={e => setEditForm(prev => ({ ...prev, planType: e.target.value }))}
                      className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground block">
                    Student / Athlete Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jordan Doe"
                    value={editForm.studentName}
                    onChange={e => setEditForm(prev => ({ ...prev, studentName: e.target.value }))}
                    className="h-8.5 input-field text-xs w-full rounded-xl dark:bg-card px-3"
                  />
                </div>
              </div>




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
