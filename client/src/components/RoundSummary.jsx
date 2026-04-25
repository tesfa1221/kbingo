import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const PATTERN_LABELS = {
  HORIZONTAL:   'አግድም መስመር',
  VERTICAL:     'ቀጥ ያለ መስመር',
  DIAGONAL:     'ሰያፍ መስመር',
  FOUR_CORNERS: 'አራት ማዕዘን',
  FULL_HOUSE:   'ሙሉ ካርድ',
};

export default function RoundSummary() {
  const { lastRound, gameState } = useGameStore();

  // Only show during REGISTRATION phase (between rounds)
  const show = gameState === 'REGISTRATION' && lastRound;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="glass rounded-2xl p-4 border border-gold/20"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📋</span>
            <p className="text-gold font-bold text-sm font-amharic">የቀደመው ዙር ውጤት</p>
            <span className="ml-auto text-muted text-[10px] font-mono">
              {lastRound.gameCode?.replace('BNG-', '')}
            </span>
          </div>

          {lastRound.winners?.length > 0 ? (
            <>
              {/* Winners */}
              {lastRound.winners.map((w, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                    <span className="text-gold font-black text-sm">🏆</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">
                      {w.firstName || w.username || `User #${w.userId}`}
                    </p>
                    <p className="text-muted text-[10px] font-amharic">
                      {PATTERN_LABELS[w.pattern] || w.pattern}
                    </p>
                  </div>
                  <p className="text-gold font-black text-sm">
                    +{parseFloat(lastRound.prizeShare || 0).toFixed(0)} ETB
                  </p>
                </div>
              ))}

              {/* Stats row */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <div className="flex-1 bg-surface2 rounded-xl p-2 text-center">
                  <p className="text-white font-bold text-sm">{lastRound.balls?.length || 0}</p>
                  <p className="text-muted text-[10px] font-amharic">ቁጥሮች</p>
                </div>
                <div className="flex-1 bg-surface2 rounded-xl p-2 text-center">
                  <p className="text-gold font-bold text-sm">
                    {parseFloat(lastRound.prizeShare || 0).toFixed(0)} ETB
                  </p>
                  <p className="text-muted text-[10px] font-amharic">ደራሽ</p>
                </div>
                <div className="flex-1 bg-surface2 rounded-xl p-2 text-center">
                  <p className="text-neon font-bold text-sm">{lastRound.winners?.length || 0}</p>
                  <p className="text-muted text-[10px] font-amharic">አሸናፊ</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-muted text-sm font-amharic">ምንም አሸናፊ አልነበረም</p>
              <p className="text-muted text-[10px] font-amharic mt-0.5">
                {lastRound.balls?.length || 0} ቁጥሮች ተጠርተዋል
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
