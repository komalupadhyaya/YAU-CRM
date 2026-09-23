import React from 'react';
import { Flame, Zap, Snowflake, RotateCcw, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadScoreBadgeProps {
  score?: 'Hot' | 'Warm' | 'Cold' | null;
  reason?: string;
  isOverridden?: boolean;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onScoreChange?: (newScore: 'Hot' | 'Warm' | 'Cold' | 'Auto') => void;
  className?: string;
}

export const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({
  score = 'Cold',
  reason,
  isOverridden = false,
  interactive = true,
  size = 'md',
  onScoreChange,
  className = '',
}) => {
  const currentScore = score || 'Cold';
  const displayReason =
    reason ||
    (currentScore === 'Hot'
      ? 'High engagement / high purchase intent'
      : currentScore === 'Warm'
      ? 'Active outreach in progress'
      : 'Minimal engagement / uncontacted');

  let badgeClass = 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400';
  let IconComponent = Snowflake;
  let iconClass = 'text-blue-500';

  if (currentScore === 'Hot') {
    badgeClass = 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 shadow-xs';
    IconComponent = Flame;
    iconClass = 'text-red-500';
  } else if (currentScore === 'Warm') {
    badgeClass = 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-xs';
    IconComponent = Zap;
    iconClass = 'text-amber-500';
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.2 text-[9px] gap-1'
      : size === 'lg'
      ? 'px-3 py-1 text-xs gap-1.5 font-bold'
      : 'px-2 py-0.5 text-[10px] gap-1 font-semibold';

  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11;

  const badgeContent = (
    <span
      className={`inline-flex items-center rounded-full border transition-all ${badgeClass} ${sizeClasses} ${
        interactive ? 'cursor-pointer hover:opacity-85 active:scale-95 select-none' : ''
      } ${className}`}
    >
      <IconComponent size={iconSize} className={iconClass} />
      <span>{currentScore}</span>
      {isOverridden && (
        <span className="text-[8px] opacity-75 ml-0.5 font-normal" title="Manual Override">
          (Manual)
        </span>
      )}
      {interactive && <ChevronDown size={8} className="opacity-50 ml-0.5" />}
    </span>
  );

  if (!interactive || !onScoreChange) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">{badgeContent}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">
              {currentScore} Lead {isOverridden ? '(Manual Override)' : ''}
            </p>
            <p className="text-muted-foreground mt-0.5">{displayReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="outline-none focus:ring-2 focus:ring-primary/20 rounded-full inline-block shrink-0"
              >
                {badgeContent}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">
              {currentScore} Lead {isOverridden ? '(Manual Override)' : ''}
            </p>
            <p className="text-muted-foreground mt-0.5">{displayReason}</p>
            <p className="text-[10px] text-primary mt-1 font-medium">Click to change temperature</p>
          </TooltipContent>
          <DropdownMenuContent align="start" className="w-44 bg-card border-border text-foreground shadow-lg">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Lead Temperature
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onScoreChange('Hot')}
              className="gap-2 cursor-pointer text-xs font-semibold text-red-600 dark:text-red-400"
            >
              <Flame size={14} className="text-red-500" />
              <span>Hot Lead</span>
              {currentScore === 'Hot' && <span className="ml-auto text-[10px] opacity-70">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onScoreChange('Warm')}
              className="gap-2 cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400"
            >
              <Zap size={14} className="text-amber-500" />
              <span>Warm Lead</span>
              {currentScore === 'Warm' && <span className="ml-auto text-[10px] opacity-70">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onScoreChange('Cold')}
              className="gap-2 cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              <Snowflake size={14} className="text-blue-500" />
              <span>Cold Lead</span>
              {currentScore === 'Cold' && <span className="ml-auto text-[10px] opacity-70">✓</span>}
            </DropdownMenuItem>

            {isOverridden && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onScoreChange('Auto')}
                  className="gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={13} />
                  <span>Reset to Auto</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LeadScoreBadge;
