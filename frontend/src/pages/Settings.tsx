import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Settings as SettingsIcon,
    Save,
    Plus,
    Trash2,
    Sliders,
    ListRestart,
    BellRing,
    Mail,
    Smartphone,
    MessageSquare,
    UserCheck,
    Shield,
    Users,
    X,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaignStore } from "../store/campaignStore";

interface RepUser {
    _id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    phone?: string;
    isActive?: boolean;
}

interface RepSetting {
    userId: string | RepUser;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsForwardEnabled: boolean;
    emails: string[];
    phone: string;
}

interface GlobalNotificationSettings {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsForwardEnabled: boolean;
    fallbackEmails: string[];
    fallbackPhone: string;
}

interface SettingsData {
    crmPreferences: {
        defaultFollowupDays: number;
    };
    statusLabels: string[];
    notificationSettings?: {
        global: GlobalNotificationSettings;
        repSettings: RepSetting[];
    };
    allUsers?: RepUser[];
}

export default function Settings() {
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [allUsers, setAllUsers] = useState<RepUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { setStatusLabels } = useCampaignStore();

    // Input state for adding new fallback email
    const [newFallbackEmail, setNewFallbackEmail] = useState("");
    // Per-rep new email input buffer: { [userId: string]: string }
    const [repNewEmailInput, setRepNewEmailInput] = useState<Record<string, string>>({});
    // Search query for rep filter
    const [repSearchQuery, setRepSearchQuery] = useState("");

    const loadSettings = async () => {
        try {
            const res = await api.get("/settings");
            const data: SettingsData = res.data;
            const users: RepUser[] = data.allUsers || [];
            setAllUsers(users);

            // Initialize default notificationSettings structure if missing
            const currentRepSettings = data.notificationSettings?.repSettings || [];
            const repSettingsMap = new Map<string, RepSetting>();

            currentRepSettings.forEach((rs) => {
                const uid = typeof rs.userId === "object" ? rs.userId._id : rs.userId;
                if (uid) repSettingsMap.set(String(uid), rs);
            });

            // Ensure every active user has an entry in repSettings
            const mergedRepSettings: RepSetting[] = users.map((user) => {
                const existing = repSettingsMap.get(String(user._id));
                if (existing) {
                    return {
                        userId: user,
                        inAppEnabled: existing.inAppEnabled ?? true,
                        emailEnabled: existing.emailEnabled ?? true,
                        smsForwardEnabled: existing.smsForwardEnabled ?? true,
                        emails: existing.emails && existing.emails.length > 0 ? existing.emails : (user.email ? [user.email] : []),
                        phone: existing.phone || user.phone || ""
                    };
                }
                return {
                    userId: user,
                    inAppEnabled: true,
                    emailEnabled: true,
                    smsForwardEnabled: true,
                    emails: user.email ? [user.email] : [],
                    phone: user.phone || ""
                };
            });

            const initializedSettings: SettingsData = {
                ...data,
                notificationSettings: {
                    global: {
                        inAppEnabled: data.notificationSettings?.global?.inAppEnabled ?? true,
                        emailEnabled: data.notificationSettings?.global?.emailEnabled ?? true,
                        smsForwardEnabled: data.notificationSettings?.global?.smsForwardEnabled ?? true,
                        fallbackEmails: data.notificationSettings?.global?.fallbackEmails || [],
                        fallbackPhone: data.notificationSettings?.global?.fallbackPhone || ""
                    },
                    repSettings: mergedRepSettings
                }
            };

            setSettings(initializedSettings);
            setStatusLabels(data.statusLabels || []);
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
            const globalInApp = settings.notificationSettings?.global.inAppEnabled ?? true;
            const globalEmail = settings.notificationSettings?.global.emailEnabled ?? true;
            const globalSms = settings.notificationSettings?.global.smsForwardEnabled ?? true;

            // Normalize repSettings and force off per-rep switches if global toggle is disabled
            const payload = {
                ...settings,
                notificationSettings: {
                    ...settings.notificationSettings,
                    repSettings: (settings.notificationSettings?.repSettings || []).map((rs) => ({
                        ...rs,
                        userId: typeof rs.userId === "object" ? rs.userId._id : rs.userId,
                        inAppEnabled: globalInApp ? rs.inAppEnabled : false,
                        emailEnabled: globalEmail ? rs.emailEnabled : false,
                        smsForwardEnabled: globalSms ? rs.smsForwardEnabled : false
                    }))
                }
            };

            const res = await api.post("/settings", payload);
            setStatusLabels(settings.statusLabels);
            toast.success("Settings saved successfully");
            await loadSettings();
        } catch (err) {
            console.error(err);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    // --- Status Label Actions ---
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

    // --- Global Notification Actions ---
    const updateGlobalNotif = (field: keyof GlobalNotificationSettings, value: any) => {
        if (!settings || !settings.notificationSettings) return;

        let updatedRepSettings = settings.notificationSettings.repSettings;
        if (field === "inAppEnabled") {
            updatedRepSettings = updatedRepSettings.map((rs) => ({
                ...rs,
                inAppEnabled: !!value
            }));
        } else if (field === "emailEnabled") {
            updatedRepSettings = updatedRepSettings.map((rs) => ({
                ...rs,
                emailEnabled: !!value
            }));
        } else if (field === "smsForwardEnabled") {
            updatedRepSettings = updatedRepSettings.map((rs) => ({
                ...rs,
                smsForwardEnabled: !!value
            }));
        }

        setSettings({
            ...settings,
            notificationSettings: {
                ...settings.notificationSettings,
                global: {
                    ...settings.notificationSettings.global,
                    [field]: value
                },
                repSettings: updatedRepSettings
            }
        });
    };

    const addFallbackEmail = () => {
        if (!newFallbackEmail.trim() || !settings?.notificationSettings) return;
        const email = newFallbackEmail.trim().toLowerCase();
        const current = settings.notificationSettings.global.fallbackEmails || [];
        if (current.includes(email)) {
            toast.error("Email already in fallback list");
            return;
        }
        updateGlobalNotif("fallbackEmails", [...current, email]);
        setNewFallbackEmail("");
    };

    const removeFallbackEmail = (emailToRemove: string) => {
        if (!settings?.notificationSettings) return;
        const current = settings.notificationSettings.global.fallbackEmails || [];
        updateGlobalNotif("fallbackEmails", current.filter((e) => e !== emailToRemove));
    };

    // --- Per-Rep Notification Actions ---
    const updateRepSetting = (userIdStr: string, field: keyof RepSetting, value: any) => {
        if (!settings || !settings.notificationSettings) return;
        const currentList = settings.notificationSettings.repSettings;
        const updatedList = currentList.map((rs) => {
            const uid = typeof rs.userId === "object" ? rs.userId._id : rs.userId;
            if (String(uid) === String(userIdStr)) {
                return { ...rs, [field]: value };
            }
            return rs;
        });

        setSettings({
            ...settings,
            notificationSettings: {
                ...settings.notificationSettings,
                repSettings: updatedList
            }
        });
    };

    const addEmailToRep = (userIdStr: string) => {
        const val = (repNewEmailInput[userIdStr] || "").trim().toLowerCase();
        if (!val) return;
        if (!val.includes("@") || !val.includes(".")) {
            toast.error("Please enter a valid email address");
            return;
        }

        const rep = settings?.notificationSettings?.repSettings.find((rs) => {
            const uid = typeof rs.userId === "object" ? rs.userId._id : rs.userId;
            return String(uid) === String(userIdStr);
        });

        if (rep) {
            const currentEmails = rep.emails || [];
            if (currentEmails.includes(val)) {
                toast.error("Email already added for this rep");
                return;
            }
            updateRepSetting(userIdStr, "emails", [...currentEmails, val]);
            setRepNewEmailInput({ ...repNewEmailInput, [userIdStr]: "" });
        }
    };

    const removeEmailFromRep = (userIdStr: string, emailToRemove: string) => {
        const rep = settings?.notificationSettings?.repSettings.find((rs) => {
            const uid = typeof rs.userId === "object" ? rs.userId._id : rs.userId;
            return String(uid) === String(userIdStr);
        });

        if (rep) {
            const currentEmails = rep.emails || [];
            updateRepSetting(userIdStr, "emails", currentEmails.filter((e) => e !== emailToRemove));
        }
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    Loading settings...
                </div>
            </AppLayout>
        );
    }

    const filteredRepSettings = (settings?.notificationSettings?.repSettings || []).filter((rs) => {
        const userObj: RepUser | null = typeof rs.userId === "object" ? rs.userId : null;
        if (!userObj) return true;
        const q = repSearchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            userObj.name?.toLowerCase().includes(q) ||
            userObj.username?.toLowerCase().includes(q) ||
            userObj.email?.toLowerCase().includes(q) ||
            userObj.role?.toLowerCase().includes(q) ||
            rs.emails.some((e) => e.toLowerCase().includes(q)) ||
            rs.phone.includes(q)
        );
    });

    return (
        <AppLayout>
            <div className="space-y-8 max-w-6xl mx-auto pb-16 px-2 sm:px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Configure global CRM preferences, pipeline stages, and SMS/Email reply routing rules.
                        </p>
                    </div>
                    <Button className="gap-2 shadow-sm font-semibold" onClick={handleSave} disabled={saving}>
                        <Save size={16} />
                        {saving ? "Saving Changes..." : "Save All Changes"}
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="notifications" className="space-y-6">
                    <TabsList className="grid grid-cols-3 max-w-lg bg-muted/60 p-1">
                        <TabsTrigger value="notifications" className="gap-2">
                            <BellRing size={16} />
                            Notifications
                        </TabsTrigger>
                        <TabsTrigger value="ai" className="gap-2">
                            <Sparkles size={16} />
                            AI Intelligence
                        </TabsTrigger>
                        <TabsTrigger value="general" className="gap-2">
                            <Sliders size={16} />
                            General & Statuses
                        </TabsTrigger>
                    </TabsList>

                    {/* ══════════════════ TAB 1: NOTIFICATION SETTINGS ══════════════════ */}
                    <TabsContent value="notifications" className="space-y-8">
                        {/* Global Notification Controls Card */}
                        <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-4">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Shield size={18} className="text-primary" />
                                        Global Notification Channels
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Master on/off toggles and fallback destinations for unassigned leads.
                                    </p>
                                </div>
                                <Badge variant="outline" className="w-fit text-xs px-2.5 py-1 bg-primary/5 text-primary border-primary/20">
                                    System Defaults
                                </Badge>
                            </div>

                            {/* Master Channel Toggles */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-lg border border-border/50 bg-background/50 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <BellRing size={15} className="text-primary" />
                                            In-App Popups
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">Top-right live toasts</p>
                                    </div>
                                    <Switch
                                        checked={settings?.notificationSettings?.global.inAppEnabled ?? true}
                                        onCheckedChange={(val) => updateGlobalNotif("inAppEnabled", val)}
                                    />
                                </div>

                                <div className="p-4 rounded-lg border border-border/50 bg-background/50 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <Mail size={15} className="text-blue-500" />
                                            Email Notifications
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">Gmail API 24/7 alerts</p>
                                    </div>
                                    <Switch
                                        checked={settings?.notificationSettings?.global.emailEnabled ?? true}
                                        onCheckedChange={(val) => updateGlobalNotif("emailEnabled", val)}
                                    />
                                </div>

                                <div className="p-4 rounded-lg border border-border/50 bg-background/50 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <Smartphone size={15} className="text-emerald-500" />
                                            SMS Cell Forwarding
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">Twilio text forwarding</p>
                                    </div>
                                    <Switch
                                        checked={settings?.notificationSettings?.global.smsForwardEnabled ?? true}
                                        onCheckedChange={(val) => updateGlobalNotif("smsForwardEnabled", val)}
                                    />
                                </div>
                            </div>

                            {/* Fallbacks */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                {/* Fallback Emails */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Fallback Notification Emails (Unassigned Leads)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="manager@yau.org"
                                            value={newFallbackEmail}
                                            onChange={(e) => setNewFallbackEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addFallbackEmail();
                                                }
                                            }}
                                            className="text-xs h-9"
                                        />
                                        <Button size="sm" variant="secondary" onClick={addFallbackEmail} className="h-9 gap-1 text-xs">
                                            <Plus size={14} /> Add
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1 min-h-[30px]">
                                        {(settings?.notificationSettings?.global.fallbackEmails || []).map((email) => (
                                            <Badge key={email} variant="secondary" className="text-[11px] gap-1 pr-1 py-0.5">
                                                {email}
                                                <button
                                                    onClick={() => removeFallbackEmail(email)}
                                                    className="hover:bg-destructive/20 hover:text-destructive rounded p-0.5"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </Badge>
                                        ))}
                                        {(settings?.notificationSettings?.global.fallbackEmails || []).length === 0 && (
                                            <span className="text-[11px] text-muted-foreground italic">No fallback emails configured.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Fallback Phone */}
                                <div className="space-y-2">
                                    <Label htmlFor="fallback-phone" className="text-xs font-semibold">Fallback SMS Cell Phone (Unassigned Leads)</Label>
                                    <Input
                                        id="fallback-phone"
                                        placeholder="+18005550199"
                                        value={settings?.notificationSettings?.global.fallbackPhone || ""}
                                        onChange={(e) => updateGlobalNotif("fallbackPhone", e.target.value)}
                                        className="text-xs h-9"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Unassigned inbound replies will be forwarded to this cell number.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Per-Rep Routing Center Card */}
                        <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Users size={18} className="text-primary" />
                                        Sales Rep Notification Routing Rules
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Configure which emails, phones, and channels receive alerts when a lead assigned to each rep replies.
                                    </p>
                                </div>
                                <Input
                                    placeholder="Filter by name, email, or role..."
                                    value={repSearchQuery}
                                    onChange={(e) => setRepSearchQuery(e.target.value)}
                                    className="max-w-xs h-9 text-xs"
                                />
                            </div>

                            {/* Rep Settings List */}
                            <div className="space-y-4">
                                {filteredRepSettings.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        No team members match your filter query.
                                    </div>
                                ) : (
                                    filteredRepSettings.map((repSetting) => {
                                        const userObj: RepUser | null = typeof repSetting.userId === "object" ? repSetting.userId : null;
                                        const userIdStr = userObj?._id || String(repSetting.userId);
                                        const repName = userObj?.name || userObj?.username || "Team Member";
                                        const repRole = userObj?.role || "sales_rep";

                                        return (
                                            <div
                                                key={userIdStr}
                                                className="border border-border/60 rounded-xl p-4 sm:p-5 bg-background/60 hover:bg-background/90 transition-all space-y-4"
                                            >
                                                {/* Top Row: User Identity & Channel Switches */}
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/30 pb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                                            {repName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-sm">{repName}</h3>
                                                                <Badge variant="outline" className="text-[10px] uppercase font-bold py-0">
                                                                    {repRole.replace("_", " ")}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{userObj?.email || "No default email"}</p>
                                                        </div>
                                                    </div>

                                                    {/* Independent Channel Toggles for this Rep */}
                                                    <div className="flex items-center gap-4 sm:gap-6 bg-muted/30 p-2 rounded-lg border border-border/30">
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                id={`inapp-${userIdStr}`}
                                                                checked={
                                                                    (settings?.notificationSettings?.global.inAppEnabled ?? true)
                                                                        ? repSetting.inAppEnabled
                                                                        : false
                                                                }
                                                                disabled={!(settings?.notificationSettings?.global.inAppEnabled ?? true)}
                                                                onCheckedChange={(val) => updateRepSetting(userIdStr, "inAppEnabled", val)}
                                                            />
                                                            <Label
                                                                htmlFor={`inapp-${userIdStr}`}
                                                                className={`text-xs flex items-center gap-1 ${
                                                                    !(settings?.notificationSettings?.global.inAppEnabled ?? true)
                                                                        ? "opacity-50 cursor-not-allowed"
                                                                        : "cursor-pointer"
                                                                }`}
                                                            >
                                                                <BellRing size={13} className="text-primary" /> In-App
                                                            </Label>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                id={`email-${userIdStr}`}
                                                                checked={
                                                                    (settings?.notificationSettings?.global.emailEnabled ?? true)
                                                                        ? repSetting.emailEnabled
                                                                        : false
                                                                }
                                                                disabled={!(settings?.notificationSettings?.global.emailEnabled ?? true)}
                                                                onCheckedChange={(val) => updateRepSetting(userIdStr, "emailEnabled", val)}
                                                            />
                                                            <Label
                                                                htmlFor={`email-${userIdStr}`}
                                                                className={`text-xs flex items-center gap-1 ${
                                                                    !(settings?.notificationSettings?.global.emailEnabled ?? true)
                                                                        ? "opacity-50 cursor-not-allowed"
                                                                        : "cursor-pointer"
                                                                }`}
                                                            >
                                                                <Mail size={13} className="text-blue-500" /> Email
                                                            </Label>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                id={`sms-${userIdStr}`}
                                                                checked={
                                                                    (settings?.notificationSettings?.global.smsForwardEnabled ?? true)
                                                                        ? repSetting.smsForwardEnabled
                                                                        : false
                                                                }
                                                                disabled={!(settings?.notificationSettings?.global.smsForwardEnabled ?? true)}
                                                                onCheckedChange={(val) => updateRepSetting(userIdStr, "smsForwardEnabled", val)}
                                                            />
                                                            <Label
                                                                htmlFor={`sms-${userIdStr}`}
                                                                className={`text-xs flex items-center gap-1 ${
                                                                    !(settings?.notificationSettings?.global.smsForwardEnabled ?? true)
                                                                        ? "opacity-50 cursor-not-allowed"
                                                                        : "cursor-pointer"
                                                                }`}
                                                            >
                                                                <Smartphone size={13} className="text-emerald-500" /> SMS Forward
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Multi-Email Recipients & Phone Forward Destination */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                                    {/* Multi-Email Management */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-medium flex items-center gap-1">
                                                            <Mail size={13} className="text-blue-500" />
                                                            Email Recipients (Multiple Emails Supported)
                                                        </Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                placeholder="Add email recipient..."
                                                                value={repNewEmailInput[userIdStr] || ""}
                                                                onChange={(e) =>
                                                                    setRepNewEmailInput({
                                                                        ...repNewEmailInput,
                                                                        [userIdStr]: e.target.value
                                                                    })
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        addEmailToRep(userIdStr);
                                                                    }
                                                                }}
                                                                className="text-xs h-8"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => addEmailToRep(userIdStr)}
                                                                className="h-8 text-xs gap-1"
                                                            >
                                                                <Plus size={13} /> Add
                                                            </Button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {(repSetting.emails || []).map((email) => (
                                                                <Badge key={email} variant="secondary" className="text-[11px] gap-1 pr-1 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                                    {email}
                                                                    <button
                                                                        onClick={() => removeEmailFromRep(userIdStr, email)}
                                                                        className="hover:bg-destructive/20 hover:text-destructive rounded p-0.5"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                            {(repSetting.emails || []).length === 0 && (
                                                                <span className="text-[11px] text-muted-foreground italic">No emails configured. Rep will not receive email alerts.</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* SMS Forward Phone */}
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor={`phone-${userIdStr}`} className="text-xs font-medium flex items-center gap-1">
                                                            <Smartphone size={13} className="text-emerald-500" />
                                                            SMS Forward Cell Phone
                                                        </Label>
                                                        <Input
                                                            id={`phone-${userIdStr}`}
                                                            placeholder="+19896233745 or 9896233745"
                                                            value={repSetting.phone || ""}
                                                            onChange={(e) => updateRepSetting(userIdStr, "phone", e.target.value)}
                                                            className="text-xs h-8"
                                                        />
                                                        <p className="text-[10px] text-muted-foreground italic">
                                                            Inbound SMS replies from leads assigned to {repName} will be forwarded here.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════════ TAB 2: AI INTELLIGENCE LAYER SETTINGS ══════════════════ */}
                    <TabsContent value="ai" className="space-y-8">
                        <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Claude AI Intelligence Layer Configuration</h2>
                                    <p className="text-xs text-muted-foreground">Manage automated SMS follow-ups, AI two-way reply rules, and stalled lead threshold days.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Auto SMS Settings */}
                                <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-4">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <MessageSquare size={16} className="text-blue-500" />
                                        Automated Personalized SMS
                                    </h3>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-xs font-semibold">Enable Initial Form SMS</Label>
                                            <p className="text-[11px] text-muted-foreground">Automatically write personalized SMS on form submission</p>
                                        </div>
                                        <Switch
                                            checked={settings?.aiSettings?.autoSmsEnabled ?? true}
                                            onCheckedChange={(checked) => setSettings(s => s ? { ...s, aiSettings: { ...s.aiSettings, autoSmsEnabled: checked } } : null)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <Label className="text-xs font-semibold">Enable Two-Way AI Auto-Reply</Label>
                                            <p className="text-[11px] text-muted-foreground">Auto-respond to simple FAQ SMS replies immediately</p>
                                        </div>
                                        <Switch
                                            checked={settings?.aiSettings?.autoReplyEnabled ?? true}
                                            onCheckedChange={(checked) => setSettings(s => s ? { ...s, aiSettings: { ...s.aiSettings, autoReplyEnabled: checked } } : null)}
                                        />
                                    </div>
                                </div>

                                {/* Stalled Lead Thresholds */}
                                <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-4">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <Shield size={16} className="text-amber-500" />
                                        Stalled Lead Inactivity Thresholds (Days)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-[11px] font-semibold text-red-500">🔴 Hot Leads</Label>
                                            <Input
                                                type="number"
                                                className="h-8 text-xs mt-1"
                                                value={settings?.aiSettings?.stalledThresholds?.default?.Hot ?? 3}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSettings(s => s ? {
                                                        ...s,
                                                        aiSettings: {
                                                            ...s.aiSettings,
                                                            stalledThresholds: {
                                                                ...(s.aiSettings?.stalledThresholds || {}),
                                                                default: { ...(s.aiSettings?.stalledThresholds?.default || {}), Hot: val }
                                                            }
                                                        }
                                                    } : null);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-semibold text-amber-500">🟡 Warm Leads</Label>
                                            <Input
                                                type="number"
                                                className="h-8 text-xs mt-1"
                                                value={settings?.aiSettings?.stalledThresholds?.default?.Warm ?? 5}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSettings(s => s ? {
                                                        ...s,
                                                        aiSettings: {
                                                            ...s.aiSettings,
                                                            stalledThresholds: {
                                                                ...(s.aiSettings?.stalledThresholds || {}),
                                                                default: { ...(s.aiSettings?.stalledThresholds?.default || {}), Warm: val }
                                                            }
                                                        }
                                                    } : null);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] font-semibold text-blue-500">🔵 Cold Leads</Label>
                                            <Input
                                                type="number"
                                                className="h-8 text-xs mt-1"
                                                value={settings?.aiSettings?.stalledThresholds?.default?.Cold ?? 7}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSettings(s => s ? {
                                                        ...s,
                                                        aiSettings: {
                                                            ...s.aiSettings,
                                                            stalledThresholds: {
                                                                ...(s.aiSettings?.stalledThresholds || {}),
                                                                default: { ...(s.aiSettings?.stalledThresholds?.default || {}), Cold: val }
                                                            }
                                                        }
                                                    } : null);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════════ TAB 3: GENERAL CRM PREFERENCES & PIPELINE ══════════════════ */}
                    <TabsContent value="general" className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* CRM Preferences */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Sliders size={20} className="text-primary" />
                                    <h2 className="text-xl font-bold">CRM Preferences</h2>
                                </div>
                                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="followup-days" className="text-sm font-medium">
                                            Default Follow-up Interval
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="followup-days"
                                                name="followup-days"
                                                type="number"
                                                value={settings?.crmPreferences.defaultFollowupDays}
                                                onChange={(e) =>
                                                    setSettings({
                                                        ...settings!,
                                                        crmPreferences: {
                                                            ...settings!.crmPreferences,
                                                            defaultFollowupDays: parseInt(e.target.value) || 0
                                                        }
                                                    })
                                                }
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
                                                    id={`status-label-${idx}`}
                                                    name={`status-label-${idx}`}
                                                    aria-label="Lead Status Label"
                                                    value={status}
                                                    onChange={(e) => updateStatus(idx, e.target.value)}
                                                    className="flex-1 border-sidebar-border"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeStatus(idx)}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2 border-dashed"
                                            onClick={addStatus}
                                        >
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
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
