import { useState, useRef, useEffect, useCallback } from "react";
import api from "../../api/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Sparkles,
    FileText,
    CalendarCheck,
    RotateCcw,
    RotateCw,
    Bold,
    Italic,
    Underline,
    Type,
    Highlighter,
    Palette,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link as LinkIcon,
    Trash2,
    Check,
    Loader2,
    ChevronDown,
    Tag,
    HelpCircle,
    AlertTriangle,
    Cloud
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivityReportItem } from "./ClaudeFeedbackCard";

interface ReportSubmissionCardProps {
    onReportSubmitted: (report: ActivityReportItem) => void;
}

export default function ReportSubmissionCard({ onReportSubmitted }: ReportSubmissionCardProps) {
    const [reportType, setReportType] = useState<"daily" | "weekly">("daily");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [wordCount, setWordCount] = useState(0);

    // Cloud draft sync states
    const [isCloudSaving, setIsCloudSaving] = useState(false);
    const [isCloudLoading, setIsCloudLoading] = useState(false);
    const [lastCloudSaved, setLastCloudSaved] = useState<Date | null>(null);
    const [isWaterFilling, setIsWaterFilling] = useState(false);
    const [isWaterSplashing, setIsWaterSplashing] = useState(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Editor refs & state
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [history, setHistory] = useState<string[]>([""]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const isHistoryAction = useRef(false);

    // Toolbar formatting state
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        fontSize: "",
        h1: false,
        h2: false,
        h3: false,
        p: false,
        ul: false,
        ol: false,
        alignLeft: false,
        alignCenter: false,
        alignRight: false
    });

    const [isHighlighterOpen, setIsHighlighterOpen] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [showGuidance, setShowGuidance] = useState(true);

    const isDaily = reportType === "daily";

    // Update active toolbar formatting on selection change
    const updateActiveFormats = useCallback(() => {
        if (!editorRef.current) return;
        try {
            setActiveFormats({
                bold: document.queryCommandState("bold"),
                italic: document.queryCommandState("italic"),
                underline: document.queryCommandState("underline"),
                fontSize: document.queryCommandValue("fontSize") || "",
                h1: document.queryCommandValue("formatBlock") === "h1",
                h2: document.queryCommandValue("formatBlock") === "h2",
                h3: document.queryCommandValue("formatBlock") === "h3",
                p: document.queryCommandValue("formatBlock") === "p",
                ul: document.queryCommandState("insertUnorderedList"),
                ol: document.queryCommandState("insertOrderedList"),
                alignLeft: document.queryCommandState("justifyLeft"),
                alignCenter: document.queryCommandState("justifyCenter"),
                alignRight: document.queryCommandState("justifyRight")
            });
        } catch {
            // queryCommandState may fail if element not focused
        }

        // Update counts
        const text = editorRef.current.innerText || "";
        setCharCount(text.trim().length);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        setWordCount(words);
    }, []);

    // Push state to undo/redo history
    const pushHistory = (html: string) => {
        if (isHistoryAction.current) {
            isHistoryAction.current = false;
            return;
        }
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            if (next[next.length - 1] !== html) {
                next.push(html);
            }
            return next;
        });
        setHistoryIndex(prev => prev + 1);
    };

    // Execute standard execCommand formatting
    const execFormat = (command: string, value: string | undefined = undefined) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
        updateActiveFormats();
        pushHistory(editorRef.current.innerHTML || "");
    };

    const handleUndo = () => {
        if (historyIndex <= 0 || !editorRef.current) return;
        isHistoryAction.current = true;
        const newIndex = historyIndex - 1;
        const html = history[newIndex] || "";
        editorRef.current.innerHTML = html;
        setHistoryIndex(newIndex);
        updateActiveFormats();
    };

    const handleRedo = () => {
        if (historyIndex >= history.length - 1 || !editorRef.current) return;
        isHistoryAction.current = true;
        const newIndex = historyIndex + 1;
        const html = history[newIndex] || "";
        editorRef.current.innerHTML = html;
        setHistoryIndex(newIndex);
        updateActiveFormats();
    };

    // Apply custom font size
    const applyCustomFontSize = (sizePx: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand("fontSize", false, "7"); // dummy size
        const fontElements = editorRef.current.getElementsByTagName("font");
        for (let i = 0; i < fontElements.length; i++) {
            if (fontElements[i].size === "7") {
                fontElements[i].removeAttribute("size");
                fontElements[i].style.fontSize = sizePx;
            }
        }
        updateActiveFormats();
        pushHistory(editorRef.current.innerHTML || "");
    };

    // Quick tag insertion helper
    const insertSectionTag = (title: string, bulletText = "") => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        const htmlToInsert = `<h3 style="font-weight: 800; font-size: 14px; margin-top: 10px; margin-bottom: 4px; color: #3b82f6;">${title}</h3><ul><li>${bulletText || "..."}</li></ul><p></p>`;
        document.execCommand("insertHTML", false, htmlToInsert);
        updateActiveFormats();
        pushHistory(editorRef.current.innerHTML || "");
    };

    // Load saved cloud draft for a specific reportType from MongoDB
    const loadCloudDraft = useCallback(async (type: "daily" | "weekly") => {
        setIsCloudLoading(true);
        try {
            const res = await api.get(`/activity-reports/draft?reportType=${type}`);
            if (res.data?.success && res.data?.draft && res.data.draft.content) {
                const savedContent = res.data.draft.content;
                if (editorRef.current) {
                    editorRef.current.innerHTML = savedContent;
                    updateActiveFormats();
                    setHistory([savedContent]);
                    setHistoryIndex(0);
                }
                if (res.data.draft.updatedAt) {
                    setLastCloudSaved(new Date(res.data.draft.updatedAt));
                }
            } else {
                if (editorRef.current) {
                    editorRef.current.innerHTML = "";
                    updateActiveFormats();
                    setHistory([""]);
                    setHistoryIndex(0);
                }
                setLastCloudSaved(null);
            }
        } catch (err: any) {
            console.error("Failed to load cloud draft:", err);
        } finally {
            setIsCloudLoading(false);
        }
    }, [updateActiveFormats]);

    // Save current content as draft to cloud MongoDB
    const saveCloudDraft = async (showToast = true) => {
        if (!editorRef.current) return;
        const htmlContent = editorRef.current.innerHTML || "";
        const plainText = editorRef.current.innerText?.trim() || "";

        if (!plainText) {
            if (showToast) {
                toast.info("Please write some content first before saving to cloud.");
            }
            return;
        }

        setIsCloudSaving(true);
        if (showToast) {
            setIsWaterFilling(true);
        }

        const animationPromise = showToast
            ? new Promise(resolve => setTimeout(resolve, 850))
            : Promise.resolve();

        try {
            const [res] = await Promise.all([
                api.post("/activity-reports/draft", {
                    reportType,
                    content: htmlContent
                }),
                animationPromise
            ]);

            if (res.data?.success) {
                const savedAt = new Date();
                setLastCloudSaved(savedAt);
                if (showToast) {
                    setIsWaterSplashing(true);
                    setTimeout(() => setIsWaterSplashing(false), 500);
                    toast.success("Draft saved to cloud! Your report is safe even if you refresh.");
                }
            }
        } catch (err: any) {
            console.error("Failed to save cloud draft:", err);
            if (showToast) {
                toast.error("Could not save draft to cloud. Please try again.");
            }
        } finally {
            setIsCloudSaving(false);
            setIsWaterFilling(false);
        }
    };

    // Delete cloud draft from MongoDB
    const deleteCloudDraft = async () => {
        try {
            await api.delete(`/activity-reports/draft?reportType=${reportType}`);
            setLastCloudSaved(null);
        } catch (err: any) {
            console.error("Failed to delete cloud draft:", err);
        }
    };

    // Switch report type safely, saving in-progress draft first
    const handleSwitchReportType = async (newType: "daily" | "weekly") => {
        if (newType === reportType) return;
        if (editorRef.current && editorRef.current.innerText?.trim()) {
            await saveCloudDraft(false);
        }
        setReportType(newType);
    };

    // Load draft on mount and when reportType changes
    useEffect(() => {
        loadCloudDraft(reportType);
    }, [reportType, loadCloudDraft]);

    // Cleanup auto-save timer on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    const handleClearClick = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText?.trim() || "";
        if (!text) {
            toast.info("The editor is already empty.");
            return;
        }
        setIsClearDialogOpen(true);
    };

    const handleConfirmClear = async () => {
        if (!editorRef.current) return;
        editorRef.current.innerHTML = "";
        pushHistory("");
        updateActiveFormats();
        setIsClearDialogOpen(false);
        await deleteCloudDraft();
        toast.success("Editor canvas & cloud draft cleared.");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editorRef.current) return;

        // Cancel any pending debounced auto-save timer immediately
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        const htmlContent = editorRef.current.innerHTML || "";
        const plainText = editorRef.current.innerText || "";

        if (!plainText.trim()) {
            toast.error("Please enter your activity report before submitting.");
            return;
        }

        if (plainText.trim().length < 20) {
            toast.error("Please provide a bit more detail in your report (at least 20 characters).");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post("/activity-reports", {
                reportType,
                rawContent: htmlContent // Send rich formatted HTML
            });

            if (res.data?.success && res.data?.report) {
                toast.success(
                    res.data.report.aiFeedback?.performanceScore != null
                        ? `Report submitted! Claude scored your performance: ${res.data.report.aiFeedback.performanceScore}/10`
                        : "Report submitted! Claude is analyzing your activity in the background..."
                );

                // 1. Fully empty editor canvas
                editorRef.current.innerHTML = "";

                // 2. Reset counters & undo history
                setCharCount(0);
                setWordCount(0);
                setHistory([""]);
                setHistoryIndex(0);
                updateActiveFormats();

                // 3. Reset cloud state & delete draft in MongoDB
                setLastCloudSaved(null);
                await deleteCloudDraft();

                // 4. Trigger parent feed refresh
                onReportSubmitted(res.data.report);
            } else {
                toast.success("Report submitted successfully!");
            }
        } catch (err: any) {
            console.error("Submission failed:", err);
            const msg = err.response?.data?.message || "Failed to submit activity report. Please try again.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const dailyTags = [
        { label: "🎯 Calls & Outreach", bullet: "Called 8 leads — 3 answered, 2 interested" },
        { label: "💬 Follow-ups", bullet: "Scheduled Wednesday follow-up with interested parent" },
        { label: "🏆 Wins & Signups", bullet: "Sent registration link to 2 confirmed athletes" },
        { label: "⚠️ Blockers / Challenges", bullet: "Low answer rate in Bowie area during afternoon" },
        { label: "📌 Next Day Focus", bullet: "Test 6-7 PM evening calls for Bowie zip codes" }
    ];

    const weeklyTags = [
        { label: "📊 Weekly Summary", bullet: "Total 45 leads contacted this week, 6 new signups" },
        { label: "🏆 Key Wins", bullet: "Closed partnership with regional youth club" },
        { label: "⚠️ Challenges", bullet: "Weekend tournament lead responsiveness was low" },
        { label: "🎯 Goals for Next Week", bullet: "Focus on re-engaging stalled warm leads" }
    ];

    const currentTags = isDaily ? dailyTags : weeklyTags;

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-5 transition-all">
            {/* Tier 1 Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                        <FileText size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold tracking-tight">Submit Activity Report</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Type or paste your report using the rich text editor. Claude will read and evaluate your activity in seconds.
                        </p>
                    </div>
                </div>

                {/* Daily / Weekly Switcher */}
                <div className="flex items-center bg-accent/60 border p-0.5 rounded-xl text-xs shrink-0 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => handleSwitchReportType("daily")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            isDaily ? "bg-card text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <CalendarCheck size={13} className={isDaily ? "text-blue-500" : ""} />
                        Daily Report
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchReportType("weekly")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                            !isDaily ? "bg-card text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Sparkles size={13} className={!isDaily ? "text-purple-500" : ""} />
                        Weekly Report
                    </button>
                </div>
            </div>

            {/* Quick Section Preset Pills */}
            <div className="py-2.5 border-b border-border/40 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
                    <Tag size={11} className="text-primary" /> Insert Section:
                </span>
                {currentTags.map((tag, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => insertSectionTag(tag.label, tag.bullet)}
                        className="text-[11px] font-semibold bg-accent/60 hover:bg-accent border border-border/60 text-foreground px-2.5 py-1 rounded-xl transition-all cursor-pointer hover:border-primary/40 shadow-2xs"
                    >
                        {tag.label}
                    </button>
                ))}
            </div>

            {/* Editor Container with Border & Toolbar */}
            <div className="mt-3 rounded-2xl border border-border bg-background/50 overflow-hidden shadow-2xs flex flex-col">
                {/* ── Rich Text Formatting Toolbar ──────────────────────────────────────── */}
                <div className="flex items-center gap-1 px-3 py-2 border-b bg-card shrink-0 flex-wrap relative select-none">
                    {/* Group 1: Undo / Redo */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            title="Undo (Ctrl+Z)"
                            className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <RotateCcw size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            title="Redo (Ctrl+Y)"
                            className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <RotateCw size={12} />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 2: Bold, Italic, Underline */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("bold")}
                            title="Bold (Ctrl+B)"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.bold ? "bg-primary text-primary-foreground shadow-2xs font-bold" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Bold size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("italic")}
                            title="Italic (Ctrl+I)"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.italic ? "bg-primary text-primary-foreground shadow-2xs font-bold" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Italic size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("underline")}
                            title="Underline (Ctrl+U)"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.underline ? "bg-primary text-primary-foreground shadow-2xs font-bold" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Underline size={12} />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 3: Font Size Selector */}
                    <div className="flex items-center gap-1 bg-accent/40 px-2 py-0.5 rounded-lg border border-border/50">
                        <Type size={11} className="text-muted-foreground shrink-0" />
                        <select
                            value={activeFormats.fontSize || ""}
                            onChange={e => {
                                if (e.target.value) applyCustomFontSize(e.target.value);
                            }}
                            title="Font Size"
                            className="h-6 text-xs bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                        >
                            <option value="">Size</option>
                            <option value="12px">12px (Small)</option>
                            <option value="14px">14px (Normal)</option>
                            <option value="16px">16px (Medium)</option>
                            <option value="18px">18px (Large)</option>
                            <option value="20px">20px (XL)</option>
                            <option value="24px">24px (2XL)</option>
                        </select>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 4: Headings */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("formatBlock", "<h1>")}
                            title="Heading 1"
                            className={`h-7 px-2 rounded-md text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.h1 ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            H1
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("formatBlock", "<h2>")}
                            title="Heading 2"
                            className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.h2 ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            H2
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("formatBlock", "<h3>")}
                            title="Heading 3"
                            className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.h3 ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            H3
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("formatBlock", "<p>")}
                            title="Paragraph"
                            className={`h-7 px-2 rounded-md text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.p ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            P
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 5: Colors */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        {/* Highlighter Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    setIsHighlighterOpen(!isHighlighterOpen);
                                    setIsColorPickerOpen(false);
                                }}
                                title="Highlight Color"
                                className="h-7 px-1.5 rounded-md hover:bg-background flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs"
                            >
                                <Highlighter size={12} className="text-amber-500" />
                                <ChevronDown size={10} />
                            </button>
                            {isHighlighterOpen && (
                                <div className="absolute top-full left-0 mt-1.5 p-2 bg-popover border rounded-xl shadow-lg z-50 flex items-center gap-1.5 backdrop-blur-md">
                                    {[
                                        { color: "#fef08a", name: "Yellow" },
                                        { color: "#bbf7d0", name: "Green" },
                                        { color: "#bfdbfe", name: "Blue" },
                                        { color: "#fed7aa", name: "Orange" },
                                        { color: "#fbcfe8", name: "Pink" },
                                        { color: "transparent", name: "None" }
                                    ].map(c => (
                                        <button
                                            key={c.color}
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => {
                                                execFormat("hiliteColor", c.color);
                                                setIsHighlighterOpen(false);
                                            }}
                                            title={c.name}
                                            className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                                            style={{ backgroundColor: c.color === "transparent" ? "#ffffff" : c.color }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Text Color Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    setIsColorPickerOpen(!isColorPickerOpen);
                                    setIsHighlighterOpen(false);
                                }}
                                title="Text Color"
                                className="h-7 px-1.5 rounded-md hover:bg-background flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs"
                            >
                                <Palette size={12} className="text-blue-500" />
                                <ChevronDown size={10} />
                            </button>
                            {isColorPickerOpen && (
                                <div className="absolute top-full left-0 mt-1.5 p-2 bg-popover border rounded-xl shadow-lg z-50 flex items-center gap-1.5 backdrop-blur-md">
                                    {[
                                        { color: "#0f172a", name: "Default Dark" },
                                        { color: "#2563eb", name: "Blue" },
                                        { color: "#059669", name: "Emerald" },
                                        { color: "#dc2626", name: "Red" },
                                        { color: "#7c3aed", name: "Purple" },
                                        { color: "#d97706", name: "Amber" }
                                    ].map(c => (
                                        <button
                                            key={c.color}
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => {
                                                execFormat("foreColor", c.color);
                                                setIsColorPickerOpen(false);
                                            }}
                                            title={c.name}
                                            className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                                            style={{ backgroundColor: c.color }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 6: Lists */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("insertUnorderedList")}
                            title="Bullet List"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.ul ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <List size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("insertOrderedList")}
                            title="Numbered List"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.ol ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <ListOrdered size={12} />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 7: Alignment */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("justifyLeft")}
                            title="Align Left"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.alignLeft ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <AlignLeft size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("justifyCenter")}
                            title="Align Center"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.alignCenter ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <AlignCenter size={12} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => execFormat("justifyRight")}
                            title="Align Right"
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                activeFormats.alignRight ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <AlignRight size={12} />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Group 8: Links */}
                    <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                const url = prompt("Enter URL link (e.g. https://example.com):");
                                if (url) {
                                    const formatted = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
                                    execFormat("createLink", formatted);
                                }
                            }}
                            title="Insert Link"
                            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <LinkIcon size={12} />
                        </button>
                    </div>

                    {/* Cloud Save & Clear Buttons */}
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => saveCloudDraft(true)}
                            disabled={isCloudSaving || isCloudLoading || charCount === 0}
                            title="Save draft to MongoDB cloud so it remains intact when you refresh"
                            className={`relative overflow-hidden h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                                isWaterSplashing
                                    ? "animate-water-splash border-emerald-500 shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400"
                                    : lastCloudSaved
                                    ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-primary/10 border-primary/25 text-primary hover:bg-primary/20"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {/* 🌊 Liquid Water Fluid Layer */}
                            {isWaterFilling && (
                                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden animate-water-rise">
                                    {/* Liquid wave surface 1 */}
                                    <div className="absolute -top-3 left-0 w-[200%] h-5 opacity-75 animate-water-wave-1">
                                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full text-emerald-400 dark:text-emerald-400 fill-current">
                                            <path d="M0,0 C150,90 350,-40 500,50 C650,140 900,-20 1200,40 L1200,120 L0,120 Z" />
                                        </svg>
                                    </div>
                                    {/* Liquid wave surface 2 */}
                                    <div className="absolute -top-2.5 left-0 w-[200%] h-4 opacity-55 animate-water-wave-2">
                                        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full text-teal-300 dark:text-teal-400 fill-current">
                                            <path d="M0,40 C300,-30 450,80 700,20 C950,-40 1050,70 1200,10 L1200,120 L0,120 Z" />
                                        </svg>
                                    </div>
                                    {/* Liquid Water Column Body */}
                                    <div className="w-full h-full bg-gradient-to-t from-emerald-500/50 via-teal-400/40 to-emerald-400/35 backdrop-blur-2xs" />
                                </div>
                            )}

                            {/* Foreground Label & Icon */}
                            <span className="relative z-10 flex items-center gap-1.5 drop-shadow-2xs">
                                {isWaterFilling ? (
                                    <>
                                        <Cloud size={12} className="animate-bounce text-emerald-700 dark:text-emerald-200" />
                                        <span className="font-bold text-emerald-800 dark:text-emerald-100">
                                            Filling Cloud...
                                        </span>
                                    </>
                                ) : isCloudSaving ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-primary" />
                                        <span>Saving to Cloud...</span>
                                    </>
                                ) : lastCloudSaved ? (
                                    <>
                                        <Check size={12} className="text-emerald-500 stroke-[2.5]" />
                                        <span>Cloud Synced</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud size={12} />
                                        <span>Save to Cloud</span>
                                    </>
                                )}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={handleClearClick}
                            title="Clear Editor"
                            className="h-7 px-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            <Trash2 size={11} /> Clear
                        </button>
                    </div>
                </div>

                {/* ── ContentEditable Rich Writing Canvas ──────────────────────────────── */}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onKeyUp={updateActiveFormats}
                    onMouseUp={updateActiveFormats}
                    onFocus={updateActiveFormats}
                    onInput={() => {
                        updateActiveFormats();
                        if (editorRef.current) {
                            pushHistory(editorRef.current.innerHTML || "");
                        }
                        // Debounced auto-save to cloud
                        if (autoSaveTimerRef.current) {
                            clearTimeout(autoSaveTimerRef.current);
                        }
                        autoSaveTimerRef.current = setTimeout(() => {
                            if (editorRef.current && editorRef.current.innerText?.trim()) {
                                saveCloudDraft(false);
                            }
                        }, 2500);
                    }}
                    className="min-h-[220px] max-h-[460px] overflow-y-auto overscroll-contain p-4 text-xs text-foreground focus:outline-none custom-scrollbar leading-relaxed [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:my-2 [&_h1]:text-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-1.5 [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1 [&_h3]:text-foreground [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_a]:text-primary [&_a]:underline"
                    data-placeholder={
                        isDaily
                            ? "Start typing your Daily Activity Report here... Use the toolbar above to format text, add H1/H2 headers, bullet points, and highlight key metrics."
                            : "Start typing your Weekly Activity Summary here... Include key wins, lessons learned, conversion highlights, and next-week targets."
                    }
                />

                {/* ── Editor Footer Bar ────────────────────────────────────────────── */}
                <div className="p-2.5 px-4 bg-card border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                            Mode: Rich Text Editor
                        </span>
                        <span>•</span>
                        <span>{charCount} characters</span>
                        <span>•</span>
                        <span>{wordCount} words</span>
                        {lastCloudSaved && (
                            <>
                                <span>•</span>
                                <span className="text-emerald-500 font-medium flex items-center gap-1">
                                    <Cloud size={11} /> Cloud Synced ({lastCloudSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                            </>
                        )}
                        {isCloudLoading && (
                            <>
                                <span>•</span>
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Loader2 size={11} className="animate-spin text-primary" /> Restoring cloud draft...
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="text-[10px] hidden md:inline">
                            Date stamp automatically applied upon submission.
                        </span>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || charCount === 0}
                            className="h-8.5 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    Submitting report...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={13} />
                                    Submit Activity Report
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Clear Confirmation Modal */}
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogContent className="max-w-md p-6 rounded-2xl border-border bg-card shadow-2xl">
                    <AlertDialogHeader className="space-y-3">
                        <div className="mx-auto sm:mx-0 h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-sm">
                            <AlertTriangle size={22} className="text-destructive" />
                        </div>
                        <AlertDialogTitle className="text-lg font-bold text-foreground">
                            Clear Report Content?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Are you sure you really want to clean the text? All unsaved formatting, headings, bullet points, and draft notes will be permanently removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
                        <AlertDialogCancel
                            onClick={() => setIsClearDialogOpen(false)}
                            className="h-9 px-4 rounded-xl text-xs font-semibold hover:bg-accent cursor-pointer"
                        >
                            No, Keep My Text
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmClear}
                            className="h-9 px-4 rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm transition-colors cursor-pointer"
                        >
                            Yes, Clear Text
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
