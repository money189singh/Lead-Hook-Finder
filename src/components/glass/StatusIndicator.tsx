import React from 'react';

export interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'idle' | 'offline';
  label: string;
  sublabel?: string;
  onClick?: () => void;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  sublabel,
  onClick,
  className = '',
}) => {
  const dotColor = {
    active: 'bg-emerald-500',
    warning: 'bg-amber-500',
    idle: 'bg-blue-500',
    offline: 'bg-slate-400',
  }[status];

  const pulseColor = {
    active: 'bg-emerald-400',
    warning: 'bg-amber-400',
    idle: 'bg-blue-400',
    offline: 'bg-slate-300',
  }[status];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60 transition-colors select-none ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {status === 'active' && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <span>{label}</span>
      {sublabel && <span className="text-slate-400 font-normal">({sublabel})</span>}
    </button>
  );
};
