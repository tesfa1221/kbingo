import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function WatcherOverlay() {
  const { isWatcher, remaining } = useGameStore();

  // Format next round countdown
  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <AnimatePresence>
      {isWatcher && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="sticky top-0 z-30 mx-3 mt-2"
        >
          <div className="flex items-center justify-between gap-3
                          bg-surface border border-gold/30 rounded-xl px-4 py-2.5
                          shadow-lg">
            {/* Left: watcher label */}
            <div className="flex items-center gap-2">
              <span className="text-base">👁️</span>
              <div>
                <p className="text-gold font-bold text-xs font-amharic leading-tight">
                  ተመልካች ብቻ
                </p>
                <p className="text-muted text-[10px] font-amharic leading-tight">
                  የዚህ ዙር ጨዋታ ተጀምሯል
                </p>
              </div>
            </div>

            {/* Right: next round countdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-muted text-[10px] font-amharic">ቀጣይ ዙር</span>
              <div className="bg-surface2 rounded-lg px-2 py-1">
                <span className="text-neon font-mono font-black text-sm tabular-nums">
                  {mins}:{secs}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
