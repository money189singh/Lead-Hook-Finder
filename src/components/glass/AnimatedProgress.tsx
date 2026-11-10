import React from 'react';

export interface AnimatedProgressProps {
  value: number; // 0 to 100
  label?: string;
  statusText?: string;
  variant?: 'brand' | 'indigo' | 'emerald';
  showPercentage?: boolean;
  className?: string;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  label,
  statusText,
  variant = 'brand',
  showPercentage = true,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  const gradientClass = {
    brand: 'from-[#155eef] via-blue-500 to-cyan-400',
    indigo: 'from-indigo-600 via-purple-500 to-pink-500',
    emerald: 'from-emerald-500 to-teal-400',
  }[variant];

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {(label || statusText || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {label && <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>}
            {statusText && <span className="text-slate-400 text-[11px] truncate max-w-xs">{statusText}</span>}
          </div>
          {showPercentage && (
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <div className="w-full h-1.5 bg-slate-200/60 dark:bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/40 dark:border-white/5">
        <div
          className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
