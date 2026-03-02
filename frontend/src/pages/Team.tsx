import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Users, Shield, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

interface User {
    _id: string;
    username: string;
    name?: string;
    email?: string;
    role: string;
    createdAt: string;
}

export default function Team() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = async () => {
        try {
            const res = await api.get("/team");
            setUsers(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load team members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    return (
        <AppLayout>
            <div className="space-y-6 max-w-5xl mx-auto pb-12">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Team Management</h1>
                    <p className="text-muted-foreground">Internal CRM users and access roles.</p>
                </div>

                <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User / Username</TableHead>
                                <TableHead>Email Address</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                        Loading team members...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                        No team members found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                                                    {(user.name || user.username).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-white">{user.name || "N/A"}</p>
                                                    <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Mail size={14} />
                                                {user.email || "No email provided"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Shield size={14} className={user.role === 'admin' ? 'text-primary' : 'text-muted-foreground'} />
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${user.role === 'admin'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-secondary text-secondary-foreground border-sidebar-border'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <Calendar size={14} />
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
