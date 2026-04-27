import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../hooks/useSocket';
import { playHapticPulse, playDrumRoll } from '../utils/audio';
import toast from 'react-hot-toast';

const COLS       = ['B', 'I', 'N', 'G', 'O'];
const COL_COLORS = ['#39FF14', '#3B82F6', '#D4AF37', '#A855F7', '#EF4444'];

function useJustCalled(balls) {
  const prev = useRef(new Set());
  const [justCalled, setJustCalled] = useState(new Set());
  useEffect(() => {
    const newBalls = balls.filter(b => !prev.current.has(b));
    if (newBalls.length > 0) {
      setJustCalled(new Set(newBalls));
      newBalls.forEach(b => prev.current.add(b));
      const t = setTimeout(() => setJustCalled(new Set()), 2200);
      return () => clearTimeout(t);
    }
  }, [balls]);
  return justCalled;
}

function BingoCard({ card, balls, onToggle, isActive }) {
  const justCalled = useJustCalled(balls);
  const drawnSet   = new Set(balls);
  const { markedCells } = card;

  const isCellMarked     = (r, c) => markedCells.some(([mr, mc]) => mr === r && mc === c);
  const isCellDrawn      = (val)  => val === 0 || drawnSet.has(val);
  const isCellJustCalled = (val)  => val !== 0 && justCalled.has(val);

  const markedCount = markedCells.filter(([r, c]) => !(r === 2 && c === 2)).length;

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all ${isActive ? 'border-gold/40' : 'border-white/10'}`}>
      {/* Card header */}
      <div className={`flex items-center justify-between px-3 py-1.5 ${isActive ? 'bg-gold/10' : 'bg-surface2'}`}>
        <span className="text-xs font-bold" style={{ color: isActive ? '#D4AF37' : '#6B7280' }}>
          ካርድ #{card.cardNumber}
        </span>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full transition-all ${i < markedCount ? 'bg-neon' : 'bg-surface2'}`} />
            ))}
          </div>
          <span className="text-neon text-[10px] font-bold ml-1">{markedCount}/24</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-5 bg-surface">
        {COLS.map((col, ci) => (
          <div key={col} className="py-1.5 text-center font-black text-sm border-r border-white/5 last:border-0"
            style={{ color: COL_COLORS[ci] }}>
            {col}
          </div>
        ))}
      </div>

      {/* Grid */}
      {card.grid.map((row, r) => (
        <div key={r} className="grid grid-cols-5 border-t border-white/5">
          {row.map((cell, c) => {
            const isFree         = r === 2 && c === 2;
            const marked         = isCellMarked(r, c);
            const drawn          = isCellDrawn(cell);
            const justCalledCell = isCellJustCalled(cell);
            const canMark        = drawn && !isFree && isActive;

            return (
              <motion.button
                key={c}
                whileTap={canMark ? { scale: 0.82 } : {}}
                onClick={() => canMark && onToggle(r, c, card.cardNumber)}
                disabled={!canMark && !isFree}
                className={`
                  relative min-h-[44px] flex items-center justify-center
                  text-sm font-bold border-r border-white/5 last:border-0
                  transition-colors duration-200 select-none touch-manipulation
                  ${isFree  ? 'bg-gold/15 cursor-default' : ''}
                  ${marked  ? 'bg-neon/15 cursor-pointer' : ''}
                  ${!isFree && !marked && drawn  ? 'bg-surface2 cursor-pointer' : ''}
                  ${!isFree && !drawn  ? 'bg-charcoal cursor-default' : ''}
                `}
              >
                {isFree ? (
                  <span className="text-gold font-black text-base">K</span>
                ) : (
                  <>
                    <span className={`relative z-10 transition-colors duration-200
                      ${marked ? 'text-neon' : drawn ? 'text-white' : 'text-white/25'}`}>
                      {cell}
                    </span>
                    <AnimatePresence>
                      {marked && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="absolute inset-1 rounded-lg border-2 border-neon bg-neon/10 pointer-events-none"
                        />
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {justCalledCell && !marked && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 1] }}
                          transition={{ duration: 1.8, times: [0, 0.2, 0.7, 1] }}
                          className="absolute inset-0 rounded pointer-events-none"
                          style={{ background: 'radial-gradient(circle, #D4AF3770 0%, transparent 70%)' }}
                        />
                      )}
                    </AnimatePresence>
                    {drawn && !marked && (
                      <motion.div
                        animate={justCalledCell ? { scale: [1, 2, 1], backgroundColor: ['#D4AF37', '#F0D060', '#D4AF37'] } : {}}
                        transition={{ duration: 0.6 }}
                        className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-gold"
                      />
                    )}
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function GameBoard() {
  const { myCards, balls, gameState, toggleMark, autoMark, setAutoMark } = useGameStore();
  const [bingoStep, setBingoStep] = useState(0);
  const [activeCardIdx, setActiveCardIdx] = useState(0);

  if (!myCards || myCards.length === 0) return null;

  const handleCellClick = (r, c, cardNumber) => {
    if (gameState !== 'ACTIVE') return;
    playHapticPulse();
    toggleMark(r, c, cardNumber);
  };

  const handleBingo = () => {
    if (bingoStep !== 0) return;
    setBingoStep(1);
    playDrumRoll();
    setTimeout(() => {
      getSocket()?.emit('bingo:claim');
      setBingoStep(0);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Auto-mark toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-muted text-xs font-amharic">
          {myCards.length === 2 ? '2 ካርዶች' : '1 ካርድ'}
        </span>
        <button
          onClick={() => setAutoMark(!autoMark)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all
            ${autoMark ? 'bg-neon/15 text-neon border-neon/40' : 'bg-surface2 text-muted border-white/10'}`}
        >
          <span>{autoMark ? '⚡' : '✋'}</span>
          <span className="font-amharic">ራስ-ምልክት</span>
          <div className={`w-6 h-3 rounded-full transition-colors relative ${autoMark ? 'bg-neon' : 'bg-surface2 border border-white/20'}`}>
            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${autoMark ? 'left-3.5' : 'left-0.5'}`} />
          </div>
        </button>
      </div>

      {/* Card tab switcher if 2 cards */}
      {myCards.length === 2 && (
        <div className="flex gap-2">
          {myCards.map((card, i) => (
            <button
              key={card.cardNumber}
              onClick={() => setActiveCardIdx(i)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                ${activeCardIdx === i
                  ? 'bg-gold/15 border-gold/50 text-gold'
                  : 'bg-surface2 border-white/5 text-muted'}`}
            >
              ካርድ #{card.cardNumber}
            </button>
          ))}
        </div>
      )}

      {/* Show active card (or both stacked if only 1) */}
      {myCards.length === 1 ? (
        <BingoCard
          card={myCards[0]}
          balls={balls}
          onToggle={handleCellClick}
          isActive={gameState === 'ACTIVE'}
        />
      ) : (
        <BingoCard
          card={myCards[activeCardIdx]}
          balls={balls}
          onToggle={handleCellClick}
          isActive={gameState === 'ACTIVE'}
        />
      )}

      {/* BINGO Button */}
      {gameState === 'ACTIVE' && (
        <AnimatePresence mode="wait">
          {bingoStep === 0 && (
            <motion.button key="idle"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              whileTap={{ scale: 0.95 }} onClick={handleBingo}
              className="w-full py-5 rounded-2xl font-black text-2xl tracking-widest
                         bg-gradient-to-r from-neon/80 to-neon text-charcoal shadow-neon relative overflow-hidden">
              BINGO!
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            </motion.button>
          )}
          {bingoStep === 1 && (
            <motion.div key="claiming" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="w-full py-5 rounded-2xl bg-gold/20 border border-gold/40 text-center">
              <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.3, repeat: Infinity }}
                className="text-gold font-black text-xl">🥁 እየተረጋገጠ...</motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {gameState === 'REGISTRATION' && (
        <div className="glass rounded-2xl p-5 text-center border border-neon/20">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-neon font-bold font-amharic text-sm">ጨዋታ ሊጀምር ነው</p>
          <p className="text-muted text-xs font-amharic mt-1">ቁጥሮቹ ሲጠሩ ምልክት ያድርጉ</p>
        </div>
      )}

      {gameState === 'FINISHED' && (
        <div className="glass rounded-2xl p-5 text-center border border-gold/20">
          <div className="text-3xl mb-2">🔄</div>
          <p className="text-gold font-bold font-amharic text-sm">ዙር ተጠናቀቀ</p>
          <p className="text-muted text-xs font-amharic mt-1">ቀጣይ ዙር ይጀምራል...</p>
        </div>
      )}
    </div>
  );
}
