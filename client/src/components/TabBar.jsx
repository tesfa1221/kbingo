import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

// SVG icons — consistent across all platforms
const TabIcons = {
  game: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#39FF14' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="3"/>
      <path d="M12 12h.01M8 12h.01M16 12h.01M12 8v8"/>
    </svg>
  ),
  leaderboard: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#39FF14' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h.01M12 3h.01M16 6h.01"/>
      <rect x="3" y="10" width="4" height="11" rx="1"/>
      <rect x="10" y="6" width="4" height="15" rx="1"/>
      <rect x="17" y="10" width="4" height="11" rx="1"/>
    </svg>
  ),
  wallet: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#39FF14' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  profile: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#39FF14' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  help: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#39FF14' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  admin: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#D4AF37' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  ),
};

const TAB_LABELS = {
  game:        'ጨዋታ',
  leaderboard: 'ምርጦች',
  wallet:      'ሂሳብ',
  profile:     'መገለጫ',
  help:        'እርዳታ',
  admin:       'አስተዳዳሪ',
};

export default function TabBar() {
  const { activeTab, setActiveTab, user, myCard, gameState } = useGameStore();

  const tabs = [
    { key: 'game' },
    { key: 'leaderboard' },
    { key: 'wallet' },
    { key: 'help' },
    { key: 'profile' },
    ...(user?.isAdmin ? [{ key: 'admin' }] : []),
  ];

  // Show a dot on game tab when it's active phase and user has a card
  const gameDot = gameState === 'ACTIVE' && myCard;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40
                    bg-charcoal/95 backdrop-blur-md border-t border-white/5">
      {/* Safe area padding for iOS */}
      <div className="flex pb-safe">
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          const isAdmin = tab.key === 'admin';

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 relative
                         transition-colors touch-manipulation"
            >
              {/* Active indicator line */}
              {active && (
                <motion.div
                  layoutId="tab-line"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: isAdmin ? '#D4AF37' : '#39FF14' }}
                />
              )}

              {/* Icon */}
              <div className="relative">
                {TabIcons[tab.key]?.(active)}
                {/* Notification dot */}
                {tab.key === 'game' && gameDot && !active && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-neon border border-charcoal" />
                )}
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-bold font-amharic transition-colors"
                style={{ color: active ? (isAdmin ? '#D4AF37' : '#39FF14') : '#6B7280' }}
              >
                {TAB_LABELS[tab.key]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
