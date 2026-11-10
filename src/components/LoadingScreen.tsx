import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete?: () => void;
  minDuration?: number; // milliseconds before auto-dismiss
  showBrandText?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  minDuration = 3400,
  showBrandText = true,
}) => {
  const [phase, setPhase] = useState<'orbit' | 'trace' | 'illuminate' | 'ready' | 'exit'>('orbit');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Timeline mimicking the video:
    // 0ms - 600ms: Orbit swoops in
    // 600ms: Logo outline starts tracing
    const tTrace = setTimeout(() => {
      setPhase('trace');
    }, 600);

    // 1600ms: Logo illuminates into solid vibrant blue with neon glow
    const tIllum = setTimeout(() => {
      setPhase('illuminate');
    }, 1600);

    // 2500ms: Brand text & status display
    const tReady = setTimeout(() => {
      setPhase('ready');
    }, 2400);

    // 3200ms: Begin smooth fade-out
    const tExit = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setPhase('exit');
        if (onComplete) onComplete();
      }, 600);
    }, minDuration);

    return () => {
      clearTimeout(tTrace);
      clearTimeout(tIllum);
      clearTimeout(tReady);
      clearTimeout(tExit);
    };
  }, [minDuration, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      setPhase('exit');
      if (onComplete) onComplete();
    }, 300);
  };

  if (phase === 'exit') return null;

  return (
    <div
      id="leadhook-loading-screen"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-700 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 50%, #0a1b38 0%, #061026 40%, #020614 85%, #01030a 100%)',
      }}
    >
      {/* Ambient background depth lights */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-cyan-500/15 rounded-full blur-2xl animate-pulse" />
      </div>

      {/* Subtle floating background star sparks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top: '22%', left: '35%', size: 2, delay: '0s', dur: '2.5s' },
          { top: '30%', left: '68%', size: 3, delay: '0.4s', dur: '3s' },
          { top: '65%', left: '28%', size: 2.5, delay: '0.8s', dur: '2.2s' },
          { top: '72%', left: '62%', size: 2, delay: '1.2s', dur: '2.8s' },
          { top: '40%', left: '78%', size: 3.5, delay: '0.6s', dur: '3.4s' },
          { top: '55%', left: '20%', size: 2, delay: '1s', dur: '2s' },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-200"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              boxShadow: '0 0 8px #38bdf8',
              opacity: phase === 'illuminate' || phase === 'ready' ? 0.75 : 0.2,
              transition: 'opacity 1s ease',
              animation: `pulse ${star.dur} infinite ease-in-out ${star.delay}`,
            }}
          />
        ))}
      </div>

      {/* Main Logo & Orbital Canvas Stage */}
      <div className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] flex items-center justify-center">
        <svg
          viewBox="0 0 600 600"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Main Solid Hook Gradient */}
            <linearGradient id="loadHookGrad" x1="60%" y1="5%" x2="35%" y2="95%">
              <stop offset="0%" stopColor="#0099FF" />
              <stop offset="40%" stopColor="#0066FF" />
              <stop offset="75%" stopColor="#004AE8" />
              <stop offset="100%" stopColor="#0035CC" />
            </linearGradient>

            {/* Ribbon Tip Highlight */}
            <linearGradient id="loadTipGrad" x1="10%" y1="100%" x2="90%" y2="0%">
              <stop offset="0%" stopColor="#0066FF" />
              <stop offset="50%" stopColor="#00AAFF" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>

            {/* Ribbon Fold Underside Shadow */}
            <linearGradient id="loadRibbonShadow" x1="15%" y1="100%" x2="85%" y2="15%">
              <stop offset="0%" stopColor="#002499" />
              <stop offset="100%" stopColor="#0048E8" />
            </linearGradient>

            {/* Orbital Light Streak Gradient */}
            <linearGradient id="orbitStreakGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0044FF" stopOpacity="0" />
              <stop offset="60%" stopColor="#0099FF" stopOpacity="0.6" />
              <stop offset="90%" stopColor="#38BDF8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
            </linearGradient>

            {/* Intense Neon Glow for Hook */}
            <filter id="neonGlowOuter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="10" result="blur1" />
              <feGaussianBlur stdDeviation="4" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Orbital Streak Glow */}
            <filter id="streakGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 
            ========================================================================
            1. ELLIPTICAL ORBITAL LIGHT STREAK (As shown in video timestamps 00:01-00:03)
            Tilted 3D elliptical track around the center hook
            ========================================================================
          */}
          <g transform="rotate(-14 300 300)">
            {/* Faint ambient track wire */}
            <ellipse
              cx="300"
              cy="300"
              rx="265"
              ry="72"
              stroke="#0055FF"
              strokeWidth="1.2"
              strokeOpacity="0.3"
              fill="none"
            />

            {/* Glowing Neon Laser Streak looping smoothly */}
            <ellipse
              cx="300"
              cy="300"
              rx="265"
              ry="72"
              stroke="url(#orbitStreakGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#streakGlow)"
              style={{
                strokeDasharray: '280 820',
                animation: 'orbitSpin 2.4s linear infinite',
              }}
            />

            {/* Secondary subtle trailing streak */}
            <ellipse
              cx="300"
              cy="300"
              rx="265"
              ry="72"
              stroke="#00C8FF"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: '120 980',
                strokeDashoffset: '400',
                animation: 'orbitSpin 2.4s linear infinite',
                opacity: 0.6,
              }}
            />
          </g>

          {/* 
            ========================================================================
            2. LOGO OUTLINE TRACE (Neon wireframe drawn out in Phase 1 & 2)
            ========================================================================
          */}
          <g
            transform="translate(44, 45)"
            filter={phase === 'trace' ? 'url(#neonGlowOuter)' : undefined}
            className="transition-opacity duration-700"
            style={{
              opacity: phase === 'orbit' ? 0 : phase === 'trace' ? 1 : 0.35,
            }}
          >
            {/* Primary Hook Outline Wireframe */}
            <path
              d="
                M 320 83
                C 354.2 83, 382 110.8, 382 145
                C 382 170.5, 366.5 192.4, 344 203
                L 344 285
                C 344 353.5, 290.5 410, 222 410
                C 168 410, 126 375, 142 320
                C 152 284, 185 240, 212 218
                L 212 272
                C 192 288, 188 318, 198 338
                C 207 356, 226 360, 240 358
                C 268 354, 290 326, 290 285
                L 290 203
                C 267.5 192.4, 258 170.5, 258 145
                C 258 110.8, 285.8 83, 320 83
                Z
              "
              fill="none"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 1400,
                strokeDashoffset: phase === 'orbit' ? 1400 : 0,
                transition: 'stroke-dashoffset 1.4s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            />

            {/* Center Eyelet Hole Wireframe */}
            <circle
              cx="320"
              cy="145"
              r="25"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="3.5"
              style={{
                strokeDasharray: 200,
                strokeDashoffset: phase === 'orbit' ? 200 : 0,
                transition: 'stroke-dashoffset 1s ease-out 0.3s',
              }}
            />

            {/* Ribbon Tip Facet Wireframe */}
            <path
              d="
                M 130 315
                C 130 315, 138 270, 172 232
                C 188 214, 212 218, 212 218
                L 212 272
                C 192 288, 178 308, 168 335
                C 158 358, 142 355, 134 340
                C 130 332, 130 322, 130 315
                Z
              "
              fill="none"
              stroke="#67E8F9"
              strokeWidth="3"
              style={{
                strokeDasharray: 400,
                strokeDashoffset: phase === 'orbit' ? 400 : 0,
                transition: 'stroke-dashoffset 1s ease-out 0.5s',
              }}
            />
          </g>

          {/* 
            ========================================================================
            3. SOLID HOOK ILLUMINATION (Timestamp 00:03 - Full Vibrant Solid Emblem)
            ========================================================================
          */}
          <g
            transform="translate(44, 45)"
            className="transition-all duration-700 ease-out"
            style={{
              opacity: phase === 'illuminate' || phase === 'ready' ? 1 : 0,
              transform:
                phase === 'illuminate' || phase === 'ready'
                  ? 'translate(44px, 45px) scale(1)'
                  : 'translate(44px, 45px) scale(0.96)',
            }}
            filter="url(#neonGlowOuter)"
          >
            {/* Glowing Neon Outline Border in illumination phase */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="
                M 320 83
                C 354.2 83, 382 110.8, 382 145
                C 382 170.5, 366.5 192.4, 344 203
                L 344 285
                C 344 353.5, 290.5 410, 222 410
                C 168 410, 126 375, 142 320
                C 152 284, 185 240, 212 218
                L 212 272
                C 192 288, 188 318, 198 338
                C 207 356, 226 360, 240 358
                C 268 354, 290 326, 290 285
                L 290 203
                C 267.5 192.4, 258 170.5, 258 145
                C 258 110.8, 285.8 83, 320 83
                Z
                M 320 120
                A 25 25 0 1 0 320 170
                A 25 25 0 1 0 320 120
                Z
              "
              fill="url(#loadHookGrad)"
              stroke="#00D4FF"
              strokeWidth="2.5"
            />

            {/* Ribbon Fold Underside Shadow */}
            <path
              d="
                M 142 320
                C 134 350, 155 385, 190 402
                C 170 380, 160 350, 168 322
                C 174 300, 192 275, 212 258
                L 212 218
                C 185 240, 152 284, 142 320
                Z
              "
              fill="url(#loadRibbonShadow)"
            />

            {/* Ribbon Tip Front Highlight Facet */}
            <path
              d="
                M 130 315
                C 130 315, 138 270, 172 232
                C 188 214, 212 218, 212 218
                L 212 272
                C 192 288, 178 308, 168 335
                C 158 358, 142 355, 134 340
                C 130 332, 130 322, 130 315
                Z
              "
              fill="url(#loadTipGrad)"
              stroke="#7DD3FC"
              strokeWidth="1.2"
            />
          </g>
        </svg>
      </div>

      {/* Brand Text & Status Reveal */}
      {showBrandText && (
        <div
          className={`mt-4 text-center space-y-2.5 transition-all duration-700 ${
            phase === 'ready'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-white flex items-center justify-center gap-2 drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
            <span>LeadHook</span>
          </h1>

          {/* Minimalist Tech Loading Bar */}
          <div className="w-48 sm:w-60 h-1 mx-auto bg-blue-950/80 rounded-full overflow-hidden border border-blue-900/50 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-white rounded-full transition-all duration-1000 ease-out"
              style={{
                width: phase === 'ready' ? '100%' : '35%',
                boxShadow: '0 0 10px #38bdf8',
              }}
            />
          </div>

          <p className="text-[11px] font-mono tracking-widest uppercase text-cyan-300/80 font-medium">
            INITIALIZING ENGINE...
          </p>
        </div>
      )}

      {/* Skip Button for Accessibility */}
      <button
        id="loading-skip-btn"
        onClick={handleSkip}
        className="absolute bottom-6 right-6 px-3.5 py-1.5 rounded-full text-xs font-mono text-cyan-400/60 hover:text-cyan-300 hover:bg-blue-950/40 border border-blue-900/40 transition-colors cursor-pointer"
      >
        Skip [ESC]
      </button>

      {/* Inline Keyframe Styles for the 60fps Orbital Sweep */}
      <style>{`
        @keyframes orbitSpin {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -1100;
          }
        }
      `}</style>
    </div>
  );
};
