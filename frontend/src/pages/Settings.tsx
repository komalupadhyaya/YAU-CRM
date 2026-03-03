import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Settings as SettingsIcon, Save, Plus, Trash2, Sliders, ListRestart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsData {
    crmPreferences: {
        defaultFollowupDays: number;
    };
    statusLabels: string[];
}

export default function Settings() {
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        try {
            const res = await api.get("/settings");
            setSettings(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await api.post("/settings", settings);
            toast.success("Settings saved successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const addStatus = () => {
        if (!settings) return;
        setSettings({
            ...settings,
            statusLabels: [...settings.statusLabels, "New Status"]
        });
    };

    const removeStatus = (index: number) => {
        if (!settings) return;
        const newStatuses = [...settings.statusLabels];
        newStatuses.splice(index, 1);
        setSettings({ ...settings, statusLabels: newStatuses });
    };

    const updateStatus = (index: number, val: string) => {
        if (!settings) return;
        const newStatuses = [...settings.statusLabels];
        newStatuses[index] = val;
        setSettings({ ...settings, statusLabels: newStatuses });
    };

    if (loading) return <AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading settings...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 max-w-4xl mx-auto pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className="text-muted-foreground">Configure your global CRM preferences and status workflows.</p>
                    </div>
                    <Button className="gap-2" onClick={handleSave} disabled={saving}>
                        <Save size={16} />
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* CRM Preferences */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Sliders size={20} className="text-primary" />
                            <h2 className="text-xl font-bold">CRM Preferences</h2>
                        </div>
                        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="followup-days" className="text-sm font-medium text-white">Default Follow-up Interval</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="followup-days"
                                        type="number"
                                        value={settings?.crmPreferences.defaultFollowupDays}
                                        onChange={(e) => setSettings({
                                            ...settings!,
                                            crmPreferences: { ...settings!.crmPreferences, defaultFollowupDays: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-24 border-sidebar-border"
                                    />
                                    <span className="text-sm text-muted-foreground">days</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    Suggested interval for automatic follow-up reminders.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Status Labels */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <ListRestart size={20} className="text-primary" />
                            <h2 className="text-xl font-bold">Lead Status Labels</h2>
                        </div>
                        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                            <div className="space-y-3">
                                {settings?.statusLabels.map((status, idx) => (
                                    <div key={idx} className="flex items-center gap-2 group">
                                        <Input
                                            value={status}
                                            onChange={(e) => updateStatus(idx, e.target.value)}
                                            className="flex-1 border-sidebar-border"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => removeStatus(idx)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={addStatus}>
                                    <Plus size={16} />
                                    Add Status
                                </Button>
                                <p className="text-[10px] text-muted-foreground italic">
                                    These labels define your sales pipeline stages across all campaigns.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
