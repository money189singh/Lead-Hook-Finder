import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface GlassTooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  usePortal?: boolean;
}

export const GlassTooltip: React.FC<GlassTooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
  usePortal = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    if (position === 'right') {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
    } else if (position === 'left') {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left - 10,
      });
    } else if (position === 'bottom') {
      setCoords({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      // top
      setCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      const handleScroll = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isVisible, position]);

  const tooltipElement = isVisible ? (
    <div
      role="tooltip"
      style={
        usePortal
          ? {
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                position === 'right'
                  ? 'translateY(-50%)'
                  : position === 'left'
                  ? 'translate(-100%, -50%)'
                  : position === 'bottom'
                  ? 'translateX(-50%)'
                  : 'translate(-50%, -100%)',
              zIndex: 9999,
            }
          : undefined
      }
      className={`px-2.5 py-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95`}
    >
      {content}
    </div>
  ) : null;

  return (
    <div
      ref={triggerRef}
      className={`relative ${className.includes('flex') || className.includes('block') ? '' : 'inline-flex'} items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        usePortal && typeof document !== 'undefined'
          ? createPortal(tooltipElement, document.body)
          : tooltipElement
      )}
    </div>
  );
};

