import React from 'react';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  hasGlow?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  variant = 'default',
  rounded = 'xl',
  hasGlow = false,
  className = '',
  ...props
}) => {
  const variantClass = {
    default: 'glass-panel',
    elevated: 'glass-panel-elevated',
    subtle: 'glass-panel-subtle',
    interactive: 'glass-panel glass-interactive cursor-pointer',
  }[variant];

  const roundedClass = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-3xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`${variantClass} ${roundedClass} ${hasGlow ? 'glass-input-glow' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
