import React, { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  Hash
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
}

export default function EALeads() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);

  // Leads state
  const [leads, setLeads] = useState<EALead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedLead, setSelectedLead] = useState<EALead | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
  }, []);

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

  // Open View Dialog
  const handleOpenView = (lead: EALead) => {
    setSelectedLead(lead);
    setViewDialogOpen(true);
  };

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
        </div>

        {/* Search Bar */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              id="search-ea-leads"
              name="search-ea-leads"
              placeholder="Search by name, email, phone, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border text-foreground"
            />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-b border-border">
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead._id} className="hover:bg-accent/40 border-b border-border">
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-accent hover:text-foreground"
                            onClick={() => handleOpenView(lead)}
                            title="View Lead Record"
                          >
                            <Eye size={14} />
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
          )}
        </div>
      </div>

      {/* View Lead Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles size={12} className="text-primary" />
              </span>
              EA Lead Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Hash size={14} /> Name:
                </span>
                <span className="col-span-2 font-bold text-foreground">{selectedLead.name}</span>
              </div>
              
              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mail size={14} /> Email:
                </span>
                <span className="col-span-2 font-medium text-foreground select-all">{selectedLead.email}</span>
              </div>

              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Phone size={14} /> Phone:
                </span>
                <span className="col-span-2 font-medium text-foreground select-all">{selectedLead.phone}</span>
              </div>

              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Layers size={14} /> Source:
                </span>
                <span className="col-span-2 font-semibold">
                  <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {selectedLead.source}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={14} /> Submitted:
                </span>
                <span className="col-span-2 font-semibold text-foreground">
                  {formatDateDisplay(selectedLead.dateSubmitted)}
                </span>
              </div>

              <div className="grid grid-cols-3 items-start gap-4 border-b border-border/50 pb-2.5">
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
          )}

          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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

      {/* Delete Lead Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
              <AlertCircle size={20} />
              Confirm Delete
            </DialogTitle>
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
