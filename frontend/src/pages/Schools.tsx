import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Search, Filter, Plus, School as SchoolIcon, Calculator, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface School {
  _id: string;
  name: string;
  status: string;
  telephone?: string;
  principal_name?: string;
  lastContactedDate?: string;
  campaign?: {
    _id: string;
    name: string;
  };
}

export default function Schools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (status !== "all") params.status = status;

      const res = await api.get("/schools", { params });
      // The new backend response is { data: [...], pagination: { ... } }
      setSchools(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load schools");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSchools();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status, page]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Schools / Leads</h1>
            <p className="text-muted-foreground">Master database of all schools across all campaigns.</p>
          </div>
          <Link to="/schools/create">
            <Button className="gap-2">
              <Plus size={16} />
              Add School
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search schools, contacts, emails..."
              className="pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="Not Contacted">Not Contacted</option>
            <option value="Spoke to Office">Spoke to Office</option>
            <option value="Meeting Scheduled">Meeting Scheduled</option>
            <option value="Left Voicemail">Left Voicemail</option>
            <option value="Signed">Signed</option>
            <option value="Lost">Lost</option>
          </select>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Loading schools...
                  </TableCell>
                </TableRow>
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No schools found.
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school) => (
                  <TableRow key={school._id}>
                    <TableCell className="font-medium">
                      <Link to={`/school/${school._id}`} className="hover:text-primary transition-colors">
                        {school.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border">
                        {school.campaign?.name || "Unassigned"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${school.status === 'Signed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        school.status === 'Meeting Scheduled' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          school.status === 'Not Contacted' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' :
                            'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                        {school.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{school.principal_name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{school.telephone || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {school.lastContactedDate || "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/school/${school._id}`}>
                        <Button variant="ghost" size="sm"><Eye size={16} /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
