import React from 'react';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  withContainer?: boolean;
  useImage?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className = '',
  withContainer = false,
  useImage = false,
}) => {
  const sizeMap = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 40,
    xl: 56,
  };

  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 32;

  const logoGraphic = useImage ? (
    <img
      src="/logo-transparent.png"
      alt="LeadHook Logo"
      className="w-full h-full object-contain select-none"
      referrerPolicy="no-referrer"
    />
  ) : (
    <svg
      viewBox="0 0 512 512"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm select-none"
    >
      <defs>
        {/* Main Hook Vibrant Electric Blue Gradient */}
        <linearGradient id="logoStemGradient" x1="60%" y1="5%" x2="35%" y2="95%">
          <stop offset="0%" stopColor="#0088FF" />
          <stop offset="35%" stopColor="#0066FF" />
          <stop offset="70%" stopColor="#004AE8" />
          <stop offset="100%" stopColor="#0038D6" />
        </linearGradient>

        {/* Ribbon Fold Underside Shadow (Darker Royal/Navy Blue) */}
        <linearGradient id="logoRibbonFold" x1="15%" y1="100%" x2="85%" y2="15%">
          <stop offset="0%" stopColor="#002DB3" />
          <stop offset="50%" stopColor="#003ECB" />
          <stop offset="100%" stopColor="#0055F5" />
        </linearGradient>

        {/* Ribbon Tip Front Highlight (Bright Cyan-Azure Gradient) */}
        <linearGradient id="logoRibbonTip" x1="10%" y1="100%" x2="90%" y2="0%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="45%" stopColor="#0099FF" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Dynamic Glow Filter */}
        <filter id="logoGlow" x="-10%" y="-10%" width="125%" height="125%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0052D4" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#logoGlow)">
        {/*
          Primary Hook Body:
          Outer eyelet circle at (320, 145) r=62
          Stem descends to y=290
          Bottom U-turn curve with radius 125, outer bottom at y=410
          Inner loop curve with radius 65, inner bottom at y=350
          Inside hole punched out with evenodd rule: M 320 120 A 25 25 0 1 0 320 170 A 25 25 0 1 0 320 120 Z
        */}
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
          fill="url(#logoStemGradient)"
        />

        {/* Ribbon Fold Underside (Layer beneath tip giving depth) */}
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
          fill="url(#logoRibbonFold)"
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
          fill="url(#logoRibbonTip)"
        />
      </g>
    </svg>
  );

  if (withContainer) {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className={`rounded-2xl p-1.5 flex items-center justify-center bg-white dark:bg-[#101730] border border-blue-100/80 dark:border-blue-900/40 shadow-sm shrink-0 transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <div className="w-full h-full flex items-center justify-center">
          {logoGraphic}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {logoGraphic}
    </div>
  );
};
