import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Flame,
  Zap,
  Snowflake,
  Clock,
  CheckCircle2,
  X,
  Edit3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  CalendarPlus,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/api';
import { AiNextAction } from '../../store/schoolStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/datetime-picker';

interface AiNextActionCardProps {
  leadId: string;
  leadType?: 'lead' | 'ea_lead';
  aiScore?: 'Hot' | 'Warm' | 'Cold' | null;
  aiNextAction?: AiNextAction | null;
  onUpdate?: (updatedLead: any) => void;
  className?: string;
  defaultCollapsed?: boolean;
}

export const AiNextActionCard: React.FC<AiNextActionCardProps> = ({
  leadId,
  leadType = 'lead',
  aiScore = 'Cold',
  aiNextAction,
  onUpdate,
  className = '',
  defaultCollapsed = false
}) => {
  const [showReason, setShowReason] = useState(false);
  const [loadingDismiss, setLoadingDismiss] = useState(false);
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, [leadId, defaultCollapsed]);

  // Edit Modal Fields
  const [editAction, setEditAction] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [savingEdit, setSavingEdit] = useState(false);

  // Convert to Follow-Up Modal Fields
  const [fuTitle, setFuTitle] = useState('');
  const [fuType, setFuType] = useState<'Call' | 'Email' | 'Meeting' | 'Task' | 'Follow-Up'>('Task');
  const [fuDate, setFuDate] = useState<string>('');
  const [fuPriority, setFuPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [fuNotes, setFuNotes] = useState('');

  // If no action or dismissed, do not render
  if (!aiNextAction || !aiNextAction.action || aiNextAction.status === 'dismissed') {
    return null;
  }

  const score = aiScore || 'Cold';
  const isHot = score === 'Hot';
  const isWarm = score === 'Warm';
  const isCold = score === 'Cold';

  // Format theme colors & badges
  const themeStyles = isHot
    ? {
        border: 'border-rose-500/40 hover:border-rose-500/60',
        bg: 'bg-gradient-to-r from-rose-500/10 via-rose-500/[0.04] to-background',
        badgeBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
        iconColor: 'text-rose-500',
        label: 'Hot Lead'
      }
    : isWarm
    ? {
        border: 'border-amber-500/40 hover:border-amber-500/60',
        bg: 'bg-gradient-to-r from-amber-500/10 via-amber-500/[0.04] to-background',
        badgeBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
        iconColor: 'text-amber-500',
        label: 'Warm Lead'
      }
    : {
        border: 'border-sky-500/40 hover:border-sky-500/60',
        bg: 'bg-gradient-to-r from-sky-500/10 via-sky-500/[0.04] to-background',
        badgeBg: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30',
        iconColor: 'text-sky-500',
        label: 'Cold Lead'
      };

  const handleDismiss = async () => {
    setLoadingDismiss(true);
    try {
      const res = await api.post(`/next-action/${leadId}/dismiss`, {
        leadType,
        cancelTask: true
      });
      toast.success('Recommendation dismissed');
      if (onUpdate && res.data?.lead) {
        onUpdate(res.data.lead);
      }
    } catch (err: any) {
      console.error('Failed to dismiss next action:', err);
      toast.error(err.response?.data?.error || 'Failed to dismiss');
    } finally {
      setLoadingDismiss(false);
    }
  };

  const handleAccept = async () => {
    setLoadingAccept(true);
    try {
      const res = await api.post(`/next-action/${leadId}/accept`, { leadType });
      toast.success('Task created from suggestion!');
      if (onUpdate && res.data?.lead) {
        onUpdate(res.data.lead);
      }
    } catch (err: any) {
      console.error('Failed to accept next action:', err);
      toast.error(err.response?.data?.error || 'Failed to accept');
    } finally {
      setLoadingAccept(false);
    }
  };

  const openConvertModal = () => {
    const act = aiNextAction.action || '';
    setFuTitle(act);
    setFuNotes(aiNextAction.reason || '');
    setFuDate(aiNextAction.recommendedDueDate ? new Date(aiNextAction.recommendedDueDate).toISOString() : '');
    setFuPriority(aiNextAction.priority || 'medium');

    const actLower = act.toLowerCase();
    if (actLower.startsWith('call') || actLower.includes('phone') || actLower.includes('dial')) {
      setFuType('Call');
    } else if (actLower.startsWith('email') || actLower.includes('send email')) {
      setFuType('Email');
    } else if (actLower.includes('meet') || actLower.includes('schedule demo')) {
      setFuType('Meeting');
    } else {
      setFuType('Task');
    }

    setConvertModalOpen(true);
  };

  const handleConfirmConvert = async () => {
    if (!fuTitle.trim()) {
      toast.error('Follow-up title is required');
      return;
    }
    setLoadingFollowup(true);
    try {
      const res = await api.post(`/next-action/${leadId}/convert-followup`, {
        leadType,
        title: fuTitle.trim(),
        date_time: fuDate || undefined,
        type: fuType,
        priority: fuPriority,
        notes: fuNotes.trim()
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Follow-up scheduled & suggestion completed!');
        setConvertModalOpen(false);
        if (onUpdate && res.data.lead) {
          onUpdate(res.data.lead);
        }
      }
    } catch (err: any) {
      console.error('Failed to convert to follow-up:', err);
      toast.error(err.response?.data?.error || 'Failed to convert to follow-up');
    } finally {
      setLoadingFollowup(false);
    }
  };

  const openEditModal = () => {
    setEditAction(aiNextAction.action || '');
    setEditReason(aiNextAction.reason || '');
    setEditDueDate(aiNextAction.recommendedDueDate ? new Date(aiNextAction.recommendedDueDate).toISOString() : '');
    setEditPriority(aiNextAction.priority || 'medium');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editAction.trim()) {
      toast.error('Action title is required');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await api.post(`/next-action/${leadId}/edit`, {
        leadType,
        action: editAction.trim(),
        reason: editReason.trim(),
        dueDate: editDueDate || undefined,
        priority: editPriority
      });
      toast.success('Action updated');
      setEditModalOpen(false);
      if (onUpdate && res.data?.lead) {
        onUpdate(res.data.lead);
      }
    } catch (err: any) {
      console.error('Failed to save edit:', err);
      toast.error(err.response?.data?.error || 'Failed to save edit');
    } finally {
      setSavingEdit(false);
    }
  };

  const formattedDueDate = aiNextAction.recommendedDueDate
    ? new Date(aiNextAction.recommendedDueDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const isFollowupConverted = aiNextAction.status === 'converted_to_followup' || !!aiNextAction.followupId;
  const hasAutoTask = (isHot || isWarm) && !!aiNextAction.taskId && !isFollowupConverted;

  return (
    <>
      <div
        className={`relative border rounded-xl shadow-sm shrink-0 transition-all animate-in fade-in duration-300 ${isCollapsed ? 'p-2.5 sm:py-2.5 sm:px-3.5' : 'p-3.5 sm:p-4'} ${themeStyles.border} ${themeStyles.bg} ${className}`}
      >
        {/* Top Header Row (Click to toggle compress / extract) */}
        <div className={`flex items-center justify-between gap-2.5 min-h-[30px] ${isCollapsed ? 'mb-0' : 'mb-3'}`}>
          <div 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none group"
            title={isCollapsed ? "Click to extract / expand AI Next Action" : "Click to compress / collapse AI Next Action"}
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles size={13} className="animate-pulse shrink-0" />
            </span>
            <span className="text-xs font-bold tracking-tight text-foreground shrink-0">
              AI Next Action
            </span>

            {/* Score Pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase shrink-0 ${themeStyles.badgeBg}`}
            >
              {isHot && <Flame size={11} className={themeStyles.iconColor} />}
              {isWarm && <Zap size={11} className={themeStyles.iconColor} />}
              {isCold && <Snowflake size={11} className={themeStyles.iconColor} />}
              {themeStyles.label}
            </span>
          </div>

          {/* Action Controls: Compress/Expand Toggle + Dismiss Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
              title={isCollapsed ? "Extract / Expand AI Next Action" : "Compress / Collapse AI Next Action"}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border/50 transition-all cursor-pointer select-none"
            >
              {isCollapsed ? <ChevronDown size={14} className="shrink-0" /> : <ChevronUp size={14} className="shrink-0" />}
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              disabled={loadingDismiss}
              title="Dismiss suggestion from lead card"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {loadingDismiss ? <Loader2 size={13} className="animate-spin text-destructive shrink-0" /> : <X size={13} />}
            </button>
          </div>
        </div>

        {/* Collapsed Preview Row: Clean second line showing action and quick expand link */}
        {isCollapsed && (
          <div 
            onClick={() => setIsCollapsed(false)}
            className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between gap-2 cursor-pointer group"
            title="Click to extract / expand full action details"
          >
            <p className="text-xs text-foreground/85 font-medium truncate flex-1 leading-tight">
              {aiNextAction.action}
            </p>
            <span className="text-[10px] text-primary font-semibold group-hover:underline shrink-0 whitespace-nowrap">
              View details →
            </span>
          </div>
        )}

        {/* Expanded View Details */}
        {!isCollapsed && (
          <>
            {/* Suggestion Action Title */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug break-words">
                  {aiNextAction.action}
                </p>

                {/* Metadata Pills: Status, Due Date, Priority */}
                <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[11px] text-muted-foreground">
                  {/* Status Pills: Follow-Up Scheduled, Auto-Task Created, or Recommendation Only */}
                  {isFollowupConverted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                      <CalendarPlus size={11} /> Follow-Up Scheduled
                    </span>
                  ) : hasAutoTask ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
                      <CheckCircle2 size={11} /> Auto-Task Created
                    </span>
                  ) : isCold ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                      Recommendation Only
                    </span>
                  ) : null}

                  {formattedDueDate && (
                    <span className="flex items-center gap-1 font-medium text-foreground/80 shrink-0">
                      <Clock size={12} className="text-primary" />
                      Target: {formattedDueDate}
                    </span>
                  )}

                  <span className="capitalize font-medium shrink-0">
                    Priority: <strong className="text-foreground capitalize">{aiNextAction.priority || 'Medium'}</strong>
                  </span>

                  {aiNextAction.activityTrigger?.summary && (
                    <span className="truncate max-w-[280px] text-muted-foreground/90 italic" title={aiNextAction.activityTrigger.summary}>
                      Based on: {aiNextAction.activityTrigger.summary}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Claude Reasoning */}
            {aiNextAction.reason && (
              <div className="mt-2.5 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowReason(!showReason)}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <span>{showReason ? 'Hide context & rationale' : 'Why Claude suggests this'}</span>
                  {showReason ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showReason && (
                  <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed bg-accent/30 dark:bg-accent/15 p-2.5 rounded-lg border border-border/40 animate-in fade-in duration-200 max-h-36 overflow-y-auto custom-scrollbar">
                    {aiNextAction.reason}
                  </div>
                )}
              </div>
            )}

            {/* Action Controls Row */}
            <div className="mt-3.5 pt-2.5 border-t border-border/30 flex flex-wrap items-center justify-between gap-2">
              {/* Primary CTA: Convert to Follow-Up */}
              {!isFollowupConverted ? (
                <button
                  type="button"
                  onClick={openConvertModal}
                  disabled={loadingFollowup}
                  className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Review and convert this AI action into a scheduled CRM Follow-up or Task"
                >
                  <CalendarPlus size={13} className="shrink-0" />
                  <span>Convert to Follow-Up</span>
                </button>
              ) : (
                <span className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                  <Check size={13} className="shrink-0" /> Follow-Up Created
                </span>
              )}

              {/* Secondary Actions Group (Accept, Edit, Dismiss) */}
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* If Cold lead without task and not converted, show Accept button to auto-create task */}
                {isCold && !aiNextAction.taskId && !isFollowupConverted && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={loadingAccept}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    title="Accept and create task"
                  >
                    {loadingAccept ? (
                      <Loader2 size={12} className="animate-spin shrink-0" />
                    ) : (
                      <Check size={12} className="shrink-0" />
                    )}
                    <span>Accept</span>
                  </button>
                )}

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 transition-all shrink-0 cursor-pointer whitespace-nowrap"
                  title="Edit suggested action, priority, or notes"
                >
                  <Edit3 size={12} className="shrink-0" />
                  <span>Edit</span>
                </button>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={loadingDismiss}
                  title="Dismiss suggestion from lead card"
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingDismiss ? <Loader2 size={12} className="animate-spin text-destructive shrink-0" /> : <X size={12} className="shrink-0" />}
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Next Action Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Edit AI Next Action
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Suggested Action Title</Label>
              <Input
                value={editAction}
                onChange={e => setEditAction(e.target.value)}
                placeholder="e.g. Call Coach Dave to confirm gym availability"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Context / Notes</Label>
              <textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="Rationale, notes, or background context..."
                rows={6}
                className="w-full text-xs rounded-md border border-input bg-background p-3 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed min-h-[140px] custom-scrollbar"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Due Date & Time</Label>
              <div className="w-full">
                <DateTimePicker
                  value={editDueDate}
                  onChange={val => setEditDueDate(val)}
                  size="sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <select
                value={editPriority}
                onChange={e => setEditPriority(e.target.value as any)}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
              >
                <option value="high">🔥 High Priority</option>
                <option value="medium">⚡ Medium Priority</option>
                <option value="low">❄️ Low Priority</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Follow-Up / Task Modal */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {fuType === 'Task' ? (
                <>
                  <CheckCircle2 size={16} className="text-blue-600" />
                  Convert AI Action to CRM Task
                </>
              ) : (
                <>
                  <CalendarPlus size={16} className="text-emerald-600" />
                  Convert AI Action to CRM Follow-Up
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Destination Helper Banner */}
            {fuType === 'Task' ? (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>Will be created in the <strong>Tasks</strong> module at <strong>/tasks</strong></span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                <CalendarPlus size={13} className="shrink-0" />
                <span>Will be scheduled in the <strong>Follow-ups</strong> module at <strong>/followups</strong></span>
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                value={fuTitle}
                onChange={e => setFuTitle(e.target.value)}
                placeholder="e.g. Call Coach Dave to confirm gym availability"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type & Destination</Label>
                <select
                  value={fuType}
                  onChange={e => setFuType(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                >
                  <option value="Task">📋 Task (goes to /tasks)</option>
                  <option value="Call">📞 Call Follow-Up (goes to /followups)</option>
                  <option value="Email">📧 Email Follow-Up (goes to /followups)</option>
                  <option value="Meeting">🤝 Meeting Follow-Up (goes to /followups)</option>
                  <option value="Follow-Up">📌 General Follow-Up (goes to /followups)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <select
                  value={fuPriority}
                  onChange={e => setFuPriority(e.target.value as any)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                >
                  <option value="high">🔥 High Priority</option>
                  <option value="medium">⚡ Medium Priority</option>
                  <option value="low">❄️ Low Priority</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Date & Time</Label>
              <div className="w-full">
                <DateTimePicker
                  value={fuDate}
                  onChange={val => setFuDate(val)}
                  size="sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes / Details</Label>
              <textarea
                value={fuNotes}
                onChange={e => setFuNotes(e.target.value)}
                placeholder="Details, talking points, or context..."
                rows={5}
                className="w-full text-xs rounded-md border border-input bg-background p-3 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed min-h-[120px] custom-scrollbar"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmConvert}
              disabled={loadingFollowup}
              className={`text-white gap-1.5 font-medium ${
                fuType === 'Task'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loadingFollowup ? (
                <Loader2 size={13} className="animate-spin" />
              ) : fuType === 'Task' ? (
                <CheckCircle2 size={13} />
              ) : (
                <CalendarPlus size={13} />
              )}
              {fuType === 'Task' ? 'Convert & Create Task (/tasks)' : 'Convert & Schedule Follow-Up (/followups)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AiNextActionCard;
