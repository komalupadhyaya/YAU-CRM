import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { CheckSquare, Plus, Trash2, CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Task {
    _id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    createdAt: string;
    completedAt?: string;
}

export default function Tasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadTasks = async () => {
        try {
            const res = await api.get("/tasks");
            setTasks(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load tasks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await api.post("/tasks", { title, description });
            setTasks([res.data, ...tasks]);
            setTitle("");
            setDescription("");
            toast.success("Task created");
        } catch (err) {
            toast.error("Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompleteTask = async (id: string) => {
        try {
            const res = await api.put(`/tasks/${id}/complete`);
            setTasks(tasks.map(t => t._id === id ? res.data : t));
            toast.success("Task marked as completed");
        } catch (err) {
            toast.error("Failed to update task");
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            await api.delete(`/tasks/${id}`);
            setTasks(tasks.filter(t => t._id !== id));
            toast.success("Task deleted");
        } catch (err) {
            toast.error("Failed to delete task");
        }
    };

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    if (loading) return <AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading tasks...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 max-w-5xl mx-auto pb-12">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <CheckSquare className="text-primary" />
                        Internal Tasks
                    </h1>
                    <p className="text-muted-foreground">Manage your personal CRM tasks and reminders.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Task Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-card border rounded-xl p-6 shadow-sm sticky top-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Plus size={18} className="text-primary" />
                                New Task
                            </h2>
                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Task title..."
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                        className="border-sidebar-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Textarea
                                        placeholder="Description (optional)..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="min-h-[100px] border-sidebar-border"
                                    />
                                </div>
                                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                                    {isSubmitting ? "Adding..." : "Add Task"}
                                </Button>
                            </form>
                        </div>
                    </div>

                    {/* Task Lists */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Pending Section */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Clock size={18} className="text-orange-500" />
                                Pending Tasks
                                <span className="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/20">
                                    {pendingTasks.length}
                                </span>
                            </h2>
                            <div className="space-y-3">
                                {pendingTasks.length === 0 ? (
                                    <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30 text-muted-foreground text-sm">
                                        No pending tasks. Great job!
                                    </div>
                                ) : (
                                    pendingTasks.map(task => (
                                        <div key={task._id} className="bg-card border border-sidebar-border rounded-lg p-4 group hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-white">{task.title}</h3>
                                                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                                                    <div className="flex items-center gap-3 mt-3">
                                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <Calendar size={10} />
                                                            {new Date(task.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-1.5 text-xs border-green-500/20 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                                                        onClick={() => handleCompleteTask(task._id)}
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Complete
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeleteTask(task._id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Completed Section */}
                        <div className="space-y-4 opacity-70">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-green-500" />
                                Completed
                                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">
                                    {completedTasks.length}
                                </span>
                            </h2>
                            <div className="space-y-3">
                                {completedTasks.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground text-xs italic">
                                        Successfully completed tasks will appear here.
                                    </div>
                                ) : (
                                    completedTasks.map(task => (
                                        <div key={task._id} className="bg-card/50 border border-sidebar-border/50 rounded-lg p-4 grayscale group">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-muted-foreground line-through decoration-muted-foreground/50">{task.title}</h3>
                                                    {task.description && <p className="text-xs text-muted-foreground/60 mt-1">{task.description}</p>}
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <CheckCircle2 size={10} />
                                                            Completed on {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteTask(task._id)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
