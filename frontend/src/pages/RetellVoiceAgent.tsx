import { useEffect, useState, useMemo, useRef } from "react";
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
    Check,
    Lock,
    Star,
    X,
    Pencil,
    Play,
    Square,
    Volume2,
    Calendar,
    Clock,
    Globe,
    Server,
    Radio,
    Link2,
    Zap,
    Database,
    PhoneOutgoing
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
    PricingPlanItem,
    TransferDepartmentItem,
    AgentStatusResponse
} from "../api/retell.api";

const VOICE_OPTIONS = [
    // 🌟 ElevenLabs Tier (~$0.13 – $0.15 / min)
    {
        id: "11labs-Lily",
        name: "Lily",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Female",
        accent: "American",
        description: "Warm, conversational & friendly. Sounds like a real YAU team member.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/lily.mp3",
        tag: "Recommended"
    },
    {
        id: "11labs-Marissa",
        name: "Marissa",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Female",
        accent: "American",
        description: "Enthusiastic, lively & natural. Great for high-energy parent engagement.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/marissa.mp3",
        tag: "Natural & Warm"
    },
    {
        id: "11labs-Dorothy",
        name: "Dorothy",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Female",
        accent: "American",
        description: "Pleasant, caring & reassuring voice. Great for parent support.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/Dorothy.mp3",
        tag: "Caring Support"
    },
    {
        id: "11labs-Willa",
        name: "Willa",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Female",
        accent: "American",
        description: "Smooth, articulate & natural conversational pacing.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-Willa.mp3",
        tag: "Articulate"
    },
    {
        id: "11labs-Billy",
        name: "Billy",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Male",
        accent: "American",
        description: "Warm, approachable & energetic coach / mentor persona.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/billy.mp3",
        tag: "Coach Persona"
    },
    {
        id: "11labs-Brian",
        name: "Brian",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Male",
        accent: "American",
        description: "Calm, professional & confident team leader voice.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/brian.mp3",
        tag: "Professional"
    },
    {
        id: "11labs-Adrian",
        name: "Adrian",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Male",
        accent: "American",
        description: "Friendly, casual & confident conversational male voice.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
        tag: "Conversational"
    },
    {
        id: "11labs-Anthony",
        name: "Anthony",
        provider: "ElevenLabs",
        tier: "elevenlabs",
        rate: "~$0.13/min",
        gender: "Male",
        accent: "American",
        description: "Approachable, direct & upbeat communicator.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/anthony.mp3",
        tag: "Upbeat"
    },

    // ⚡ Standard Tier (~$0.08 – $0.10 / min)
    {
        id: "retell-Cimo",
        name: "Cimo (Original)",
        provider: "Platform",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Female",
        accent: "American",
        description: "Original default Cimo platform voice. Clear, familiar & standard rate.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/minimax_cimo.mp3",
        tag: "Original Default"
    },
    {
        id: "cartesia-Cleo",
        name: "Cleo",
        provider: "Cartesia",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Female",
        accent: "American",
        description: "Ultra-low latency, crisp & clear conversational speech.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-cc444464-5920-438d-ac33-e6a6dd34a955.mp3",
        tag: "Low Latency"
    },
    {
        id: "cartesia-Willa",
        name: "Willa (Fast)",
        provider: "Cartesia",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Female",
        accent: "American",
        description: "High speed, instant responses for fast parent Q&A.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-Willa.mp3",
        tag: "Fast Response"
    },
    {
        id: "cartesia-Brian",
        name: "Brian (Fast)",
        provider: "Cartesia",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Male",
        accent: "American",
        description: "Articulate and rapid male voice for high-volume call handling.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-ccb4cea5-13c8-4559-a9c8-e83bc8171c4d.mp3",
        tag: "High Volume"
    },
    {
        id: "cartesia-Adam",
        name: "Adam (Fast)",
        provider: "Cartesia",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Male",
        accent: "American",
        description: "Clear and direct articulation at baseline platform pricing.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/cartesia-7cf0e2b1-8daf-4fe4-89ad-f6039398f359.mp3",
        tag: "Standard Rate"
    },
    {
        id: "retell-Alejandro",
        name: "Alejandro",
        provider: "Platform",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Male",
        accent: "American",
        description: "Smooth, direct & confident male platform voice.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/minimax-Alejandro.mp3",
        tag: "Standard Rate"
    },
    {
        id: "retell-Nico",
        name: "Nico",
        provider: "Platform",
        tier: "standard",
        rate: "~$0.08/min",
        gender: "Male",
        accent: "American",
        description: "Casual, steady platform voice with clear pronunciation.",
        previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/minimax_nico.mp3",
        tag: "Standard Rate"
    }
];

const TIMEZONE_OPTIONS = [
    {
        id: "America/New_York",
        name: "Eastern Time (US / New York)",
        region: "Washington DC, Maryland (YAU HQ)",
        flag: "🇺🇸",
        tag: "Default (YAU HQ)",
        desc: "Standard for all DC Metro & Maryland practice locations and parent calls."
    },
    {
        id: "Asia/Kolkata",
        name: "India Standard Time (IST / Kolkata)",
        region: "India Standard Time Zone",
        flag: "🇮🇳",
        tag: "Developer / IST",
        desc: "Convenient for developers testing business hours and live calls during India daytime."
    },
    {
        id: "America/Chicago",
        name: "Central Time (US / Chicago)",
        region: "US Central Time Zone",
        flag: "🇺🇸",
        tag: "Central",
        desc: "Standard US Central business schedule."
    },
    {
        id: "America/Los_Angeles",
        name: "Pacific Time (US / Los Angeles)",
        region: "US Pacific Time Zone",
        flag: "🇺🇸",
        tag: "Pacific",
        desc: "Standard US Pacific business schedule."
    }
];

export default function RetellVoiceAgent() {
    const isDevelopment = import.meta.env.VITE_APP_ENV === 'development' || (import.meta.env.DEV && import.meta.env.VITE_APP_ENV !== 'production');
    const [voiceTier, setVoiceTier] = useState<'standard' | 'elevenlabs'>('standard');
    const [kb, setKb] = useState<RetellKnowledgeBaseData | null>(null);
    const [savedVoiceId, setSavedVoiceId] = useState<string>("11labs-Lily");
    const [compiledPrompt, setCompiledPrompt] = useState<string>("");
    const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [refreshingStatus, setRefreshingStatus] = useState(false);

    // Live clock for timezone previews
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTzTime = (tz: string) => {
        try {
            return new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                weekday: "short"
            }).format(currentTime);
        } catch {
            return "";
        }
    };

    // Audio preview state
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const handleRefreshStatus = async () => {
        try {
            setRefreshingStatus(true);
            const status = await getRetellAgentStatus();
            setAgentStatus(status);
            toast.success("Retell AI live status refreshed!");
        } catch (err: any) {
            toast.error("Could not fetch live Retell AI status.");
        } finally {
            setRefreshingStatus(false);
        }
    };

    const handlePlayVoicePreview = (voiceId: string, previewUrl: string) => {
        if (playingVoiceId === voiceId) {
            previewAudioRef.current?.pause();
            setPlayingVoiceId(null);
            return;
        }
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
        }
        const audio = new Audio(previewUrl);
        previewAudioRef.current = audio;
        audio.play();
        setPlayingVoiceId(voiceId);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
            toast.error("Could not play audio preview.");
            setPlayingVoiceId(null);
        };
    };

    // Active subtab
    const [activeTab, setActiveTab] = useState("personality");

    const liveCompiledPrompt = useMemo(() => {
        if (!kb) return compiledPrompt || "";
        return buildUniversalPrompt(kb);
    }, [kb, compiledPrompt]);

    // Numbered Rules / Trait / Trigger Add State
    const [isAddingTrait, setIsAddingTrait] = useState(false);
    const [newTrait, setNewTrait] = useState("");

    const [isAddingToneRule, setIsAddingToneRule] = useState(false);
    const [newToneRule, setNewToneRule] = useState("");

    const [isAddingTransferTrigger, setIsAddingTransferTrigger] = useState(false);
    const [newTransferTrigger, setNewTransferTrigger] = useState("");

    // Sports Programs State
    const [isAddingSport, setIsAddingSport] = useState(false);
    const [editingSportIndex, setEditingSportIndex] = useState<number | null>(null);
    const [sportForm, setSportForm] = useState({ name: "", emoji: "🏅", grades: "K – 8th Grade", description: "" });

    // Locations State
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
    const [locationForm, setLocationForm] = useState({ name: "", school: "", practiceDays: "", practiceTime: "6:00 PM – 7:30 PM" });

    // Pricing Plans State
    const [isAddingPlan, setIsAddingPlan] = useState(false);
    const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
    const [planForm, setPlanForm] = useState<PricingPlanItem>({ name: "", price: 50, interval: "month", isRecommended: false, includes: "" });

    // FAQs State
    const [isAddingFaq, setIsAddingFaq] = useState(false);
    const [editingFaqIndex, setEditingFaqIndex] = useState<number | null>(null);
    const [faqForm, setFaqForm] = useState({ question: "", answer: "" });

    // Objections State
    const [isAddingObjection, setIsAddingObjection] = useState(false);
    const [editingObjectionIndex, setEditingObjectionIndex] = useState<number | null>(null);
    const [objectionForm, setObjectionForm] = useState({ trigger: "", response: "" });

    // Departments State
    const [isAddingDepartment, setIsAddingDepartment] = useState(false);
    const [editingDepartmentIndex, setEditingDepartmentIndex] = useState<number | null>(null);
    const [departmentForm, setDepartmentForm] = useState<TransferDepartmentItem>({ departmentName: "", phoneNumber: "", triggers: "", transferType: "warm_transfer", onHoldMusic: "relaxing_sound" });

    const handleSaveTrait = () => {
        if (!kb || !newTrait.trim()) return;
        setKb({ ...kb, personalityTraits: [...kb.personalityTraits, newTrait.trim()] });
        setNewTrait("");
        setIsAddingTrait(false);
    };

    const handleSaveToneRule = () => {
        if (!kb || !newToneRule.trim()) return;
        setKb({ ...kb, toneRules: [...kb.toneRules, newToneRule.trim()] });
        setNewToneRule("");
        setIsAddingToneRule(false);
    };

    const handleSaveTransferTrigger = () => {
        if (!kb || !newTransferTrigger.trim()) return;
        setKb({ ...kb, humanTransferTriggers: [...kb.humanTransferTriggers, newTransferTrigger.trim()] });
        setNewTransferTrigger("");
        setIsAddingTransferTrigger(false);
    };

    // Sport Handlers
    const handleSaveSport = () => {
        if (!kb || !sportForm.name.trim()) return;
        setKb({ ...kb, sportsPrograms: [...kb.sportsPrograms, { ...sportForm }] });
        setSportForm({ name: "", emoji: "🏅", grades: "K – 8th Grade", description: "" });
        setIsAddingSport(false);
    };

    const handleStartEditSport = (index: number) => {
        if (!kb) return;
        setSportForm({ ...kb.sportsPrograms[index] });
        setEditingSportIndex(index);
    };

    const handleUpdateSport = () => {
        if (!kb || editingSportIndex === null || !sportForm.name.trim()) return;
        const list = [...kb.sportsPrograms];
        list[editingSportIndex] = { ...sportForm };
        setKb({ ...kb, sportsPrograms: list });
        setEditingSportIndex(null);
    };

    const handleDeleteSport = (index: number) => {
        if (!kb) return;
        setKb({ ...kb, sportsPrograms: kb.sportsPrograms.filter((_, i) => i !== index) });
    };

    // Location Handlers
    const handleSaveLocation = () => {
        if (!kb || !locationForm.name.trim()) return;
        setKb({ ...kb, locations: [...kb.locations, { ...locationForm }] });
        setLocationForm({ name: "", school: "", practiceDays: "", practiceTime: "6:00 PM – 7:30 PM" });
        setIsAddingLocation(false);
    };

    const handleStartEditLocation = (index: number) => {
        if (!kb) return;
        setLocationForm({ ...kb.locations[index] });
        setEditingLocationIndex(index);
    };

    const handleUpdateLocation = () => {
        if (!kb || editingLocationIndex === null || !locationForm.name.trim()) return;
        const list = [...kb.locations];
        list[editingLocationIndex] = { ...locationForm };
        setKb({ ...kb, locations: list });
        setEditingLocationIndex(null);
    };

    const handleDeleteLocation = (index: number) => {
        if (!kb) return;
        setKb({ ...kb, locations: kb.locations.filter((_, i) => i !== index) });
    };

    // Pricing Plan Handlers
    const handleSavePricingPlan = () => {
        if (!kb || !planForm.name.trim()) return;
        setKb({ ...kb, pricingPlans: [...(kb.pricingPlans || []), { ...planForm }] });
        setPlanForm({ name: "", price: 50, interval: "month", isRecommended: false, includes: "" });
        setIsAddingPlan(false);
    };

    const handleStartEditPricingPlan = (index: number) => {
        if (!kb) return;
        setPlanForm({ ...(kb.pricingPlans || [])[index] });
        setEditingPlanIndex(index);
    };

    const handleUpdatePricingPlan = () => {
        if (!kb || editingPlanIndex === null || !planForm.name.trim()) return;
        const list = [...(kb.pricingPlans || [])];
        list[editingPlanIndex] = { ...planForm };
        setKb({ ...kb, pricingPlans: list });
        setEditingPlanIndex(null);
    };

    // FAQ Handlers
    const handleSaveFaq = () => {
        if (!kb || !faqForm.question.trim()) return;
        setKb({ ...kb, faqs: [...kb.faqs, { ...faqForm }] });
        setFaqForm({ question: "", answer: "" });
        setIsAddingFaq(false);
    };

    const handleStartEditFaq = (index: number) => {
        if (!kb) return;
        setFaqForm({ ...kb.faqs[index] });
        setEditingFaqIndex(index);
    };

    const handleUpdateFaq = () => {
        if (!kb || editingFaqIndex === null || !faqForm.question.trim()) return;
        const list = [...kb.faqs];
        list[editingFaqIndex] = { ...faqForm };
        setKb({ ...kb, faqs: list });
        setEditingFaqIndex(null);
    };

    const handleDeleteFaq = (index: number) => {
        if (!kb) return;
        setKb({ ...kb, faqs: kb.faqs.filter((_, i) => i !== index) });
    };

    // Objection Handlers
    const handleSaveObjection = () => {
        if (!kb || !objectionForm.trigger.trim()) return;
        setKb({ ...kb, objections: [...kb.objections, { ...objectionForm }] });
        setObjectionForm({ trigger: "", response: "" });
        setIsAddingObjection(false);
    };

    const handleStartEditObjection = (index: number) => {
        if (!kb) return;
        setObjectionForm({ ...kb.objections[index] });
        setEditingObjectionIndex(index);
    };

    const handleUpdateObjection = () => {
        if (!kb || editingObjectionIndex === null || !objectionForm.trigger.trim()) return;
        const list = [...kb.objections];
        list[editingObjectionIndex] = { ...objectionForm };
        setKb({ ...kb, objections: list });
        setEditingObjectionIndex(null);
    };

    const handleDeleteObjection = (index: number) => {
        if (!kb) return;
        setKb({ ...kb, objections: kb.objections.filter((_, i) => i !== index) });
    };

    // Department Handlers
    const handleSaveDepartment = () => {
        if (!kb || !departmentForm.departmentName.trim()) return;
        setKb({ ...kb, transferDepartments: [...(kb.transferDepartments || []), { ...departmentForm }] });
        setDepartmentForm({ departmentName: "", phoneNumber: "", triggers: "", transferType: "warm_transfer", onHoldMusic: "relaxing_sound" });
        setIsAddingDepartment(false);
    };

    const handleStartEditDepartment = (index: number) => {
        if (!kb) return;
        const dept = (kb.transferDepartments || [])[index];
        setDepartmentForm({
            departmentName: dept?.departmentName || "",
            phoneNumber: dept?.phoneNumber || "",
            triggers: dept?.triggers || "",
            transferType: dept?.transferType || "warm_transfer",
            onHoldMusic: dept?.onHoldMusic || "relaxing_sound"
        });
        setEditingDepartmentIndex(index);
    };

    const handleUpdateDepartment = () => {
        if (!kb || editingDepartmentIndex === null || !departmentForm.departmentName.trim()) return;
        const list = [...(kb.transferDepartments || [])];
        list[editingDepartmentIndex] = { ...departmentForm };
        setKb({ ...kb, transferDepartments: list });
        setEditingDepartmentIndex(null);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [kbRes, statusRes] = await Promise.allSettled([
                getKnowledgeBase(),
                getRetellAgentStatus()
            ]);

            if (kbRes.status === "fulfilled") {
                const kbData = kbRes.value.knowledgeBase;
                if (!kbData.pricingPlans || kbData.pricingPlans.length === 0) {
                    kbData.pricingPlans = [
                        {
                            name: "Monthly Membership",
                            price: kbData.monthlyPrice || 50,
                            interval: "month",
                            isRecommended: true,
                            includes: kbData.monthlyIncludes || "All 4 sports (soccer, basketball, flag football, cheer) — rotate anytime. No re-registration. Uniform purchased separately."
                        },
                        {
                            name: "Seasonal Fee",
                            price: kbData.seasonalPrice || 200,
                            interval: "season",
                            isRecommended: false,
                            includes: kbData.seasonalIncludes || "One sport per season (3–4 months). Uniform included."
                        }
                    ];
                }
                if (!kbData.transferDepartments || kbData.transferDepartments.length === 0) {
                    kbData.transferDepartments = [
                        {
                            departmentName: "Executive Management / Escalations",
                            phoneNumber: "+919896233745",
                            triggers: "Director requests, serious complaints, special circumstance reviews",
                            transferType: "cold_transfer"
                        }
                    ];
                }
                setKb(kbData);
                setSavedVoiceId(kbData.voiceId || "11labs-Lily");
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
            setSavedVoiceId(res.knowledgeBase.voiceId || "11labs-Lily");
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
        setKb({ ...kb, [field]: [defaultValue, ...kb[field]] });
    };

    const handleArrayRemove = (field: "personalityTraits" | "toneRules" | "differentiators" | "humanTransferTriggers", index: number) => {
        if (!kb) return;
        const list = kb[field].filter((_, i) => i !== index);
        setKb({ ...kb, [field]: list });
    };

    // Pricing Plan Helpers
    const handlePricingPlanChange = (index: number, field: keyof PricingPlanItem, value: any) => {
        if (!kb) return;
        const plans = [...(kb.pricingPlans || [])];
        plans[index] = { ...plans[index], [field]: value };
        setKb({ ...kb, pricingPlans: plans });
    };

    const handleAddPricingPlan = () => {
        if (!kb) return;
        const newPlan: PricingPlanItem = {
            name: "",
            price: 0,
            interval: "",
            isRecommended: false,
            includes: ""
        };
        setKb({ ...kb, pricingPlans: [newPlan, ...(kb.pricingPlans || [])] });
    };

    const handleDeletePricingPlan = (index: number) => {
        if (!kb) return;
        const plans = (kb.pricingPlans || []).filter((_, i) => i !== index);
        setKb({ ...kb, pricingPlans: plans });
    };

    const handleToggleRecommendedPlan = (index: number) => {
        if (!kb) return;
        const plans = (kb.pricingPlans || []).map((p, i) => ({
            ...p,
            isRecommended: i === index ? !p.isRecommended : false
        }));
        setKb({ ...kb, pricingPlans: plans });
    };

    // Department Transfer Helpers
    const handleAddDepartment = () => {
        if (!kb) return;
        const newDept: TransferDepartmentItem = {
            departmentName: "",
            phoneNumber: "",
            triggers: "",
            transferType: "cold_transfer"
        };
        setKb({ ...kb, transferDepartments: [newDept, ...(kb.transferDepartments || [])] });
    };

    const handleDepartmentChange = (index: number, field: keyof TransferDepartmentItem, value: any) => {
        if (!kb) return;
        const depts = [...(kb.transferDepartments || [])];
        depts[index] = { ...depts[index], [field]: value };
        setKb({ ...kb, transferDepartments: depts });
    };

    const handleDeleteDepartment = (index: number) => {
        if (!kb) return;
        const depts = (kb.transferDepartments || []).filter((_, i) => i !== index);
        setKb({ ...kb, transferDepartments: depts });
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
                <TabsList className={`grid ${isDevelopment ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'} h-auto p-1 bg-muted/60 rounded-xl gap-1 border border-border/50`}>
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
                    <TabsTrigger value="business_hours" className="gap-1.5 text-xs py-2">
                        <Clock className="w-3.5 h-3.5 text-amber-500" /> Business Hours
                    </TabsTrigger>
                    <TabsTrigger value="faqs" className="gap-1.5 text-xs py-2">
                        <HelpCircle className="w-3.5 h-3.5" /> FAQs & Objections
                    </TabsTrigger>
                    <TabsTrigger value="transfer" className="gap-1.5 text-xs py-2">
                        <PhoneForwarded className="w-3.5 h-3.5" /> Transfers
                    </TabsTrigger>
                    {isDevelopment && (
                        <TabsTrigger value="webhooks" className="gap-1.5 text-xs py-2 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Globe className="w-3.5 h-3.5 text-emerald-500" /> Webhooks
                        </TabsTrigger>
                    )}
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
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-xs font-semibold">Agent Persona Name</Label>
                                        <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                                            <Lock className="w-2.5 h-2.5" /> Auto-Synced with Voice
                                        </Badge>
                                    </div>
                                    <Input
                                        value={kb.agentName || "Lily"}
                                        disabled
                                        className="bg-muted/50 cursor-not-allowed font-medium text-foreground/90"
                                        placeholder="e.g. Lily"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">Persona name is automatically tied to your selected AI Voice Model below.</p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-xs font-semibold">Inbound Phone Number</Label>
                                        <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                                            <Lock className="w-2.5 h-2.5" /> Active Hotline
                                        </Badge>
                                    </div>
                                    <Input
                                        value={kb.phoneNumber || "+18886879139"}
                                        disabled
                                        className="bg-muted/50 cursor-not-allowed font-mono text-foreground/80 font-medium"
                                        placeholder="+18886879139"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">Dedicated Retell toll-free hotline.</p>
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

                    {/* AI Voice Model Selection Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Volume2 className="w-5 h-5 text-indigo-500" /> AI Voice Model Selection
                                    </CardTitle>
                                    <CardDescription>
                                        Choose your speech synthesis model. Filter between standard voices ($0.08–$0.10/min) and premium ElevenLabs voices.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                                    {/* Live in Retell Voice Badge */}
                                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live in Retell: <strong>{VOICE_OPTIONS.find(v => v.id === (agentStatus?.liveAgent?.voice_id || kb?.voiceId || "11labs-Lily"))?.name || agentStatus?.liveAgent?.voice_id || kb?.voiceId || "Lily"}</strong>
                                    </Badge>

                                    {/* Saved Voice Name Badge */}
                                    <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 flex items-center gap-1.5 py-1">
                                        <Database className="w-3.5 h-3.5 text-indigo-500" />
                                        Saved Voice Name: <strong>{VOICE_OPTIONS.find(v => v.id === savedVoiceId)?.name || savedVoiceId || "Lily"}</strong>
                                    </Badge>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleRefreshStatus}
                                        disabled={refreshingStatus}
                                        className="h-7 text-xs px-2"
                                        title="Fetch live agent configuration from Retell AI"
                                    >
                                        <RefreshCw className={`w-3 h-3 mr-1 ${refreshingStatus ? "animate-spin text-primary" : ""}`} />
                                        Refresh Status
                                    </Button>
                                </div>
                            </div>

                            {/* Unsynced Draft Alert Banner */}
                            {savedVoiceId !== (agentStatus?.liveAgent?.voice_id || "11labs-Lily") && (
                                <div className="mt-2.5 p-2 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
                                    <span className="flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        <span>Saved Voice Name is <strong>{VOICE_OPTIONS.find(v => v.id === savedVoiceId)?.name || savedVoiceId}</strong> (Draft). Click <strong>"Save & Sync to Retell"</strong> at the top to apply this voice to live phone calls.</span>
                                    </span>
                                </div>
                            )}

                            {/* 2-Tier Model Filter Toggle: Standard First, ElevenLabs Second */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setVoiceTier('standard')}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                        voiceTier === 'standard'
                                            ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
                                            : 'border-border/70 bg-card hover:bg-muted/40'
                                    }`}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-emerald-500" />
                                            <span className="font-bold text-xs text-foreground">⚡ Standard Voices</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Cartesia & Platform voices (incl. Cimo)</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                                        ~$0.08 – $0.10/min
                                    </Badge>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setVoiceTier('elevenlabs')}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                        voiceTier === 'elevenlabs'
                                            ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/30'
                                            : 'border-border/70 bg-card hover:bg-muted/40'
                                    }`}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-indigo-500" />
                                            <span className="font-bold text-xs text-foreground">🌟 ElevenLabs Voices</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Warm, natural & human conversational tone</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shrink-0">
                                        ~$0.13 – $0.15/min
                                    </Badge>
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {VOICE_OPTIONS.filter(v => v.tier === voiceTier).map((voice) => {
                                    const liveRetellVoiceId = agentStatus?.liveAgent?.voice_id || "11labs-Lily";
                                    const currentSelectedVoiceId = kb?.voiceId || savedVoiceId || "11labs-Lily";
                                    const isLiveActive = (liveRetellVoiceId === voice.id);
                                    const isSavedInDb = (savedVoiceId === voice.id && !isLiveActive);
                                    const isUnsavedSelected = (currentSelectedVoiceId === voice.id && currentSelectedVoiceId !== savedVoiceId && !isLiveActive);
                                    const isPlaying = playingVoiceId === voice.id;

                                    return (
                                        <div
                                            key={voice.id}
                                            onClick={() => {
                                                const cleanName = voice.name.replace(/\s*\([^)]*\)/g, '').trim();
                                                if (kb) {
                                                    setKb({ 
                                                        ...kb, 
                                                        voiceId: voice.id,
                                                        agentName: cleanName 
                                                    });
                                                }
                                            }}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer h-[124px] flex flex-col justify-between relative ${
                                                isLiveActive
                                                    ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400 shadow-md ring-2 ring-emerald-500/40"
                                                    : isSavedInDb
                                                    ? "bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/30"
                                                    : isUnsavedSelected
                                                    ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/60 shadow-xs ring-1 ring-amber-500/30"
                                                    : "bg-card hover:bg-accent/40 border-border/70"
                                            }`}
                                        >
                                            <div>
                                                {/* Top Row: Name + Gender on Left, Play Button on Right (Locked 1 row) */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        <span className={`font-bold text-xs truncate ${
                                                            isLiveActive 
                                                                ? "text-emerald-700 dark:text-emerald-300 font-extrabold" 
                                                                : isSavedInDb 
                                                                ? "text-indigo-700 dark:text-indigo-300 font-bold" 
                                                                : isUnsavedSelected
                                                                ? "text-amber-700 dark:text-amber-300 font-bold"
                                                                : "text-foreground"
                                                        }`}>
                                                            {voice.name}
                                                        </span>
                                                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground font-mono shrink-0">
                                                            {voice.gender}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlayVoicePreview(voice.id, voice.previewUrl);
                                                        }}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-105 shrink-0 ${
                                                            isPlaying
                                                                ? "bg-amber-500 text-white animate-pulse"
                                                                : isLiveActive
                                                                ? "bg-emerald-600 text-white"
                                                                : isSavedInDb
                                                                ? "bg-indigo-600 text-white"
                                                                : isUnsavedSelected
                                                                ? "bg-amber-600 text-white"
                                                                : "bg-muted text-muted-foreground hover:text-foreground"
                                                        }`}
                                                        title={isPlaying ? "Stop Preview" : "Play Sample"}
                                                    >
                                                        {isPlaying ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current ml-0.5" />}
                                                    </button>
                                                </div>

                                                {/* Description: Uniform 2 lines */}
                                                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-1.5">
                                                    {voice.description}
                                                </p>
                                            </div>

                                            {/* Bottom Row: Voice ID on Left, Status Badge on Right */}
                                            <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-auto">
                                                <span className={`text-[10px] font-mono truncate max-w-[110px] ${
                                                    isLiveActive 
                                                        ? "text-emerald-700 dark:text-emerald-300 font-semibold" 
                                                        : isSavedInDb 
                                                        ? "text-indigo-700 dark:text-indigo-300 font-medium" 
                                                        : isUnsavedSelected
                                                        ? "text-amber-700 dark:text-amber-300 font-medium"
                                                        : "text-muted-foreground"
                                                }`}>
                                                    {voice.id}
                                                </span>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {isLiveActive ? (
                                                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0 h-4 gap-0.5 tracking-tight shrink-0 shadow-2xs">
                                                            <CheckCircle2 className="w-2.5 h-2.5" /> LIVE
                                                        </Badge>
                                                    ) : isSavedInDb ? (
                                                        <Badge variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-500/40 bg-indigo-500/10 font-semibold text-[9px] px-1.5 py-0 h-4 gap-0.5 tracking-tight shrink-0">
                                                            <Database className="w-2.5 h-2.5" /> SAVED
                                                        </Badge>
                                                    ) : isUnsavedSelected ? (
                                                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 font-semibold text-[9px] px-1.5 py-0 h-4 gap-0.5 tracking-tight shrink-0">
                                                            <Pencil className="w-2.5 h-2.5" /> SELECTED
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {voice.accent || voice.tier}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Outbound Voicemail & Answering Machine Detection (AMD) Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <PhoneOutgoing className="w-4 h-4 text-indigo-500" /> Outbound Answering Machine Detection (AMD) & Voicemail Drop
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        When making outbound calls to parents/athletes, Retell AI automatically detects if an answering machine answers, waits for the beep, and speaks this voicemail message before hanging up.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setKb({ ...kb, enableVoicemailDetection: !(kb.enableVoicemailDetection ?? true) })}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                            (kb.enableVoicemailDetection ?? true)
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                                : "bg-muted text-muted-foreground border border-border/70"
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${ (kb.enableVoicemailDetection ?? true) ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50" }`} />
                                        {(kb.enableVoicemailDetection ?? true) ? "AMD Enabled" : "AMD Disabled"}
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-1">
                            <div>
                                <Label className="text-xs font-semibold mb-1 block">Automated Outbound Voicemail Message (Spoken after the beep)</Label>
                                <Textarea
                                    value={kb.outboundVoicemailMessage || "Hi, this is Youth Athlete University following up regarding your youth sports inquiry. We would love to connect with you and answer any questions for your athlete. Please give us a call back at 1-888-687-9139 or visit us online at yausports.com. Have a wonderful day!"}
                                    onChange={e => setKb({ ...kb, outboundVoicemailMessage: e.target.value })}
                                    rows={3}
                                    disabled={!(kb.enableVoicemailDetection ?? true)}
                                    placeholder="Enter script the AI should speak when leaving a voicemail..."
                                    className="text-xs resize-none"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Retell AI listens for the tone/beep (up to 30s timeout), reads this script naturally with the selected voice, and logs the call in Call History as Voicemail Left.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Personality Traits & Tone Rules */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Core Personality Traits */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Core Personality Traits</CardTitle>
                                        <CardDescription className="text-xs">Key character attributes defining how the AI sounds.</CardDescription>
                                    </div>
                                    {!isAddingTrait && (
                                        <Button size="sm" variant="ghost" onClick={() => setIsAddingTrait(true)} className="gap-1 text-xs">
                                            <Plus className="w-3.5 h-3.5" /> Add Trait
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {isAddingTrait && (
                                    <div className="p-3 bg-muted/40 border border-primary/40 rounded-xl space-y-2 animate-in fade-in-0 duration-200">
                                        <Label className="text-xs font-semibold">New Personality Trait</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newTrait}
                                                onChange={e => setNewTrait(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveTrait();
                                                    } else if (e.key === 'Escape') {
                                                        setIsAddingTrait(false);
                                                        setNewTrait("");
                                                    }
                                                }}
                                                placeholder="e.g. Energetic & Patient"
                                                className="text-xs h-9 flex-1"
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleSaveTrait}
                                                disabled={!newTrait.trim()}
                                                className="h-9 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setIsAddingTrait(false);
                                                    setNewTrait("");
                                                }}
                                                className="h-9 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {(!kb.personalityTraits || kb.personalityTraits.length === 0) && !isAddingTrait ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                                        No personality traits added yet. Click <strong>+ Add Trait</strong> to create one.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {kb.personalityTraits.map((trait, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground group hover:border-border transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5 flex-1 pr-2">
                                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <span className="font-medium text-foreground">{trait}</span>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                                    onClick={() => handleArrayRemove("personalityTraits", i)}
                                                    title="Delete Trait"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tone & Conversational Rules */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Tone & Conversational Rules</CardTitle>
                                        <CardDescription className="text-xs">Rules governing speech rhythm, empathy, and brevity.</CardDescription>
                                    </div>
                                    {!isAddingToneRule && (
                                        <Button size="sm" variant="ghost" onClick={() => setIsAddingToneRule(true)} className="gap-1 text-xs">
                                            <Plus className="w-3.5 h-3.5" /> Add Rule
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {isAddingToneRule && (
                                    <div className="p-3 bg-muted/40 border border-primary/40 rounded-xl space-y-2 animate-in fade-in-0 duration-200">
                                        <Label className="text-xs font-semibold">New Tone & Conversational Rule</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newToneRule}
                                                onChange={e => setNewToneRule(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveToneRule();
                                                    } else if (e.key === 'Escape') {
                                                        setIsAddingToneRule(false);
                                                        setNewToneRule("");
                                                    }
                                                }}
                                                placeholder="e.g. Speak warmly, listen actively, and keep sentences concise"
                                                className="text-xs h-9 flex-1"
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleSaveToneRule}
                                                disabled={!newToneRule.trim()}
                                                className="h-9 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setIsAddingToneRule(false);
                                                    setNewToneRule("");
                                                }}
                                                className="h-9 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {(!kb.toneRules || kb.toneRules.length === 0) && !isAddingToneRule ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                                        No conversational rules added yet. Click <strong>+ Add Rule</strong> to create one.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {kb.toneRules.map((rule, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground group hover:border-border transition-colors"
                                            >
                                                <div className="flex items-start gap-2.5 flex-1 pr-2">
                                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    <span className="leading-relaxed font-medium text-foreground">{rule}</span>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                                    onClick={() => handleArrayRemove("toneRules", i)}
                                                    title="Delete Rule"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                {!isAddingSport && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setSportForm({ name: "", emoji: "🏅", grades: "K – 8th Grade", description: "" });
                                            setIsAddingSport(true);
                                        }}
                                        className="gap-1 text-xs"
                                    >
                                        <Plus className="w-4 h-4" /> Add Sport
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Sport Form */}
                            {isAddingSport && (
                                <div className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Trophy className="w-3.5 h-3.5 text-amber-500" /> Add New Sports Program
                                        </Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveSport}
                                                disabled={!sportForm.name.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save Sport
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingSport(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <div>
                                            <Label className="text-[11px]">Emoji</Label>
                                            <Input
                                                value={sportForm.emoji}
                                                onChange={e => setSportForm({ ...sportForm, emoji: e.target.value })}
                                                placeholder="🏅"
                                                className="h-9 text-center text-base mt-1"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <Label className="text-[11px]">Sport Name</Label>
                                            <Input
                                                value={sportForm.name}
                                                onChange={e => setSportForm({ ...sportForm, name: e.target.value })}
                                                placeholder="e.g. Basketball"
                                                className="h-9 text-xs font-semibold mt-1"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Grade Range</Label>
                                            <Input
                                                value={sportForm.grades}
                                                onChange={e => setSportForm({ ...sportForm, grades: e.target.value })}
                                                placeholder="e.g. K – 8th Grade"
                                                className="h-9 text-xs mt-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">What Kids Love About It / Key Benefits</Label>
                                        <Input
                                            value={sportForm.description}
                                            onChange={e => setSportForm({ ...sportForm, description: e.target.value })}
                                            placeholder="What kids love about it / key program benefits..."
                                            className="h-9 text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.sportsPrograms || kb.sportsPrograms.length === 0) && !isAddingSport ? (
                                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl">
                                    <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-foreground">No sports programs added yet</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">Click below to add your first sport program.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingSport(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Sport
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kb.sportsPrograms.map((sport, i) => (
                                        editingSportIndex === i ? (
                                            /* Edit Sport Form */
                                            <div key={i} className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit Sport Program</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdateSport}
                                                            disabled={!sportForm.name.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingSportIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                                    <div>
                                                        <Label className="text-[11px]">Emoji</Label>
                                                        <Input
                                                            value={sportForm.emoji}
                                                            onChange={e => setSportForm({ ...sportForm, emoji: e.target.value })}
                                                            className="h-9 text-center text-base mt-1"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <Label className="text-[11px]">Sport Name</Label>
                                                        <Input
                                                            value={sportForm.name}
                                                            onChange={e => setSportForm({ ...sportForm, name: e.target.value })}
                                                            className="h-9 text-xs font-semibold mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Grade Range</Label>
                                                        <Input
                                                            value={sportForm.grades}
                                                            onChange={e => setSportForm({ ...sportForm, grades: e.target.value })}
                                                            className="h-9 text-xs mt-1"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">What Kids Love / Key Benefits</Label>
                                                    <Input
                                                        value={sportForm.description}
                                                        onChange={e => setSportForm({ ...sportForm, description: e.target.value })}
                                                        className="h-9 text-xs mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div
                                                key={i}
                                                className="p-3.5 bg-card border border-border/80 rounded-xl space-y-2 group hover:border-border transition-colors shadow-2xs"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 flex-1">
                                                        <span className="text-lg">{sport.emoji || "🏅"}</span>
                                                        <span className="font-bold text-sm text-foreground">{sport.name}</span>
                                                        {sport.grades && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                                {sport.grades}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditSport(i)}
                                                            title="Edit Sport"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteSport(i)}
                                                            title="Delete Sport"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {sport.description && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                                                        {sport.description}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}
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
                                {!isAddingLocation && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setLocationForm({ name: "", school: "", practiceDays: "", practiceTime: "6:00 PM – 7:30 PM" });
                                            setIsAddingLocation(true);
                                        }}
                                        className="gap-1 text-xs"
                                    >
                                        <Plus className="w-4 h-4" /> Add Location
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Location Form */}
                            {isAddingLocation && (
                                <div className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Add New Practice Location
                                        </Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveLocation}
                                                disabled={!locationForm.name.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save Location
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingLocation(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <Label className="text-[11px]">Location Name</Label>
                                            <Input
                                                value={locationForm.name}
                                                onChange={e => setLocationForm({ ...locationForm, name: e.target.value })}
                                                placeholder="e.g. Bowie"
                                                className="h-9 text-xs font-semibold mt-1"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Facility / School</Label>
                                            <Input
                                                value={locationForm.school}
                                                onChange={e => setLocationForm({ ...locationForm, school: e.target.value })}
                                                placeholder="e.g. Northview Elementary"
                                                className="h-9 text-xs mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Practice Days</Label>
                                            <Input
                                                value={locationForm.practiceDays}
                                                onChange={e => setLocationForm({ ...locationForm, practiceDays: e.target.value })}
                                                placeholder="e.g. Wed & Fri"
                                                className="h-9 text-xs mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Practice Time</Label>
                                            <Input
                                                value={locationForm.practiceTime}
                                                onChange={e => setLocationForm({ ...locationForm, practiceTime: e.target.value })}
                                                placeholder="6:00 PM – 7:30 PM"
                                                className="h-9 text-xs mt-1 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.locations || kb.locations.length === 0) && !isAddingLocation ? (
                                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl">
                                    <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-foreground">No practice locations added yet</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">Click below to configure your practice hubs.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingLocation(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Location
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kb.locations.map((loc, i) => (
                                        editingLocationIndex === i ? (
                                            /* Edit Location Form */
                                            <div key={i} className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit Practice Location</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdateLocation}
                                                            disabled={!locationForm.name.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingLocationIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <Label className="text-[11px]">Location Name</Label>
                                                        <Input
                                                            value={locationForm.name}
                                                            onChange={e => setLocationForm({ ...locationForm, name: e.target.value })}
                                                            className="h-9 text-xs font-semibold mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Facility / School</Label>
                                                        <Input
                                                            value={locationForm.school}
                                                            onChange={e => setLocationForm({ ...locationForm, school: e.target.value })}
                                                            className="h-9 text-xs mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Practice Days</Label>
                                                        <Input
                                                            value={locationForm.practiceDays}
                                                            onChange={e => setLocationForm({ ...locationForm, practiceDays: e.target.value })}
                                                            className="h-9 text-xs mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Practice Time</Label>
                                                        <Input
                                                            value={locationForm.practiceTime}
                                                            onChange={e => setLocationForm({ ...locationForm, practiceTime: e.target.value })}
                                                            className="h-9 text-xs mt-1 font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div
                                                key={i}
                                                className="p-3.5 bg-card border border-border/80 rounded-xl space-y-2 group hover:border-border transition-colors shadow-2xs"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 flex-1 flex-wrap">
                                                        <div className="flex items-center gap-1.5 text-foreground font-bold text-sm">
                                                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                                                            <span>{loc.name}</span>
                                                        </div>
                                                        {loc.school && (
                                                            <span className="text-xs text-muted-foreground">
                                                                at <strong className="text-foreground">{loc.school}</strong>
                                                            </span>
                                                        )}
                                                        {loc.practiceDays && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                {loc.practiceDays}
                                                            </span>
                                                        )}
                                                        {loc.practiceTime && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-muted-foreground bg-muted border border-border/60">
                                                                {loc.practiceTime}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditLocation(i)}
                                                            title="Edit Location"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteLocation(i)}
                                                            title="Delete Location"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}

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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-emerald-500" /> Pricing Plans & Refund Policy
                                    </CardTitle>
                                    <CardDescription>
                                        Manage all available membership and registration plans offered to calling parents.
                                    </CardDescription>
                                </div>
                                {!isAddingPlan && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setPlanForm({ name: "", price: 50, interval: "month", isRecommended: false, includes: "" });
                                            setIsAddingPlan(true);
                                        }}
                                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white self-start sm:self-auto"
                                    >
                                        <Plus className="w-4 h-4" /> Add Pricing Plan
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add Plan Form */}
                            {isAddingPlan && (
                                <div className="p-5 bg-muted/40 border border-primary/40 rounded-2xl space-y-4 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Add New Pricing Plan
                                        </Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSavePricingPlan}
                                                disabled={!planForm.name.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save Plan
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingPlan(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2">
                                            <Label className="text-[11px]">Plan Name</Label>
                                            <Input
                                                value={planForm.name}
                                                onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                                                placeholder="e.g. Monthly All-Access Membership"
                                                className="h-9 text-xs font-bold mt-1"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Price ($ USD)</Label>
                                            <Input
                                                type="number"
                                                value={planForm.price}
                                                onChange={e => setPlanForm({ ...planForm, price: Number(e.target.value) || 0 })}
                                                placeholder="50"
                                                className="h-9 text-xs font-bold mt-1 font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-[11px]">Billing Interval</Label>
                                            <select
                                                value={planForm.interval}
                                                onChange={e => setPlanForm({ ...planForm, interval: e.target.value })}
                                                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                <option value="month">Per Month ($/mo)</option>
                                                <option value="season">Per Season ($/season)</option>
                                                <option value="year">Per Year ($/yr)</option>
                                                <option value="one-time">One-Time Fee</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 pt-6">
                                            <input
                                                type="checkbox"
                                                id="plan-recommended-check"
                                                checked={planForm.isRecommended}
                                                onChange={e => setPlanForm({ ...planForm, isRecommended: e.target.checked })}
                                                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                            />
                                            <label htmlFor="plan-recommended-check" className="text-xs font-medium cursor-pointer">
                                                Mark as <strong>Most Popular / Recommended</strong>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">What is Included / Details</Label>
                                        <Textarea
                                            value={planForm.includes}
                                            onChange={e => setPlanForm({ ...planForm, includes: e.target.value })}
                                            rows={2}
                                            placeholder="e.g. All 4 sports, rotate anytime. Uniform included."
                                            className="text-xs mt-1 resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.pricingPlans || kb.pricingPlans.length === 0) && !isAddingPlan ? (
                                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl">
                                    <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-foreground">No pricing plans configured</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">Click below to add your first pricing plan.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingPlan(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Plan
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {kb.pricingPlans.map((plan, i) => (
                                        editingPlanIndex === i ? (
                                            /* Edit Plan Form */
                                            <div key={i} className="p-5 bg-muted/40 border border-primary/40 rounded-2xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit Pricing Plan</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdatePricingPlan}
                                                            disabled={!planForm.name.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingPlanIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="sm:col-span-2">
                                                        <Label className="text-[11px]">Plan Name</Label>
                                                        <Input
                                                            value={planForm.name}
                                                            onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                                                            className="h-9 text-xs font-bold mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Price ($)</Label>
                                                        <Input
                                                            type="number"
                                                            value={planForm.price}
                                                            onChange={e => setPlanForm({ ...planForm, price: Number(e.target.value) || 0 })}
                                                            className="h-9 text-xs font-bold mt-1 font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-[11px]">Billing Interval</Label>
                                                        <select
                                                            value={planForm.interval}
                                                            onChange={e => setPlanForm({ ...planForm, interval: e.target.value })}
                                                            className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs"
                                                        >
                                                            <option value="month">Per Month ($/mo)</option>
                                                            <option value="season">Per Season ($/season)</option>
                                                            <option value="year">Per Year ($/yr)</option>
                                                            <option value="one-time">One-Time Fee</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-6">
                                                        <input
                                                            type="checkbox"
                                                            id={`edit-plan-check-${i}`}
                                                            checked={planForm.isRecommended}
                                                            onChange={e => setPlanForm({ ...planForm, isRecommended: e.target.checked })}
                                                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                                        />
                                                        <label htmlFor={`edit-plan-check-${i}`} className="text-xs font-medium cursor-pointer">
                                                            Most Popular
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">Included Details</Label>
                                                    <Textarea
                                                        value={planForm.includes}
                                                        onChange={e => setPlanForm({ ...planForm, includes: e.target.value })}
                                                        rows={2}
                                                        className="text-xs mt-1 resize-none"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div
                                                key={i}
                                                className={`p-5 rounded-2xl border transition-all space-y-3 relative ${plan.isRecommended
                                                        ? "bg-gradient-to-b from-blue-500/10 via-card to-card border-blue-500/40 shadow-xs ring-1 ring-blue-500/20"
                                                        : "bg-card border-border/80 shadow-2xs"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-base text-foreground">{plan.name}</span>
                                                            {plan.isRecommended && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                                                    <Star className="w-3 h-3 fill-current" /> Recommended
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-baseline gap-1 mt-1 font-mono">
                                                            <span className="text-2xl font-black text-foreground">${plan.price}</span>
                                                            <span className="text-xs text-muted-foreground">/{plan.interval}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className={`h-7 w-7 ${plan.isRecommended ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
                                                            onClick={() => handleToggleRecommendedPlan(i)}
                                                            title="Toggle Recommended"
                                                        >
                                                            <Star className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditPricingPlan(i)}
                                                            title="Edit Plan"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeletePricingPlan(i)}
                                                            title="Delete Plan"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {plan.includes && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
                                                        {plan.includes}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}

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

                {/* 6. BUSINESS HOURS & AFTER-HOURS TAB */}
                <TabsContent value="business_hours" className="space-y-6 pt-4">
                    {/* Live Office Schedule Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-amber-500" /> Office Business Hours
                                    </CardTitle>
                                    <CardDescription>
                                        Configure live office hours. Outside these hours, the AI politely explains the office is closed and takes a message.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" /> Eastern Time (America/New_York)
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                                    <Label className="text-xs font-bold text-foreground">Monday – Friday</Label>
                                    <Input
                                        value={kb.businessHours?.monFri || "9:00 AM – 5:00 PM"}
                                        onChange={e => setKb({
                                            ...kb,
                                            businessHours: {
                                                enabled: true,
                                                timezone: "America/New_York",
                                                monFri: e.target.value,
                                                sat: kb.businessHours?.sat || "10:00 AM – 2:00 PM",
                                                sun: kb.businessHours?.sun || "Closed"
                                            }
                                        })}
                                        className="h-9 text-xs font-semibold bg-background mt-1"
                                        placeholder="9:00 AM – 5:00 PM"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Standard weekday office hours</p>
                                </div>
                                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                                    <Label className="text-xs font-bold text-foreground">Saturday</Label>
                                    <Input
                                        value={kb.businessHours?.sat || "10:00 AM – 2:00 PM"}
                                        onChange={e => setKb({
                                            ...kb,
                                            businessHours: {
                                                enabled: true,
                                                timezone: "America/New_York",
                                                monFri: kb.businessHours?.monFri || "9:00 AM – 5:00 PM",
                                                sat: e.target.value,
                                                sun: kb.businessHours?.sun || "Closed"
                                            }
                                        })}
                                        className="h-9 text-xs font-semibold bg-background mt-1"
                                        placeholder="10:00 AM – 2:00 PM"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Weekend game & practice hours</p>
                                </div>
                                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                                    <Label className="text-xs font-bold text-foreground">Sunday</Label>
                                    <Input
                                        value={kb.businessHours?.sun || "Closed"}
                                        onChange={e => setKb({
                                            ...kb,
                                            businessHours: {
                                                enabled: true,
                                                timezone: "America/New_York",
                                                monFri: kb.businessHours?.monFri || "9:00 AM – 5:00 PM",
                                                sat: kb.businessHours?.sat || "10:00 AM – 2:00 PM",
                                                sun: e.target.value
                                            }
                                        })}
                                        className="h-9 text-xs font-semibold bg-background mt-1"
                                        placeholder="Closed"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Office closed for staff rest</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* After-Hours Script Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" /> After-Hours Acknowledgement Script
                            </CardTitle>
                            <CardDescription>
                                Spoken when callers dial in outside 9am–5pm M–F or 10am–2pm Sat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Textarea
                                value={kb.afterHoursScript || "Thanks for calling Youth Athlete University! Our team is currently unavailable as our office is closed (open Monday to Friday 9 to 5, Saturdays 10 to 2, Sundays closed). I would love to answer your questions, or I can take a message and have someone from our team reach out during business hours."}
                                onChange={e => setKb({ ...kb, afterHoursScript: e.target.value })}
                                rows={3}
                                className="text-xs leading-relaxed"
                                placeholder="Script spoken when caller dials outside office hours..."
                            />
                            <p className="text-[11px] text-muted-foreground">
                                The AI warmly explains the office is closed, answers program questions, and offers to take down their message.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Unattended Transfer & Message Taking Protocol */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-primary" /> Unattended Transfer & Message Taking Protocol
                                    </CardTitle>
                                    <CardDescription>
                                        Triggered when a call forward to a department goes unanswered or caller asks to leave a message.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                    Caller ID Captured Automatically
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                value={kb.takeMessageScript || "It looks like our team member is currently assisting another parent. I can take down your name and what you are calling about, and have them get back to you promptly."}
                                onChange={e => setKb({ ...kb, takeMessageScript: e.target.value })}
                                rows={3}
                                className="text-xs leading-relaxed"
                                placeholder="Script used when a transfer is unattended or caller wants to leave a message..."
                            />
                            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
                                <p className="font-semibold text-foreground">💡 Automated Routing Behavior:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                    <li>The AI asks only for the caller's <strong>Name</strong> and <strong>Inquiry Details</strong>.</li>
                                    <li>The AI does <strong>NOT ask for their phone number</strong> because the system captures caller ID automatically.</li>
                                    <li>A targeted SMS alert is automatically sent to the attempted department's mobile line, and an email with transcript is sent to <code>team@yausports.com</code>.</li>
                                </ul>
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
                                {!isAddingFaq && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setFaqForm({ question: "", answer: "" });
                                            setIsAddingFaq(true);
                                        }}
                                        className="gap-1 text-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add FAQ
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add FAQ Form */}
                            {isAddingFaq && (
                                <div className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground">Add New FAQ</Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveFaq}
                                                disabled={!faqForm.question.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save FAQ
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingFaq(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">Question</Label>
                                        <Input
                                            value={faqForm.question}
                                            onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                                            placeholder="e.g. Can my child switch sports mid-season?"
                                            className="h-9 text-xs font-semibold mt-1"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">Answer</Label>
                                        <Textarea
                                            value={faqForm.answer}
                                            onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                                            placeholder="Answer (e.g. Yes! Monthly members can rotate sports anytime...)"
                                            rows={2}
                                            className="text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.faqs || kb.faqs.length === 0) && !isAddingFaq ? (
                                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl">
                                    <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-foreground">No FAQs configured</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">Click below to add common questions and answers.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingFaq(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add FAQ
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kb.faqs.map((faq, i) => (
                                        editingFaqIndex === i ? (
                                            /* Edit FAQ Form */
                                            <div key={i} className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit FAQ</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdateFaq}
                                                            disabled={!faqForm.question.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingFaqIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">Question</Label>
                                                    <Input
                                                        value={faqForm.question}
                                                        onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                                                        className="h-9 text-xs font-semibold mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">Answer</Label>
                                                    <Textarea
                                                        value={faqForm.answer}
                                                        onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                                                        rows={2}
                                                        className="text-xs mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div key={i} className="p-3.5 bg-card border border-border/80 rounded-xl space-y-1.5 group hover:border-border transition-colors shadow-2xs">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                                                            Q
                                                        </span>
                                                        <span className="font-bold text-xs text-foreground">{faq.question}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditFaq(i)}
                                                            title="Edit FAQ"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteFaq(i)}
                                                            title="Delete FAQ"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {faq.answer && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                                                        {faq.answer}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}
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
                                {!isAddingObjection && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setObjectionForm({ trigger: "", response: "" });
                                            setIsAddingObjection(true);
                                        }}
                                        className="gap-1 text-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Objection
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Objection Form */}
                            {isAddingObjection && (
                                <div className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground">Add New Objection Script</Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveObjection}
                                                disabled={!objectionForm.trigger.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save Script
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingObjection(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">Concern / Objection Trigger</Label>
                                        <Input
                                            value={objectionForm.trigger}
                                            onChange={e => setObjectionForm({ ...objectionForm, trigger: e.target.value })}
                                            placeholder="e.g. Too expensive"
                                            className="h-9 text-xs font-bold mt-1"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[11px]">Empathetic Response / Script</Label>
                                        <Textarea
                                            value={objectionForm.response}
                                            onChange={e => setObjectionForm({ ...objectionForm, response: e.target.value })}
                                            placeholder="Empathetic Response / Script..."
                                            rows={2}
                                            className="text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.objections || kb.objections.length === 0) && !isAddingObjection ? (
                                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-xl">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-foreground">No objection handling scripts configured</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">Click below to add scripts for common parent hesitations.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingObjection(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Objection
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kb.objections.map((obj, i) => (
                                        editingObjectionIndex === i ? (
                                            /* Edit Objection Form */
                                            <div key={i} className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit Objection Script</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdateObjection}
                                                            disabled={!objectionForm.trigger.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingObjectionIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">Concern / Objection Trigger</Label>
                                                    <Input
                                                        value={objectionForm.trigger}
                                                        onChange={e => setObjectionForm({ ...objectionForm, trigger: e.target.value })}
                                                        className="h-9 text-xs font-bold mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">Empathetic Response / Script</Label>
                                                    <Textarea
                                                        value={objectionForm.response}
                                                        onChange={e => setObjectionForm({ ...objectionForm, response: e.target.value })}
                                                        rows={2}
                                                        className="text-xs mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div key={i} className="p-3.5 bg-card border border-border/80 rounded-xl space-y-1.5 group hover:border-border transition-colors shadow-2xs">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                            When: {obj.trigger}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditObjection(i)}
                                                            title="Edit Objection"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteObjection(i)}
                                                            title="Delete Objection"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {obj.response && (
                                                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                                        {obj.response}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 7. TRANSFERS & ESCALATION TAB */}
                <TabsContent value="transfer" className="space-y-6 pt-4">
                    {/* Department & Topic-Based Routing */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <PhoneForwarded className="w-5 h-5 text-indigo-500" /> Topic-Based Department Call Routing
                                    </CardTitle>
                                    <CardDescription>
                                        Automatically transfer live parent calls to different phone numbers based on what they want to talk about (e.g. Billing, Coaching, Director).
                                    </CardDescription>
                                </div>
                                {!isAddingDepartment && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setDepartmentForm({ departmentName: "", phoneNumber: "", triggers: "", transferType: "cold_transfer" });
                                            setIsAddingDepartment(true);
                                        }}
                                        className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white self-start sm:self-auto"
                                    >
                                        <Plus className="w-4 h-4" /> Add Department
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Department Form */}
                            {isAddingDepartment && (
                                <div className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <PhoneForwarded className="w-3.5 h-3.5 text-indigo-500" /> Add New Transfer Department
                                        </Label>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveDepartment}
                                                disabled={!departmentForm.departmentName.trim()}
                                                className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save Department
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsAddingDepartment(false)}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <Label className="text-[11px]">Department / Role</Label>
                                            <Input
                                                value={departmentForm.departmentName}
                                                onChange={e => setDepartmentForm({ ...departmentForm, departmentName: e.target.value })}
                                                placeholder="e.g. Executive Management / Escalations"
                                                className="h-9 text-xs font-bold mt-1"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Direct Destination Phone</Label>
                                            <Input
                                                value={departmentForm.phoneNumber}
                                                onChange={e => setDepartmentForm({ ...departmentForm, phoneNumber: e.target.value })}
                                                placeholder="e.g. +919896233745"
                                                className="h-9 text-xs mt-1 font-mono font-medium"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Transfer Type</Label>
                                            <select
                                                value={departmentForm.transferType || "warm_transfer"}
                                                onChange={e => {
                                                    const val = e.target.value as 'cold_transfer' | 'warm_transfer';
                                                    setDepartmentForm({
                                                        ...departmentForm,
                                                        transferType: val,
                                                        onHoldMusic: val === 'cold_transfer' ? 'none' : (departmentForm.onHoldMusic || 'relaxing_sound')
                                                    });
                                                }}
                                                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                                            >
                                                <option value="warm_transfer">Warm Transfer (Hold Music + Announce)</option>
                                                <option value="cold_transfer">Cold Transfer (Direct Forward)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[11px]">Hold Music (While Connecting)</Label>
                                            <select
                                                value={departmentForm.onHoldMusic || "relaxing_sound"}
                                                onChange={e => {
                                                    const music = e.target.value as any;
                                                    setDepartmentForm({
                                                        ...departmentForm,
                                                        onHoldMusic: music,
                                                        transferType: music === 'none' ? departmentForm.transferType : 'warm_transfer'
                                                    });
                                                }}
                                                className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                                            >
                                                <option value="relaxing_sound">🎵 Relaxing Sound (Ambient)</option>
                                                <option value="uplifting_beats">🎶 Uplifting Beats (Modern)</option>
                                                <option value="ringtone">🔔 Standard Ringtone</option>
                                                <option value="none">🔇 None (Silence / Direct)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">When Should AI Route Here? (Keywords / Intent Triggers)</Label>
                                        <Input
                                            value={departmentForm.triggers}
                                            onChange={e => setDepartmentForm({ ...departmentForm, triggers: e.target.value })}
                                            placeholder="e.g. Director requests, serious complaints, special circumstance reviews"
                                            className="h-9 text-xs mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {(!kb.transferDepartments || kb.transferDepartments.length === 0) && !isAddingDepartment ? (
                                <div className="p-6 text-center bg-muted/20 border border-dashed border-border rounded-xl">
                                    <p className="text-sm font-medium text-foreground">No specific transfer departments configured</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">All human transfers will default to the general hotline below.</p>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingDepartment(true)}>
                                        <Plus className="w-4 h-4 mr-1" /> Add First Department
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kb.transferDepartments.map((dept, i) => (
                                        editingDepartmentIndex === i ? (
                                            /* Edit Department Form */
                                            <div key={i} className="p-4 bg-muted/40 border border-primary/40 rounded-xl space-y-3 animate-in fade-in-0 duration-200">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">Edit Department</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleUpdateDepartment}
                                                            disabled={!departmentForm.departmentName.trim()}
                                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                                                        >
                                                            <Check className="w-3.5 h-3.5 mr-1" /> Update
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingDepartmentIndex(null)}
                                                            className="h-8 px-2 text-xs"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <Label className="text-[11px]">Department / Role</Label>
                                                        <Input
                                                            value={departmentForm.departmentName}
                                                            onChange={e => setDepartmentForm({ ...departmentForm, departmentName: e.target.value })}
                                                            className="h-9 text-xs font-bold mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Direct Destination Phone</Label>
                                                        <Input
                                                            value={departmentForm.phoneNumber}
                                                            onChange={e => setDepartmentForm({ ...departmentForm, phoneNumber: e.target.value })}
                                                            className="h-9 text-xs mt-1 font-mono font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Transfer Type</Label>
                                                        <select
                                                            value={departmentForm.transferType || "warm_transfer"}
                                                            onChange={e => {
                                                                const val = e.target.value as 'cold_transfer' | 'warm_transfer';
                                                                setDepartmentForm({
                                                                    ...departmentForm,
                                                                    transferType: val,
                                                                    onHoldMusic: val === 'cold_transfer' ? 'none' : (departmentForm.onHoldMusic || 'relaxing_sound')
                                                                });
                                                            }}
                                                            className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                                                        >
                                                            <option value="warm_transfer">Warm Transfer (Hold Music + Announce)</option>
                                                            <option value="cold_transfer">Cold Transfer (Direct Forward)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px]">Hold Music (While Connecting)</Label>
                                                        <select
                                                            value={departmentForm.onHoldMusic || "relaxing_sound"}
                                                            onChange={e => {
                                                                const music = e.target.value as any;
                                                                setDepartmentForm({
                                                                    ...departmentForm,
                                                                    onHoldMusic: music,
                                                                    transferType: music === 'none' ? departmentForm.transferType : 'warm_transfer'
                                                                });
                                                            }}
                                                            className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                                                        >
                                                            <option value="relaxing_sound">🎵 Relaxing Sound (Ambient)</option>
                                                            <option value="uplifting_beats">🎶 Uplifting Beats (Modern)</option>
                                                            <option value="ringtone">🔔 Standard Ringtone</option>
                                                            <option value="none">🔇 None (Silence / Direct)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[11px]">When Should AI Route Here? (Keywords / Intent Triggers)</Label>
                                                    <Input
                                                        value={departmentForm.triggers}
                                                        onChange={e => setDepartmentForm({ ...departmentForm, triggers: e.target.value })}
                                                        className="h-9 text-xs mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* Clean Saved Card */
                                            <div key={i} className="p-4 bg-card border border-border/80 rounded-xl space-y-2.5 group hover:border-border transition-colors shadow-2xs">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                                            <PhoneForwarded className="w-4 h-4 text-indigo-500 shrink-0" />
                                                            {dept.departmentName}
                                                        </span>
                                                        {dept.phoneNumber && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                                                                <Phone className="w-3 h-3" /> {dept.phoneNumber}
                                                            </span>
                                                        )}
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/60">
                                                            {dept.transferType === "warm_transfer" ? "Warm Transfer" : "Cold Transfer"}
                                                        </span>
                                                        {dept.transferType === "warm_transfer" && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                                🎵 {dept.onHoldMusic === 'uplifting_beats' ? 'Uplifting Beats' : dept.onHoldMusic === 'ringtone' ? 'Ringtone' : dept.onHoldMusic === 'none' ? 'Silent Hold' : 'Relaxing Sound'}
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground bg-muted/70 border border-border/50">
                                                            Tool: {getSanitizedToolName(dept.departmentName, i)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleStartEditDepartment(i)}
                                                            title="Edit Department"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteDepartment(i)}
                                                            title="Delete Department"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {dept.triggers && (
                                                    <div className="pt-1">
                                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                                            AI Route Triggers / Keywords:
                                                        </span>
                                                        <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-xs text-foreground leading-relaxed">
                                                            {dept.triggers}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* General Escalations & Fallback Rules */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Phone className="w-4 h-4 text-primary" /> General Human Fallback & Scripting
                            </CardTitle>
                            <CardDescription>
                                Universal transfer destination and triggers when caller requests a human without specifying a department.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>General Fallback Destination Phone Number</Label>
                                <Input
                                    value={kb.humanTransferPhone}
                                    onChange={e => setKb({ ...kb, humanTransferPhone: e.target.value })}
                                    placeholder="+18002930354"
                                    className="max-w-xs font-semibold mt-1 font-mono"
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
                                    <div>
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">General Transfer Trigger Conditions</Label>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Rules instructing when to route callers to a general human representative.</p>
                                    </div>
                                    {!isAddingTransferTrigger && (
                                        <Button size="sm" variant="ghost" onClick={() => setIsAddingTransferTrigger(true)} className="gap-1 text-xs">
                                            <Plus className="w-3.5 h-3.5" /> Add Condition
                                        </Button>
                                    )}
                                </div>

                                {isAddingTransferTrigger && (
                                    <div className="p-3 mb-3 bg-muted/40 border border-primary/40 rounded-xl space-y-2 animate-in fade-in-0 duration-200">
                                        <Label className="text-xs font-semibold">New Transfer Trigger Condition</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newTransferTrigger}
                                                onChange={e => setNewTransferTrigger(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveTransferTrigger();
                                                    } else if (e.key === 'Escape') {
                                                        setIsAddingTransferTrigger(false);
                                                        setNewTransferTrigger("");
                                                    }
                                                }}
                                                placeholder="e.g. Caller specifically requests a manager or complains repeatedly"
                                                className="text-xs h-9 flex-1"
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleSaveTransferTrigger}
                                                disabled={!newTransferTrigger.trim()}
                                                className="h-9 px-3 text-xs bg-primary text-primary-foreground"
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setIsAddingTransferTrigger(false);
                                                    setNewTransferTrigger("");
                                                }}
                                                className="h-9 px-2 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {(!kb.humanTransferTriggers || kb.humanTransferTriggers.length === 0) && !isAddingTransferTrigger ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                                        No general transfer trigger conditions configured. Click <strong>+ Add Condition</strong> to create one.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {kb.humanTransferTriggers.map((trig, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground group hover:border-border transition-colors"
                                            >
                                                <div className="flex items-start gap-2.5 flex-1 pr-2">
                                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    <span className="leading-relaxed font-medium text-foreground">{trig}</span>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                                    onClick={() => handleArrayRemove("humanTransferTriggers", i)}
                                                    title="Delete Condition"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                <Button size="sm" variant="outline" onClick={() => copyToClipboard(liveCompiledPrompt)}>
                                    {copiedPrompt ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                    {copiedPrompt ? "Copied" : "Copy Prompt"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/70 p-4 rounded-xl border border-border font-mono text-[11px] leading-relaxed max-h-[350px] overflow-y-auto whitespace-pre-wrap select-all">
                                {liveCompiledPrompt}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 9. WEBHOOKS & DEPLOYMENT TAB (Developer Mode) */}
                {isDevelopment && (
                    <TabsContent value="webhooks" className="space-y-6 pt-4">
                        {/* Deployment Quick Overview Banner */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Active Webhook</p>
                                    <p className="text-xs font-bold text-foreground truncate">
                                        {(kb.webhookEnvironment || 'production') === 'production' ? '🚀 Production Server' : '🛠️ Ngrok Dev Tunnel'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Operating Timezone</p>
                                    <p className="text-xs font-bold text-foreground truncate">
                                        {(kb.timezone || 'America/New_York') === 'Asia/Kolkata' ? '🇮🇳 India Standard Time' : '🇺🇸 American Eastern Time'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                    <Radio className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Live Agent Clock</p>
                                    <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
                                        🟢 {formatTzTime(kb.timezone || 'America/New_York')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 1: Webhook Routing Destination Dropdown */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Globe className="w-5 h-5 text-emerald-500" /> Retell AI Webhook Destination
                                        </CardTitle>
                                        <CardDescription>
                                            Select the backend endpoint where Retell AI sends live call transcripts, recordings, and after-hours voicemail events.
                                        </CardDescription>
                                    </div>
                                    <Badge 
                                        variant="outline" 
                                        className={`text-xs flex items-center gap-1 ${
                                            (kb.webhookEnvironment || 'production') === 'production'
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                        }`}
                                    >
                                        {(kb.webhookEnvironment || 'production') === 'production' ? (
                                            <>🚀 Production Active</>
                                        ) : (
                                            <>🛠️ Dev Tunnel Active</>
                                        )}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-foreground">Webhook Destination Environment</Label>
                                    <select
                                        value={kb.webhookEnvironment || "production"}
                                        onChange={(e) => {
                                            const env = e.target.value as 'production' | 'development';
                                            if (env === 'production') {
                                                setKb({ ...kb, webhookEnvironment: 'production', webhookUrl: 'https://api.yauapp.com/api/retell/webhook' });
                                            } else {
                                                setKb({ ...kb, webhookEnvironment: 'development' });
                                            }
                                        }}
                                        className="w-full h-11 px-3.5 py-2 text-sm bg-background border border-input rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-all cursor-pointer shadow-sm"
                                    >
                                        <option value="production">🚀 Production Server (https://api.yauapp.com/api/retell/webhook) — Active Default</option>
                                        <option value="development">🛠️ Local Development / Custom Ngrok Tunnel</option>
                                    </select>
                                </div>

                                {(kb.webhookEnvironment || 'production') === 'production' ? (
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                <Check className="w-3.5 h-3.5" /> Live Production Endpoint Configured
                                            </span>
                                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                Standard Routing
                                            </Badge>
                                        </div>
                                        <p className="text-xs font-mono text-muted-foreground pt-0.5">
                                            https://api.yauapp.com/api/retell/webhook
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/80">
                                            All incoming calls, live transcripts, and voicemail recordings will be securely delivered to your primary production CRM server.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <Link2 className="w-3.5 h-3.5 text-amber-500" /> Custom Ngrok Webhook Endpoint URL
                                            </Label>
                                            <span className="text-[11px] text-muted-foreground">Must end with <code>/api/retell/webhook</code></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={kb.customWebhookUrl || ""}
                                                onChange={e => setKb({ ...kb, customWebhookUrl: e.target.value, webhookUrl: e.target.value })}
                                                placeholder="https://1234-abcd.ngrok-free.app/api/retell/webhook"
                                                className="font-mono text-xs h-10 bg-background"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const sample = window.location.origin.includes('localhost') 
                                                        ? 'https://api.yauapp.com/api/retell/webhook'
                                                        : `${window.location.origin}/api/retell/webhook`;
                                                    setKb({ ...kb, customWebhookUrl: sample, webhookUrl: sample });
                                                }}
                                                className="text-xs shrink-0 h-10"
                                            >
                                                Reset Default
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                            💡 When you click <strong>Save & Sync to Retell AI</strong>, this exact URL will be uploaded to your Retell Agent settings for local live testing.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* SECTION 2: Retell AI Operating Timezone Dropdown */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-indigo-500" /> Retell AI Operating Timezone
                                        </CardTitle>
                                        <CardDescription>
                                            Select the primary timezone evaluated by Retell AI for real-time operating hours (9:00 AM – 5:00 PM) and after-hours call routing.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="text-xs font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                                        Variable: <code>{`{{current_time_${kb.timezone || 'America/New_York'}}}`}</code>
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-foreground">Active Operating Timezone</Label>
                                    <select
                                        value={kb.timezone || "America/New_York"}
                                        onChange={e => setKb({ ...kb, timezone: e.target.value })}
                                        className="w-full h-11 px-3.5 py-2 text-sm bg-background border border-input rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-all cursor-pointer shadow-sm"
                                    >
                                        {TIMEZONE_OPTIONS.map((tz) => (
                                            <option key={tz.id} value={tz.id}>
                                                {tz.flag} {tz.name} — ({tz.region}) {tz.id === 'America/New_York' ? '— Default' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Active Timezone Live Info Banner */}
                                <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">
                                                {TIMEZONE_OPTIONS.find(t => t.id === (kb.timezone || 'America/New_York'))?.flag || '🇺🇸'}
                                            </span>
                                            <div>
                                                <span className="text-xs font-bold text-foreground block">
                                                    {TIMEZONE_OPTIONS.find(t => t.id === (kb.timezone || 'America/New_York'))?.name}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {TIMEZONE_OPTIONS.find(t => t.id === (kb.timezone || 'America/New_York'))?.region}
                                                </span>
                                            </div>
                                        </div>

                                        <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border-indigo-500/30 self-start sm:self-auto">
                                            🕒 Live Time: {formatTzTime(kb.timezone || 'America/New_York')}
                                        </Badge>
                                    </div>

                                    <div className="pt-2 border-t border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground">
                                        <span>
                                            Injected Retell Prompt Variable: <strong className="font-mono text-foreground">{`{{current_time_${kb.timezone || 'America/New_York'}}}`}</strong>
                                        </span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                            ✓ Real-time Business Hours Synced
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

function getSanitizedToolName(deptName: string, index: number = 0): string {
    const raw = (deptName || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const clean = raw.slice(0, 30);
    return clean ? `transfer_to_${clean}` : `transfer_to_dept_${index}`;
}

function buildUniversalPrompt(kb: RetellKnowledgeBaseData): string {
    const personalityTraitsStr = (kb.personalityTraits || [])
        .map(t => `- **${t}**`)
        .join('\n');

    const toneRulesStr = (kb.toneRules || [])
        .map(r => `- ${r}`)
        .join('\n');

    const differentiatorsStr = (kb.differentiators || [])
        .map((d, i) => `  ${i + 1}. **${d.split('—')[0]?.trim()}**: ${d}`)
        .join('\n');

    const sportsStr = (kb.sportsPrograms || [])
        .map((s, i) => `${i + 1}. ${s.emoji || '⚽'} **${s.name}** (${s.grades || 'K – 8th Grade'}): ${s.description}`)
        .join('\n');

    const locationsTable = (kb.locations || []).map(loc =>
        `| **${loc.name}** | ${loc.school} | ${loc.practiceDays} | ${loc.practiceTime || '6:00 PM – 7:30 PM'} |`
    ).join('\n');

    const faqsStr = (kb.faqs || []).map((faq, i) =>
        `${i + 1}. **"${faq.question}"**\n   *"${faq.answer}"*`
    ).join('\n\n');

    const objectionsStr = (kb.objections || []).map(obj =>
        `- **"${obj.trigger}"**:\n  *"${obj.response}"*`
    ).join('\n\n');

    const triggersStr = (kb.humanTransferTriggers || [])
        .map((t, i) => `${i + 1}. ${t}`)
        .join('\n');

    let pricingStr = '';
    if (kb.pricingPlans && kb.pricingPlans.length > 0) {
        pricingStr = kb.pricingPlans.map((plan, i) => {
            const intervalText = plan.interval ? ` / ${plan.interval}` : '';
            const recText = plan.isRecommended ? ' (Recommended)' : '';
            return `${i + 1}. **${plan.name} — $${plan.price}${intervalText}${recText}**:\n   - ${plan.includes || 'Features and details as described'}`;
        }).join('\n\n');
    } else {
        pricingStr = `1. **Monthly Membership — $${kb.monthlyPrice || 50} / month (Recommended)**:\n   - ${kb.monthlyIncludes || 'All 4 sports (soccer, basketball, flag football, cheer) — rotate anytime. No re-registration fees.'}\n   - Uniforms are purchased separately.\n\n2. **Seasonal Fee — $${kb.seasonalPrice || 200} / season**:\n   - ${kb.seasonalIncludes || 'Covers one specific sport for 3–4 months. Uniform included.'}`;
    }

    const departments = (kb.transferDepartments && kb.transferDepartments.length > 0)
        ? kb.transferDepartments
        : [
            {
                departmentName: 'Executive Management & Escalations',
                phoneNumber: '+12027013900',
                triggers: 'Director requests, serious complaints, special circumstance reviews, escalations',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            },
            {
                departmentName: 'Program Coordination & Support',
                phoneNumber: '+12023413778',
                triggers: 'Registration assistance, schedule questions, team assignment, general program support',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            }
        ];

    const departmentRoutingLines = departments.map((dept, i) => {
        const toolName = getSanitizedToolName(dept.departmentName, i);
        return `- **${dept.departmentName}** (Tool: \`${toolName}\`):\n  - **Topic / Triggers**: ${dept.triggers || 'General department requests'}\n  - **Action**: Speak warm transfer script and invoke tool \`${toolName}\` seamlessly in the background. DO NOT recite the destination phone number to the caller.`;
    }).join('\n\n');

    const businessHours = kb.businessHours || {
        enabled: true,
        timezone: 'America/New_York',
        monFri: '9:00 AM – 5:00 PM',
        sat: '10:00 AM – 2:00 PM',
        sun: 'Closed'
    };

    const activeTz = kb.timezone || businessHours.timezone || 'America/New_York';
    let tzLabel = 'Eastern Time (ET)';
    if (activeTz === 'Asia/Kolkata') tzLabel = 'India Standard Time (IST)';
    else if (activeTz === 'America/Chicago') tzLabel = 'Central Time (CT)';
    else if (activeTz === 'America/Los_Angeles') tzLabel = 'Pacific Time (PT)';

    const afterHoursScript = kb.afterHoursScript || 
        "Thanks for calling Youth Athlete University! Our team is currently unavailable as our office is closed (open Monday to Friday 9 to 5, Saturdays 10 to 2, Sundays closed). I would love to answer your questions, or I can take a message and have someone from our team reach out during business hours.";

    const takeMessageScript = kb.takeMessageScript ||
        "It looks like our team member is currently assisting another parent. I can take down your name and what you are calling about, and have them get back to you promptly.";

    const rawPrompt = `# YOUTH ATHLETE UNIVERSITY (Y.A.U.) — VOICE AGENT OPERATING INSTRUCTIONS

## 🕒 LIVE CURRENT DATE & TIME (REAL-TIME CONTEXT)
The live current date and time right now is: **{{current_time_${activeTz}}}** (${tzLabel}).
Always evaluate this live timestamp to determine whether the call is taking place during standard business hours or after-hours.

## 1. IDENTITY, ROLE & MANDATORY PRONUNCIATION (CRITICAL)
You are a warm, enthusiastic, and knowledgeable team member representing Youth Athlete University (phonetic pronunciation: **"Why-Ay-You"** or **"Y. A. U."**). You speak directly with parents and families over the phone.

- **STRICT PRONUNCIATION & ENUNCIATION RULES (MANDATORY)**:
  1. **NEVER PRONOUNCE "YAU" AS A SINGLE BLENDED WORD** like "Yao", "Yowl", or "Yaw". It is strictly an acronym for Youth Athlete University.
  2. **ALWAYS pronounce the acronym as three distinct, separated letters**: **"Why - Ay - You"** (or speak the full name **"Youth Athlete University"**).
  3. **IN ALL YOUR TEXT AND SPEECH OUTPUTS**: Whenever referring to our organization's short name, ALWAYS format it with periods as **"Y.A.U."** or write out **"Youth Athlete University"**. NEVER output the raw letters "YAU" without punctuation, so the speech engine pronounces each individual letter distinctly every single time.
${personalityTraitsStr}

## 2. CONVERSATIONAL TONE RULES
${toneRulesStr}
- **SILENT TRANSFER RULE (STRICT)**: When transferring a caller, NEVER announce, read out, or recite phone number digits. Simply say the warm transfer script and execute the transfer tool directly in the background.
- **GOLDEN RULE**: ${kb.goldenRule || 'Every caller is a potential family for life.'}

---

## 3. LIVE BUSINESS HOURS & STRICT AFTER-HOURS GUARDRAILS (CRITICAL)
- **Live Operating Schedule (${tzLabel})**:
  - **Monday – Friday**: **${businessHours.monFri}**
  - **Saturday**: **${businessHours.sat}**
  - **Sunday**: **${businessHours.sun}**

- **AFTER-HOURS CALL HANDLING & TRANSFER RESTRICTION (MANDATORY)**:
  - Check the live current timestamp **{{current_time_${activeTz}}}**.
  - If the current time is **BEFORE 9:00 AM**, **AFTER 5:00 PM** (Monday–Friday), **BEFORE 10:00 AM** or **AFTER 2:00 PM** (Saturday), or anytime on **Sunday**:
    1. **STRICT TRANSFER GUARDRAIL**: **DO NOT INVOKE ANY TRANSFER TOOLS** (\`transfer_to_...\` or \`transfer_to_human\`). Our human staff are off-duty and cannot take live calls.
    2. **Acknowledge Closed Hours Immediately**:
       *"${afterHoursScript}"*
    3. **If the Caller Requests a Human Transfer / Staff Member During After-Hours**:
       - Politely explain that human staff are off for the day and unavailable for live transfers.
       - Transition directly to taking a message:
       *"Our staff are currently off for the day, but I can take your name and what you need help with right now, and our team will call you back first thing tomorrow morning!"*
    4. **Message Taking Protocol**:
       - Ask for the caller's **Name** and **what they need help with**. (Do NOT ask for their phone number since our system records their caller ID automatically).
       - Reassure them that our staff will review the message and follow up promptly.

---

## 4. UNATTENDED TRANSFER & MESSAGE TAKING PROTOCOL
- **When a Call Forward / Transfer Fails or Staff is Unavailable During Business Hours**:
  - If you initiate a transfer during open business hours and the department or staff member does not attend or answer:
  - Politely state: *"${takeMessageScript}"*
  - **If the caller agrees and leaves a message**:
    - Ask for the caller's **Name** and **What they are inquiring about**. (Do NOT ask for their phone number since our system logs caller ID automatically).
    - Assure them: *"Thank you [Name]! I have logged your message and our team will call you back directly."*
  - **If the caller declines or refuses to leave a message** (e.g. says "no thanks", "I'll call back later", "never mind", "I don't want to leave a message"):
    - Politely say: *"No problem at all! Feel free to call us back whenever it is convenient for you. Have a wonderful day!"*
    - **Immediately invoke the end_call tool** to terminate the call.

---

## 5. ABOUT Y.A.U. — STORY, MISSION & DIFFERENTIATORS
- **Who We Are**: ${kb.organizationName || 'Youth Athlete University'} is a 501(c)(3) nonprofit organization located in Fort Washington, Maryland.
- **Motto**: "${kb.motto || 'Where Parents Trust Us. Kids Have Fun and Athletic Skills Improve.'}"
- **Core Belief**: ${kb.mission || 'Every child deserves access to quality sports that build character, confidence, and discipline.'}
- **What Sets Y.A.U. Apart**:
${differentiatorsStr}
- **Contact Info**: Email: ${kb.contactEmail || 'team@yausports.com'} | Web: ${kb.contactWebsite || 'youthathleteuniversity.org'}
- **SILENT NUMBER RULE**: NEVER speak or recite a phone number or 800-number digits to the caller. Transfers are executed silently in the background.

---

## 6. SPORTS PROGRAMS & GRADE LEVEL RULES
Y.A.U. offers programs for children in **Kindergarten through 8th Grade**.
**CRITICAL RULE**: Teams are organized strictly by **GRADE LEVEL**, not age. If a parent mentions age, ask: *"Great! And what grade is your child in? We organize all our teams by grade level so kids are with their peers."*

${sportsStr}

---

## 7. PRACTICE LOCATIONS, SCHEDULES & EXPANSION
All evening practices run from **6:00 PM to 7:30 PM** across our DC metro locations:

| Location | Facility / School | Practice Days | Time |
| :--- | :--- | :--- | :--- |
${locationsTable}

- **Games & Weekends**: ${kb.gameSchedule || 'Games are held on Saturdays, with some Sunday afternoon games starting around 1:00 PM to respect church schedules.'}
- **If Caller is Outside These Areas**: Say: *"${kb.outOfAreaScript || 'We are actively growing! Let me take down your contact info so we can notify you when we open in your community.'}"*

---

## 8. PRICING & MEMBERSHIP OPTIONS
Always present recommended membership plans first as the best value for families:

${pricingStr}

### STRICT REFUND POLICY
- ${kb.refundPolicy || 'Youth Athlete University has a strict NO REFUND policy. NEVER promise a refund. Always connect to a human team member for special circumstance reviews.'}
- Refund Script: *"${kb.refundHandlingScript || 'Our standard policy is non-refundable, but let me connect you with one of our team members who can personally review your situation.'}"*

---

## 9. CALL FLOW SCRIPTS & CONVERSATION GUIDANCE
- **Opening**: *"${kb.inboundOpeningScript || 'Thank you for calling Youth Athlete University! This is Cimo — how can I help you and your athlete today?'}"*
- **Hesitant / Exploring**: *"${kb.hesitantCallerScript || 'No worries at all, take your time! I am happy to walk you through everything.'}"*
- **Positive Close**: *"${kb.positiveCloseScript || 'It was so wonderful speaking with you! We can not wait to welcome your athlete into the Youth Athlete University family.'}"*
- **Think About It Close**: *"${kb.thinkAboutItCloseScript || 'Take all the time you need! I can send our complete info packet to your email.'}"*
- **Voicemail Script**: *"${kb.voicemailScript || 'Hi, this message is from Youth Athlete University! We would love to connect with you regarding our youth sports programs.'}"*

---

## 10. FREQUENTLY ASKED QUESTIONS
${faqsStr}

---

## 11. OBJECTION HANDLING GUIDELINES
${objectionsStr}

---

## 12. SPECIAL SITUATIONS & DEPARTMENT ROUTING RULES
- **Cancellation Requests**: *"${kb.cancellationHandlingScript || 'I am sorry to hear you are thinking of cancelling. Let me connect you with a team member who can help.'}"*
- **After-School Programs**: *"${kb.afterSchoolScript || 'After-school programs vary by school. Please check directly with your school front office or I can have our coordinator reach out.'}"*

### Department-Specific Transfer Routing:
Whenever a caller inquires about a specific topic during open business hours, route to the corresponding department:

${departmentRoutingLines}

### Immediate Human Transfer Triggers (DURING OPEN BUSINESS HOURS ONLY):
Politely initiate a transfer to a human team member for:
${triggersStr}

**Warm Transfer Script**:
*"${kb.warmTransferScript || 'That is a great question and I want to make sure you get the exact right answer. Let me connect you with one of our team members right now — one moment please!'}"*

---

## 13. CALL CONTROL & TOOL EXECUTION RULES (CRITICAL)
- **Topic-Based Call Transfers (DURING OPEN BUSINESS HOURS ONLY)**:
  - First, check the live current timestamp **{{current_time_${activeTz}}}**.
  - **If AFTER-HOURS or CLOSED**: **DO NOT EXECUTE ANY TRANSFER TOOLS**. Explain the office is closed and take a message.
  - **If OPEN (During Business Hours)**: When the caller's request matches a specific department topic above or explicitly asks for a human, speak the warm transfer script and **invoke the matching transfer tool** (e.g. \`transfer_to_...\` or \`transfer_to_human\`).
  - DO NOT announce any telephone numbers to the caller.
- **Ending & Cancelling Calls (end_call)**:
  - Whenever the caller says goodbye, asks to hang up, says *"please cancel the call"*, *"hang up"*, *"cut the call"*, *"that is all"*, or indicates the conversation has finished:
  - Respond with a brief, friendly goodbye: *"${kb.positiveCloseScript || 'Thank you for calling Youth Athlete University! Have a wonderful day!'}"*
  - **IMMEDIATELY invoke the end_call tool** to terminate the phone call.
`;

    // Sanitize any remaining unpunctuated YAU instances to ensure TTS spells each letter individually
    return rawPrompt
        .replace(/\bYAU\b/g, 'Y.A.U.')
        .replace(/\bY-A-U\b/g, 'Y.A.U.');
}
