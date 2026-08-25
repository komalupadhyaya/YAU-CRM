import { useEffect, useState } from "react";
import { 
    Bot, 
    RefreshCw, 
    Save, 
    Sparkles, 
    Phone, 
    CheckCircle2, 
    AlertTriangle, 
    Plus, 
    Trash2, 
    MapPin, 
    Trophy, 
    DollarSign, 
    HelpCircle, 
    MessageSquare, 
    PhoneForwarded, 
    FileText, 
    Info, 
    Copy, 
    Check 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    getKnowledgeBase, 
    updateKnowledgeBase, 
    syncToRetell, 
    getRetellAgentStatus,
    RetellKnowledgeBaseData,
    AgentStatusResponse 
} from "../api/retell.api";

export default function RetellVoiceAgent() {
    const [kb, setKb] = useState<RetellKnowledgeBaseData | null>(null);
    const [compiledPrompt, setCompiledPrompt] = useState<string>("");
    const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    // Active subtab
    const [activeTab, setActiveTab] = useState("personality");

    const loadData = async () => {
        try {
            setLoading(true);
            const [kbRes, statusRes] = await Promise.allSettled([
                getKnowledgeBase(),
                getRetellAgentStatus()
            ]);

            if (kbRes.status === "fulfilled") {
                setKb(kbRes.value.knowledgeBase);
                setCompiledPrompt(kbRes.value.compiledPrompt);
            }
            if (statusRes.status === "fulfilled") {
                setAgentStatus(statusRes.value);
            }
        } catch (err: any) {
            console.error("Failed to load Retell Voice Agent data:", err);
            toast.error("Failed to load Knowledge Base settings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async (showToast = true) => {
        if (!kb) return;
        try {
            setSaving(true);
            const res = await updateKnowledgeBase(kb);
            setKb(res.knowledgeBase);
            setCompiledPrompt(res.compiledPrompt);
            if (showToast) {
                toast.success("Knowledge Base saved successfully!");
            }
            return true;
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to save Knowledge Base");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            // Save first to ensure latest DB changes are synced
            const saved = await handleSave(false);
            if (!saved) return;

            const res = await syncToRetell();
            toast.success(res.message || "Successfully synced to Retell AI Voice Agent!");
            // Refresh status
            const status = await getRetellAgentStatus();
            setAgentStatus(status);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || err.message || "Failed to sync to Retell AI");
        } finally {
            setSyncing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPrompt(true);
        toast.success("Prompt copied to clipboard!");
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    // Helper modifiers
    const handleArrayChange = (field: "personalityTraits" | "toneRules" | "differentiators" | "humanTransferTriggers", index: number, value: string) => {
        if (!kb) return;
        const list = [...kb[field]];
        list[index] = value;
        setKb({ ...kb, [field]: list });
    };

    const handleArrayAdd = (field: "personalityTraits" | "toneRules" | "differentiators" | "humanTransferTriggers", defaultValue = "") => {
        if (!kb) return;
        setKb({ ...kb, [field]: [...kb[field], defaultValue] });
    };

    const handleArrayRemove = (field: "personalityTraits" | "toneRules" | "differentiators" | "humanTransferTriggers", index: number) => {
        if (!kb) return;
        const list = kb[field].filter((_, i) => i !== index);
        setKb({ ...kb, [field]: list });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Loading YAU AI Voice Agent & Knowledge Base...</p>
            </div>
        );
    }

    if (!kb) {
        return (
            <div className="p-8 text-center bg-card rounded-2xl border border-border">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold">Failed to load Knowledge Base</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Could not retrieve settings from backend database.</p>
                <Button onClick={loadData} variant="outline">Retry Loading</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Top Status & Action Header */}
            <div className="bg-gradient-to-r from-card via-card to-primary/5 border border-border/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Bot className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-foreground">
                                Retell AI Voice Agent & Knowledge Base
                            </h2>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Number Active: {kb.phoneNumber || "+18886879139"}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Manage the universal knowledge base, tone, practice schedules, pricing, and FAQs for your live voice agent.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 self-start lg:self-center">
                        <Button
                            variant="outline"
                            onClick={() => handleSave(true)}
                            disabled={saving || syncing}
                            className="h-10 px-4 gap-2 font-medium"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : "Save Draft"}
                        </Button>
                        <Button
                            onClick={handleSync}
                            disabled={saving || syncing}
                            className="h-10 px-5 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-500/20"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                            {syncing ? "Syncing..." : "Save & Sync to Retell AI"}
                        </Button>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 mt-5 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary" />
                        <span>Inbound Hotline: <strong className="text-foreground">{kb.phoneNumber}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Voice Persona: <strong className="text-foreground">{kb.agentName || "Cimo"} (Youth Concierge)</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>
                            Last Synced: <strong className="text-foreground">{kb.lastSyncedAt ? new Date(kb.lastSyncedAt).toLocaleString() : "Synced"}</strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* Knowledge Base Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 md:grid-cols-7 h-auto p-1 bg-muted/60 rounded-xl gap-1 border border-border/50">
                    <TabsTrigger value="personality" className="gap-1.5 text-xs py-2">
                        <Bot className="w-3.5 h-3.5" /> Personality
                    </TabsTrigger>
                    <TabsTrigger value="programs" className="gap-1.5 text-xs py-2">
                        <Trophy className="w-3.5 h-3.5" /> Sports
                    </TabsTrigger>
                    <TabsTrigger value="locations" className="gap-1.5 text-xs py-2">
                        <MapPin className="w-3.5 h-3.5" /> Locations
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="gap-1.5 text-xs py-2">
                        <DollarSign className="w-3.5 h-3.5" /> Pricing
                    </TabsTrigger>
                    <TabsTrigger value="scripts" className="gap-1.5 text-xs py-2">
                        <MessageSquare className="w-3.5 h-3.5" /> Scripts
                    </TabsTrigger>
                    <TabsTrigger value="faqs" className="gap-1.5 text-xs py-2">
                        <HelpCircle className="w-3.5 h-3.5" /> FAQs & Objections
                    </TabsTrigger>
                    <TabsTrigger value="transfer" className="gap-1.5 text-xs py-2">
                        <PhoneForwarded className="w-3.5 h-3.5" /> Transfers
                    </TabsTrigger>
                </TabsList>

                {/* 1. PERSONALITY & TONE TAB */}
                <TabsContent value="personality" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Bot className="w-5 h-5 text-primary" /> AI Identity & Welcome Greeting
                            </CardTitle>
                            <CardDescription>
                                Defines how the AI opens every call and how it identifies itself to callers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Agent Persona Name</Label>
                                    <Input 
                                        value={kb.agentName} 
                                        onChange={e => setKb({ ...kb, agentName: e.target.value })}
                                        placeholder="e.g. Cimo" 
                                    />
                                </div>
                                <div>
                                    <Label>Inbound Phone Number</Label>
                                    <Input 
                                        value={kb.phoneNumber} 
                                        onChange={e => setKb({ ...kb, phoneNumber: e.target.value })}
                                        placeholder="+18886879139" 
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Welcome / Inbound Greeting Message</Label>
                                <Textarea 
                                    value={kb.welcomeMessage}
                                    onChange={e => setKb({ ...kb, welcomeMessage: e.target.value })}
                                    rows={2}
                                    className="resize-none font-medium"
                                />
                                <p className="text-xs text-muted-foreground mt-1">This is the first sentence spoken when a parent calls.</p>
                            </div>

                            <div>
                                <Label>The Golden Rule</Label>
                                <Textarea 
                                    value={kb.goldenRule}
                                    onChange={e => setKb({ ...kb, goldenRule: e.target.value })}
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Personality Traits & Tone Rules */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Core Personality Traits</CardTitle>
                                    <Button size="sm" variant="ghost" onClick={() => handleArrayAdd("personalityTraits", "New trait")}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Trait
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {kb.personalityTraits.map((trait, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input 
                                            value={trait} 
                                            onChange={e => handleArrayChange("personalityTraits", i, e.target.value)} 
                                            className="text-xs h-9"
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleArrayRemove("personalityTraits", i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Tone & Conversational Rules</CardTitle>
                                    <Button size="sm" variant="ghost" onClick={() => handleArrayAdd("toneRules", "New tone rule")}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {kb.toneRules.map((rule, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input 
                                            value={rule} 
                                            onChange={e => handleArrayChange("toneRules", i, e.target.value)} 
                                            className="text-xs h-9"
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleArrayRemove("toneRules", i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 2. SPORTS PROGRAMS TAB */}
                <TabsContent value="programs" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-amber-500" /> Sports Programs (K through 8th Grade)
                                    </CardTitle>
                                    <CardDescription>
                                        Teams are strictly organized by Grade Level, not age.
                                    </CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    onClick={() => setKb({
                                        ...kb,
                                        sportsPrograms: [
                                            ...kb.sportsPrograms,
                                            { name: "New Sport", emoji: "🏅", grades: "K – 8th Grade", description: "Program highlights..." }
                                        ]
                                    })}
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add Sport
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {kb.sportsPrograms.map((sport, i) => (
                                <div key={i} className="p-4 bg-muted/40 rounded-xl border border-border/60 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Input 
                                                value={sport.emoji} 
                                                onChange={e => {
                                                    const list = [...kb.sportsPrograms];
                                                    list[i].emoji = e.target.value;
                                                    setKb({ ...kb, sportsPrograms: list });
                                                }}
                                                className="w-14 text-center text-lg h-9"
                                            />
                                            <Input 
                                                value={sport.name} 
                                                onChange={e => {
                                                    const list = [...kb.sportsPrograms];
                                                    list[i].name = e.target.value;
                                                    setKb({ ...kb, sportsPrograms: list });
                                                }}
                                                placeholder="Sport Name"
                                                className="font-bold h-9 flex-1"
                                            />
                                            <Input 
                                                value={sport.grades} 
                                                onChange={e => {
                                                    const list = [...kb.sportsPrograms];
                                                    list[i].grades = e.target.value;
                                                    setKb({ ...kb, sportsPrograms: list });
                                                }}
                                                placeholder="Grades (e.g. K – 8th Grade)"
                                                className="w-40 h-9 text-xs"
                                            />
                                        </div>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="text-muted-foreground hover:text-destructive h-9 w-9"
                                            onClick={() => {
                                                const list = kb.sportsPrograms.filter((_, idx) => idx !== i);
                                                setKb({ ...kb, sportsPrograms: list });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">What Kids Love About It / Key Benefits</Label>
                                        <Input 
                                            value={sport.description} 
                                            onChange={e => {
                                                const list = [...kb.sportsPrograms];
                                                list[i].description = e.target.value;
                                                setKb({ ...kb, sportsPrograms: list });
                                            }}
                                            placeholder="Description..."
                                            className="text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. LOCATIONS & SCHEDULES TAB */}
                <TabsContent value="locations" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-emerald-500" /> Evening Activity Locations & Practice Days
                                    </CardTitle>
                                    <CardDescription>
                                        Current DC metro practice hubs. All evening practices run from 6:00 PM to 7:30 PM.
                                    </CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    onClick={() => setKb({
                                        ...kb,
                                        locations: [
                                            ...kb.locations,
                                            { name: "New Location", school: "School Name", practiceDays: "Days", practiceTime: "6:00 PM – 7:30 PM" }
                                        ]
                                    })}
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add Location
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {kb.locations.map((loc, i) => (
                                <div key={i} className="p-4 bg-muted/40 rounded-xl border border-border/60 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div>
                                        <Label className="text-xs">Location Name</Label>
                                        <Input 
                                            value={loc.name} 
                                            onChange={e => {
                                                const list = [...kb.locations];
                                                list[i].name = e.target.value;
                                                setKb({ ...kb, locations: list });
                                            }}
                                            className="h-9 text-xs font-semibold mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Facility / School</Label>
                                        <Input 
                                            value={loc.school} 
                                            onChange={e => {
                                                const list = [...kb.locations];
                                                list[i].school = e.target.value;
                                                setKb({ ...kb, locations: list });
                                            }}
                                            className="h-9 text-xs mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Practice Days</Label>
                                        <Input 
                                            value={loc.practiceDays} 
                                            onChange={e => {
                                                const list = [...kb.locations];
                                                list[i].practiceDays = e.target.value;
                                                setKb({ ...kb, locations: list });
                                            }}
                                            className="h-9 text-xs mt-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <Label className="text-xs">Time</Label>
                                            <Input 
                                                value={loc.practiceTime} 
                                                onChange={e => {
                                                    const list = [...kb.locations];
                                                    list[i].practiceTime = e.target.value;
                                                    setKb({ ...kb, locations: list });
                                                }}
                                                className="h-9 text-xs mt-1"
                                            />
                                        </div>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
                                            onClick={() => {
                                                const list = kb.locations.filter((_, idx) => idx !== i);
                                                setKb({ ...kb, locations: list });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                                <div>
                                    <Label>Weekend Game Schedule Script</Label>
                                    <Textarea 
                                        value={kb.gameSchedule}
                                        onChange={e => setKb({ ...kb, gameSchedule: e.target.value })}
                                        rows={2}
                                        className="text-xs mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Out-of-Area Caller Script</Label>
                                    <Textarea 
                                        value={kb.outOfAreaScript}
                                        onChange={e => setKb({ ...kb, outOfAreaScript: e.target.value })}
                                        rows={2}
                                        className="text-xs mt-1"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 4. PRICING & REFUND POLICY TAB */}
                <TabsContent value="pricing" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-500" /> Pricing Plans & Refund Policy
                            </CardTitle>
                            <CardDescription>
                                Lead with the $50/month Monthly Membership as the best value for families.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Monthly Membership */}
                                <div className="p-5 bg-gradient-to-b from-blue-500/5 to-transparent rounded-2xl border border-blue-500/20 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Badge className="bg-blue-600 text-white font-bold">Recommended</Badge>
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">${kb.monthlyPrice}/mo</span>
                                    </div>
                                    <h4 className="font-bold text-foreground">Monthly Membership</h4>
                                    <div>
                                        <Label className="text-xs">Price ($)</Label>
                                        <Input 
                                            type="number"
                                            value={kb.monthlyPrice}
                                            onChange={e => setKb({ ...kb, monthlyPrice: Number(e.target.value) })}
                                            className="h-9 font-bold mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">What is Included</Label>
                                        <Textarea 
                                            value={kb.monthlyIncludes}
                                            onChange={e => setKb({ ...kb, monthlyIncludes: e.target.value })}
                                            rows={3}
                                            className="text-xs mt-1"
                                        />
                                    </div>
                                </div>

                                {/* Seasonal Fee */}
                                <div className="p-5 bg-muted/40 rounded-2xl border border-border/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline">Single Sport</Badge>
                                        <span className="text-2xl font-black text-foreground">${kb.seasonalPrice}/season</span>
                                    </div>
                                    <h4 className="font-bold text-foreground">Seasonal Fee</h4>
                                    <div>
                                        <Label className="text-xs">Price ($)</Label>
                                        <Input 
                                            type="number"
                                            value={kb.seasonalPrice}
                                            onChange={e => setKb({ ...kb, seasonalPrice: Number(e.target.value) })}
                                            className="h-9 font-bold mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">What is Included</Label>
                                        <Textarea 
                                            value={kb.seasonalIncludes}
                                            onChange={e => setKb({ ...kb, seasonalIncludes: e.target.value })}
                                            rows={3}
                                            className="text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Strict Refund Policy */}
                            <div className="p-5 bg-amber-500/5 rounded-2xl border border-amber-500/30 space-y-3">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                                    <AlertTriangle className="w-5 h-5" /> Strict No-Refund Policy Rule
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    The AI must NEVER promise a refund under any circumstance. Always offer to connect to a human team member for special reviews.
                                </p>
                                <Textarea 
                                    value={kb.refundPolicy}
                                    onChange={e => setKb({ ...kb, refundPolicy: e.target.value })}
                                    rows={2}
                                    className="text-xs bg-background"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 5. CALL SCRIPTS TAB */}
                <TabsContent value="scripts" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-primary" /> Conversation Scripts & Openings
                            </CardTitle>
                            <CardDescription>
                                Natural guidance templates used across different call scenarios.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Inbound Call Opening</Label>
                                <Textarea 
                                    value={kb.inboundOpeningScript}
                                    onChange={e => setKb({ ...kb, inboundOpeningScript: e.target.value })}
                                    rows={2}
                                    className="text-xs mt-1"
                                />
                            </div>
                            <div>
                                <Label>Hesitant / Unsure Caller Reassurance</Label>
                                <Textarea 
                                    value={kb.hesitantCallerScript}
                                    onChange={e => setKb({ ...kb, hesitantCallerScript: e.target.value })}
                                    rows={2}
                                    className="text-xs mt-1"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Standard Positive Close</Label>
                                    <Textarea 
                                        value={kb.positiveCloseScript}
                                        onChange={e => setKb({ ...kb, positiveCloseScript: e.target.value })}
                                        rows={3}
                                        className="text-xs mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Close When Parent Needs to Think About It</Label>
                                    <Textarea 
                                        value={kb.thinkAboutItCloseScript}
                                        onChange={e => setKb({ ...kb, thinkAboutItCloseScript: e.target.value })}
                                        rows={3}
                                        className="text-xs mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Leaving a Voicemail Script</Label>
                                <Textarea 
                                    value={kb.voicemailScript}
                                    onChange={e => setKb({ ...kb, voicemailScript: e.target.value })}
                                    rows={2}
                                    className="text-xs mt-1"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 6. FAQS & OBJECTIONS TAB */}
                <TabsContent value="faqs" className="space-y-6 pt-4">
                    {/* FAQs */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5 text-blue-500" /> Frequently Asked Questions (FAQs)
                                    </CardTitle>
                                    <CardDescription>Common parent questions answered instantly by the voice AI.</CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setKb({
                                        ...kb,
                                        faqs: [
                                            ...kb.faqs,
                                            { question: "New Question?", answer: "Answer here..." }
                                        ]
                                    })}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add FAQ
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {kb.faqs.map((faq, i) => (
                                <div key={i} className="p-4 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Input 
                                            value={faq.question}
                                            onChange={e => {
                                                const list = [...kb.faqs];
                                                list[i].question = e.target.value;
                                                setKb({ ...kb, faqs: list });
                                            }}
                                            placeholder="Question"
                                            className="font-bold text-xs h-9"
                                        />
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                                            onClick={() => {
                                                const list = kb.faqs.filter((_, idx) => idx !== i);
                                                setKb({ ...kb, faqs: list });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <Textarea 
                                        value={faq.answer}
                                        onChange={e => {
                                            const list = [...kb.faqs];
                                            list[i].answer = e.target.value;
                                            setKb({ ...kb, faqs: list });
                                        }}
                                        placeholder="Answer"
                                        rows={2}
                                        className="text-xs"
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Objections */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-indigo-500" /> Objection Handling
                                    </CardTitle>
                                    <CardDescription>Scripts for concerns like "Too expensive", "Never played before", or "Need to talk to spouse".</CardDescription>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setKb({
                                        ...kb,
                                        objections: [
                                            ...kb.objections,
                                            { trigger: "New Concern", response: "Empathetic response..." }
                                        ]
                                    })}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Objection
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {kb.objections.map((obj, i) => (
                                <div key={i} className="p-4 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Input 
                                            value={obj.trigger}
                                            onChange={e => {
                                                const list = [...kb.objections];
                                                list[i].trigger = e.target.value;
                                                setKb({ ...kb, objections: list });
                                            }}
                                            placeholder="Parent's Concern / Objection Trigger"
                                            className="font-bold text-xs h-9"
                                        />
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                                            onClick={() => {
                                                const list = kb.objections.filter((_, idx) => idx !== i);
                                                setKb({ ...kb, objections: list });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <Textarea 
                                        value={obj.response}
                                        onChange={e => {
                                            const list = [...kb.objections];
                                            list[i].response = e.target.value;
                                            setKb({ ...kb, objections: list });
                                        }}
                                        placeholder="Empathetic Response"
                                        rows={2}
                                        className="text-xs"
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 7. TRANSFERS & ESCALATION TAB */}
                <TabsContent value="transfer" className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <PhoneForwarded className="w-5 h-5 text-indigo-500" /> Human Transfer & Escalation Rules
                            </CardTitle>
                            <CardDescription>
                                Defines when the AI voice agent warm-transfers the live call to a human team member.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Human Transfer Destination Phone Number</Label>
                                <Input 
                                    value={kb.humanTransferPhone}
                                    onChange={e => setKb({ ...kb, humanTransferPhone: e.target.value })}
                                    placeholder="1-800-293-0354"
                                    className="max-w-xs font-semibold mt-1"
                                />
                            </div>

                            <div>
                                <Label>Warm Transfer Script</Label>
                                <Textarea 
                                    value={kb.warmTransferScript}
                                    onChange={e => setKb({ ...kb, warmTransferScript: e.target.value })}
                                    rows={2}
                                    className="text-xs mt-1"
                                />
                            </div>

                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transfer Trigger Conditions</Label>
                                    <Button size="sm" variant="ghost" onClick={() => handleArrayAdd("humanTransferTriggers", "New condition")}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Condition
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {kb.humanTransferTriggers.map((trig, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Input 
                                                value={trig} 
                                                onChange={e => handleArrayChange("humanTransferTriggers", i, e.target.value)} 
                                                className="text-xs h-9"
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleArrayRemove("humanTransferTriggers", i)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Compiled Prompt Preview */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" /> Live Generated Universal Prompt Preview
                                    </CardTitle>
                                    <CardDescription>
                                        This is the exact full prompt that is compiled and pushed to Retell AI on sync.
                                    </CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => copyToClipboard(compiledPrompt)}>
                                    {copiedPrompt ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                    {copiedPrompt ? "Copied" : "Copy Prompt"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/70 p-4 rounded-xl border border-border font-mono text-[11px] leading-relaxed max-h-[350px] overflow-y-auto whitespace-pre-wrap select-all">
                                {compiledPrompt}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
