import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export interface MilkGlassLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  text?: string;
  subtext?: string;
  fullscreen?: boolean;
}

export const MilkGlassLoader: React.FC<MilkGlassLoaderProps> = ({
  size = 'md',
  text,
  subtext,
  fullscreen = false
}) => {
  const { language } = useLanguage();

  // Multilingual default loading labels
  const defaultText = text || (
    language === 'ta'
      ? 'பால் கணக்கு தயாராகிறது...'
      : language === 'ml'
      ? 'പാൽ അക്കൗണ്ട് തയ്യാറാകുന്നു...'
      : 'Pouring fresh milk ledger...'
  );

  const defaultSubtext = subtext || (
    language === 'ta'
      ? 'கண்ணாடி டம்ளரில் தூய பால் நிரம்புகிறது'
      : language === 'ml'
      ? 'ശുദ്ധമായ പാൽ നിറയുന്നു'
      : 'Fast loading & instant sync'
  );

  const isFullscreen = fullscreen || size === 'fullscreen';

  return (
    <div
      className={`milk-loader-wrapper ${isFullscreen ? 'milk-loader-fullscreen' : `milk-loader-${size}`}`}
      role="status"
      aria-live="polite"
    >
      <div className="milk-loader-card">
        {/* Ambient Backlight Halo */}
        <div className="milk-loader-halo" aria-hidden="true" />

        {/* Realistic Pouring Milk Tumbler */}
        <div className="milk-glass-stage">
          <svg
            viewBox="0 0 120 160"
            className="milk-glass-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Glass interior clipping mask */}
              <clipPath id="react-glass-inner-clip">
                <path d="M 28 32 L 34 135 C 34 143, 86 143, 86 135 L 92 32 Z" />
              </clipPath>

              {/* Rich Pure Milk Gradient */}
              <linearGradient id="react-milk-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="45%" stopColor="#FFFFFF" />
                <stop offset="85%" stopColor="#F1F5F9" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>

              {/* Pouring Milk Stream Gradient */}
              <linearGradient id="react-stream-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.95" />
              </linearGradient>

              {/* Glass Sheen / Glare */}
              <linearGradient id="react-glass-glare" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
                <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.04" />
                <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* Glass Shadow Base */}
            <ellipse cx="60" cy="148" rx="30" ry="6" className="milk-glass-shadow" />

            {/* Rising Milk Liquid Inside Glass */}
            <g clipPath="url(#react-glass-inner-clip)">
              <g className="milk-liquid-fill">
                {/* Main Milk Body */}
                <rect x="20" y="45" width="80" height="110" fill="url(#react-milk-gradient)" />

                {/* Animated Wave Surface */}
                <path
                  className="milk-wave"
                  d="M 20 45 Q 35 41, 50 45 T 80 45 T 100 45 L 100 55 L 20 55 Z"
                  fill="#FFFFFF"
                />

                {/* Micro Bubbles Rising in Milk */}
                <circle cx="46" cy="85" r="2.2" className="milk-bubble mb-1" />
                <circle cx="68" cy="105" r="1.6" className="milk-bubble mb-2" />
                <circle cx="54" cy="125" r="2.6" className="milk-bubble mb-3" />
                <circle cx="74" cy="72" r="1.8" className="milk-bubble mb-4" />
                <circle cx="60" cy="95" r="1.4" className="milk-bubble mb-5" />
              </g>
            </g>

            {/* Continuous Pouring Stream */}
            <path
              className="milk-pour-stream"
              d="M 57.5 0 L 57.5 76 Q 60 79, 62.5 76 L 62.5 0 Z"
              fill="url(#react-stream-gradient)"
            />

            {/* Splash Ripple at impact point */}
            <ellipse cx="60" cy="75" rx="8" ry="2.6" fill="#FFFFFF" className="milk-splash-ripple" />
            <circle cx="55" cy="71" r="1.4" fill="#FFFFFF" className="milk-splash-dot sd-1" />
            <circle cx="65" cy="70" r="1.2" fill="#FFFFFF" className="milk-splash-dot sd-2" />

            {/* Glass Body Shell & Glossy Highlights */}
            <path
              d="M 27 30 L 33 136 C 34 145, 86 145, 87 136 L 93 30"
              fill="url(#react-glass-glare)"
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* Glass Rim Ellipse */}
            <ellipse
              cx="60"
              cy="30"
              rx="33"
              ry="5.5"
              fill="none"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="2"
            />
            <ellipse cx="60" cy="30" rx="30" ry="4" fill="rgba(255, 255, 255, 0.12)" />

            {/* Thick Glass Bottom Base Specular Reflection */}
            <path
              d="M 36 133 C 44 141, 76 141, 84 133"
              fill="none"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Left Edge Specular Vertical Glare */}
            <path
              d="M 33 38 L 38 128"
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Loading Captions with Shimmering Glow */}
        <div className="milk-loader-text-group">
          <div className="milk-loader-title">
            <span className="milk-icon">🥛</span>
            <span className="milk-text-shimmer">{defaultText}</span>
          </div>
          {defaultSubtext && (
            <div className="milk-loader-subtext">{defaultSubtext}</div>
          )}
          {/* Subtle Dynamic Progress Bar */}
          <div className="milk-progress-track">
            <div className="milk-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
};
