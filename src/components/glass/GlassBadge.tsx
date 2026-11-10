import React from 'react';

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'indigo';
  size?: 'xs' | 'sm';
  dot?: boolean;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'xs',
  dot = false,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
  }[size];

  const variantClasses = {
    neutral:
      'bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50',
    brand:
      'bg-blue-50/80 dark:bg-blue-950/50 text-[#155eef] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40',
    indigo:
      'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40',
    success:
      'bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
    warning:
      'bg-amber-50/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40',
    danger:
      'bg-rose-50/80 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40',
  }[variant];

  const dotColors = {
    neutral: 'bg-slate-400',
    brand: 'bg-[#155eef]',
    indigo: 'bg-indigo-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      {children}
    </span>
  );
};
