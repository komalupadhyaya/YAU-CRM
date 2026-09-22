import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, Target, Award, Calendar, User, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AIFeedback {
    goingWell?: string;
    patternsOrRedFlags?: string;
    recommendations?: string[];
    performanceScore?: number | null;
    scoreSummary?: string;
    rawResponse?: string;
}

export interface ActivityReportItem {
    _id: string;
    userId: string;
    userName: string;
    userRole: string;
    reportType: "daily" | "weekly";
    submissionDate: string;
    submissionSource: string;
    rawContent: string;
    aiFeedback: AIFeedback;
    aiStatus: "pending" | "evaluating" | "completed" | "failed";
    aiError?: string | null;
    createdAt?: string;
}

interface ClaudeFeedbackCardProps {
    report: ActivityReportItem;
    onClose?: () => void;
    compact?: boolean;
}

export const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    if (score >= 8.5) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (score >= 7.0) return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    if (score >= 5.0) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-400 border-rose-500/30";
};

export const getScoreBadgeBg = (score: number | null | undefined) => {
    if (score == null) return "from-zinc-600 to-zinc-800";
    if (score >= 8.5) return "from-emerald-600 to-teal-700";
    if (score >= 7.0) return "from-blue-600 to-cyan-700";
    if (score >= 5.0) return "from-amber-600 to-orange-700";
    return "from-rose-600 to-red-700";
};

export default function ClaudeFeedbackCard({ report, compact = false }: ClaudeFeedbackCardProps) {
    const feedback = report.aiFeedback || {};
    const score = feedback.performanceScore;
    const isDaily = report.reportType === "daily";
    const dateFormatted = new Date(report.submissionDate || report.createdAt || Date.now()).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-5 md:p-6 shadow-xl backdrop-blur-md relative overflow-hidden transition-all">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Score Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg tracking-tight">Claude AI Feedback</h3>
                            <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 uppercase tracking-wider ${isDaily ? "border-blue-500/40 text-blue-400 bg-blue-500/10" : "border-purple-500/40 text-purple-400 bg-purple-500/10"}`}>
                                {isDaily ? "Daily Report" : "Weekly Report"}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                                <User size={12} /> {report.userName}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock size={12} /> {dateFormatted}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Performance Score Pill */}
                {score != null ? (
                    <div className="flex items-center gap-3 bg-secondary/40 border border-border/70 rounded-xl px-4 py-2 self-start sm:self-auto">
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Performance Score</p>
                            <p className="text-xs font-medium text-foreground line-clamp-1 max-w-[200px]">{feedback.scoreSummary || "Evaluated by Claude"}</p>
                        </div>
                        <div className={`flex items-center justify-center font-extrabold text-xl px-3 py-1 rounded-lg border ${getScoreColor(score)}`}>
                            {score.toFixed(1)}
                            <span className="text-xs font-normal opacity-70 ml-1">/10</span>
                        </div>
                    </div>
                ) : report.aiStatus === "failed" ? (
                    <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-400 bg-rose-500/10 self-start sm:self-auto">
                        AI Evaluation Failed
                    </Badge>
                ) : (
                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl px-3 py-1.5 text-xs font-semibold self-start sm:self-auto">
                        <Loader2 size={13} className="animate-spin" />
                        <span>Claude Analyzing...</span>
                    </div>
                )}
            </div>

            {/* Content Sections */}
            <div className="mt-5 space-y-4 text-sm">
                {/* Pending / Evaluating Shimmer Banner */}
                {(report.aiStatus === "pending" || report.aiStatus === "evaluating") && (
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 md:p-5 transition-all animate-pulse">
                        <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-2 text-xs uppercase tracking-wider">
                            <Loader2 size={15} className="animate-spin" />
                            <span>Claude AI Analysis In Progress</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                            Claude is evaluating your report details, identifying key trends, and calculating your performance score in the background. Your feedback and score will appear here automatically in a moment.
                        </p>
                        <div className="mt-4 pl-6 space-y-2">
                            <div className="h-2.5 w-3/4 bg-indigo-500/20 rounded-full" />
                            <div className="h-2.5 w-1/2 bg-indigo-500/10 rounded-full" />
                        </div>
                    </div>
                )}

                {/* Failed Evaluation Notice */}
                {report.aiStatus === "failed" && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                            <AlertTriangle size={15} />
                            <span>AI Analysis Unavailable</span>
                        </div>
                        <p className="pl-6">
                            Your report was saved successfully, but AI evaluation could not be completed at this time. {report.aiError ? `(${report.aiError})` : ""}
                        </p>
                    </div>
                )}

                {/* 1. What Went Well */}
                {feedback.goingWell && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1.5 text-xs uppercase tracking-wider">
                            <CheckCircle2 size={15} />
                            <span>What is Going Well</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed pl-6">
                            {feedback.goingWell}
                        </p>
                    </div>
                )}

                {/* 2. Patterns & Red Flags */}
                {feedback.patternsOrRedFlags && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1.5 text-xs uppercase tracking-wider">
                            <AlertTriangle size={15} />
                            <span>Patterns & Observations</span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed pl-6">
                            {feedback.patternsOrRedFlags}
                        </p>
                    </div>
                )}

                {/* 3. Actionable Recommendations */}
                {feedback.recommendations && feedback.recommendations.length > 0 && (
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 transition-all">
                        <div className="flex items-center gap-2 text-sky-400 font-semibold mb-2 text-xs uppercase tracking-wider">
                            <Target size={15} />
                            <span>Actionable Recommendations ({isDaily ? "For Tomorrow" : "For Next Week"})</span>
                        </div>
                        <ul className="space-y-2 pl-6">
                            {feedback.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 text-foreground/90 leading-relaxed">
                                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span>{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Original Report Snippet in non-compact mode */}
            {!compact && (
                <div className="mt-5 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span className="font-semibold uppercase tracking-wider">Submitted Report Content</span>
                        <span>{report.rawContent.length} characters</span>
                    </div>
                    {/<[a-z][\s\S]*>/i.test(report.rawContent) ? (
                        <div
                            className="rounded-lg bg-secondary/30 border border-border/50 p-3.5 text-xs text-foreground/90 font-sans leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-1.5 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-blue-400 [&_h3]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5"
                            dangerouslySetInnerHTML={{ __html: report.rawContent }}
                        />
                    ) : (
                        <div className="rounded-lg bg-secondary/30 border border-border/50 p-3.5 text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                            {report.rawContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
