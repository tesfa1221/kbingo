import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const COLUMN_COLORS = {
  B: '#39FF14',
  I: '#3B82F6',
  N: '#D4AF37',
  G: '#A855F7',
  O: '#EF4444',
};

function getBallLetter(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

export default function BallDisplay() {
  const { balls, latestBall, gameState, remaining, elapsed, myCard } = useGameStore();
  const [boardCollapsed, setBoardCollapsed] = useState(false);

  // Numbers on the user's card (for highlighting)
  const myNumbers = myCard
    ? new Set(myCard.grid.flat().filter(n => n !== 0))
    : new Set();

  // ── Registration phase ────────────────────────────────
  if (gameState === 'REGISTRATION') {
    const REG_DURATION = 45;
    const regElapsed   = Math.min(elapsed, REG_DURATION);
    const regRemaining = Math.max(0, REG_DURATION - regElapsed);
    // Bar DECREASES — starts full, drains to 0 as time runs out
    const pct = Math.max(0, ((REG_DURATION - regElapsed) / REG_DURATION) * 100);
    const isUrgent = regRemaining <= 10;

    return (
      <div className={`glass rounded-2xl p-4 border ${isUrgent ? 'border-danger/40' : 'border-neon/20'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`font-black text-sm font-amharic ${isUrgent ? 'text-danger' : 'text-neon'}`}>
            📝 ምዝገባ ክፍት ነው
          </p>
          <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-danger animate-pulse' : 'text-neon'}`}>
            {regRemaining}s
          </span>
        </div>

        {/* Registration progress bar — decreasing countdown */}
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden mb-3">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? 'bg-danger' : 'bg-neon'}`}
            style={{ width: `${pct}%`, transition: 'width 1s linear' }}
          />
        </div>

        {/* BINGO column rings */}
        <div className="flex justify-center gap-2">
          {['B', 'I', 'N', 'G', 'O'].map(c => (
            <motion.div
              key={c}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: ['B','I','N','G','O'].indexOf(c) * 0.3 }}
              className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm"
              style={{ borderColor: COLUMN_COLORS[c], color: COLUMN_COLORS[c], background: `${COLUMN_COLORS[c]}10` }}
            >
              {c}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (gameState !== 'ACTIVE' && !balls.length) return null;

  const letter = latestBall ? getBallLetter(latestBall) : null;
  const color  = letter ? COLUMN_COLORS[letter] : '#D4AF37';
  const isOnMyCard = latestBall && myNumbers.has(latestBall);

  return (
    <div className="glass rounded-2xl overflow-hidden border border-white/5">
      {/* ── Latest ball + recent history ── */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Big ball */}
          <AnimatePresence mode="wait">
            {latestBall && (
              <motion.div
                key={latestBall}
                initial={{ scale: 0.3, opacity: 0, y: -30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                className="relative shrink-0"
              >
                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-full blur-xl opacity-50"
                  style={{ background: color }}
                />
                <div
                  className="relative w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shadow-2xl"
                  style={{ borderColor: color, background: `${color}18` }}
                >
                  <span className="text-[10px] font-black leading-none" style={{ color }}>{letter}</span>
                  <span className="text-3xl font-black text-white leading-none">{latestBall}</span>
                </div>

                {/* "On my card!" badge */}
                {isOnMyCard && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-2 -right-2 bg-gold text-charcoal text-[9px] font-black
                               rounded-full px-1.5 py-0.5 whitespace-nowrap shadow-gold"
                  >
                    ✓ ካርዴ!
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent balls — last 5 */}
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-muted text-[10px] font-amharic mb-0.5">የቅርብ ጊዜ</p>
            <div className="flex flex-wrap gap-1">
              {balls.slice(-6, -1).reverse().map((b, i) => {
                const l = getBallLetter(b);
                const c = COLUMN_COLORS[l];
                const onCard = myNumbers.has(b);
                return (
                  <motion.div
                    key={b}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1 - i * 0.15, scale: 1 }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border relative"
                    style={{
                      borderColor: c,
                      color: c,
                      background: onCard ? `${c}25` : `${c}10`,
                    }}
                  >
                    {b}
                    {onCard && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gold border border-charcoal" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setBoardCollapsed(v => !v)}
            className="shrink-0 text-muted hover:text-white transition-colors p-1"
          >
            <motion.span
              animate={{ rotate: boardCollapsed ? 180 : 0 }}
              className="block text-xs"
            >
              ▼
            </motion.span>
          </button>
        </div>
      </div>

      {/* ── Drawn balls board — collapsible ── */}
      <AnimatePresence>
        {!boardCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-3">
              <div className="grid grid-cols-5 gap-1">
                {['B', 'I', 'N', 'G', 'O'].map(col => {
                  const colColor = COLUMN_COLORS[col];
                  const colBalls = balls.filter(b => getBallLetter(b) === col);

                  return (
                    <div key={col} className="flex flex-col gap-1">
                      {/* Column header */}
                      <div
                        className="text-center text-[10px] font-black py-0.5 rounded"
                        style={{ color: colColor, background: `${colColor}15` }}
                      >
                        {col}
                      </div>
                      {/* Balls in column */}
                      <div className="flex flex-wrap gap-0.5">
                        {colBalls.map(b => {
                          const onCard = myNumbers.has(b);
                          return (
                            <motion.div
                              key={b}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{
                                background: onCard ? `${colColor}40` : `${colColor}20`,
                                color: colColor,
                                border: `1px solid ${colColor}${onCard ? '80' : '40'}`,
                                boxShadow: onCard ? `0 0 4px ${colColor}60` : 'none',
                              }}
                            >
                              {b}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ball count */}
              <p className="text-center text-muted text-[10px] mt-2 font-amharic">
                {balls.length} / 75 ቁጥሮች ተጠርተዋል
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
