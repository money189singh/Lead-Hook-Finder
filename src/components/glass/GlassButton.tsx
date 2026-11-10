import React from 'react';
import { Loader2 } from 'lucide-react';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glow';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  loadingText,
  icon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] rounded-md gap-1.5',
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2 text-xs rounded-xl gap-2 font-medium',
    lg: 'px-5 py-2.5 text-sm rounded-xl gap-2 font-semibold',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#155eef] via-blue-600 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white shadow-xs hover:shadow-md hover:shadow-[#155eef]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] border border-blue-400/30',
    glow:
      'bg-gradient-to-r from-indigo-600 via-[#155eef] to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-sm hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] border border-indigo-400/40',
    secondary:
      'glass-panel hover:bg-white/90 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    ghost:
      'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/50 active:scale-[0.98]',
    danger:
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:border-rose-500/40 active:scale-[0.98]',
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:transform-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
