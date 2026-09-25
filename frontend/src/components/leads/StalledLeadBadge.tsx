import React from 'react';
import { AlertCircle, Flame, Clock, Snowflake } from 'lucide-react';

interface StalledLeadBadgeProps {
  isStalled?: boolean;
  daysInactive?: number;
  score?: 'Hot' | 'Warm' | 'Cold' | string;
  size?: 'sm' | 'md';
  className?: string;
  stalledReason?: string;
}

export const StalledLeadBadge: React.FC<StalledLeadBadgeProps> = ({
  isStalled,
  daysInactive = 0,
  score = 'Cold',
  size = 'md',
  className = '',
  stalledReason
}) => {
  if (!isStalled) return null;

  const normalizedScore = (score || 'Cold').toLowerCase();

  let badgeConfig = {
    bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    icon: Flame,
    label: 'Stalled',
    threshold: 3,
    glow: 'shadow-[0_0_8px_rgba(244,63,94,0.3)]'
  };

  if (normalizedScore === 'warm') {
    badgeConfig = {
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      icon: Clock,
      label: 'Stalled',
      threshold: 5,
      glow: 'shadow-[0_0_8px_rgba(245,158,11,0.25)]'
    };
  } else if (normalizedScore === 'cold') {
    badgeConfig = {
      bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
      icon: Snowflake,
      label: 'Stalled',
      threshold: 7,
      glow: 'shadow-[0_0_8px_rgba(14,165,233,0.25)]'
    };
  }

  const IconComponent = badgeConfig.icon;
  const tooltipText = stalledReason || `Inactive for ${daysInactive} day${daysInactive !== 1 ? 's' : ''} (Threshold: ${badgeConfig.threshold}d)`;

  if (size === 'sm') {
    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeConfig.bg} ${badgeConfig.glow} ${className}`}
      >
        <IconComponent size={10} className="shrink-0 animate-pulse" />
        <span>Stalled {daysInactive ? `${daysInactive}d` : ''}</span>
      </span>
    );
  }

  return (
    <span
      title={tooltipText}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeConfig.bg} ${badgeConfig.glow} transition-all hover:scale-105 ${className}`}
    >
      <IconComponent size={13} className="shrink-0 animate-pulse" />
      <span>Stalled ({daysInactive}d inactive)</span>
    </span>
  );
};

export default StalledLeadBadge;
