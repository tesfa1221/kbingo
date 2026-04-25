import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../hooks/useSocket';
import api from '../utils/api';
import CardPreviewModal from './CardPreviewModal';
import toast from 'react-hot-toast';

// BINGO columns: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75
// Cards 1-100 are grouped into 5 columns of 20 cards each
const COLS = ['B', 'I', 'N', 'G', 'O'];
const COL_COLORS = {
  B: '#39FF14',
  I: '#3B82F6',
  N: '#D4AF37',
  G: '#A855F7',
  O: '#EF4444',
};

// Map card number to column: 1-20→B, 21-40→I, 41-60→N, 61-80→G, 81-100→O
function getCardCol(num) {
  if (num <= 20) return 'B';
  if (num <= 40) return 'I';
  if (num <= 60) return 'N';
  if (num <= 80) return 'G';
  return 'O';
}

export default function CardGrid() {
  const { takenCards, gameState, user, myCard } = useGameStore();
  const [previewCard, setPreviewCard]     = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(null);

  const isRegistration = gameState === 'REGISTRATION';
  const takenCount     = Object.keys(takenCards).length;

  const handleCardClick = useCallback(async (num) => {
    if (!isRegistration) return;
    if (takenCards[num]) return;
    if (!user) { toast.error('ለመጫወት ይግቡ'); return; }

    setLoadingPreview(num);
    try {
      const data = await api.get(`/game/card/${num}`);
      setPreviewCard(data);
    } catch {
      toast.error('ካርድ ማስጫን አልተቻለም');
    } finally {
      setLoadingPreview(null);
    }
  }, [isRegistration, takenCards, user]);

  const handleConfirm = useCallback(() => {
    if (!previewCard) return;
    const socket = getSocket();
    if (socket) socket.emit('card:select', { cardNumber: previewCard.cardNumber });
    setPreviewCard(null);
  }, [previewCard]);

  if (myCard) return null;

  return (
    <div className="glass rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gold font-bold text-sm font-amharic">ካርድ ምረጥ</h2>
        <div className="flex items-center gap-2">
          {isRegistration && (
            <span className="text-muted text-xs">
              <span className="text-danger font-bold">{takenCount}</span>
              <span className="text-muted">/100 ተወስዷል</span>
            </span>
          )}
          {!isRegistration && gameState !== 'IDLE' && (
            <span className="text-danger text-xs font-amharic font-bold">ምዝገባ ተዘግቷል</span>
          )}
        </div>
      </div>

      {/* 5-column layout grouped by BINGO letter */}
      <div className="grid grid-cols-5 gap-2">
        {COLS.map((col, ci) => {
          const start = ci * 20 + 1;
          const end   = start + 19;
          const color = COL_COLORS[col];

          return (
            <div key={col} className="flex flex-col gap-1">
              {/* Column header */}
              <div
                className="text-center py-1.5 rounded-lg text-sm font-black mb-0.5"
                style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
              >
                {col}
              </div>

              {/* Cards in this column */}
              {Array.from({ length: 20 }, (_, i) => start + i).map((num) => {
                const takenByUserId = takenCards[num];
                const taken   = !!takenByUserId;
                const isMe    = takenByUserId === user?.id;
                const loading = loadingPreview === num;

                return (
                  <motion.button
                    key={num}
                    whileTap={!taken && isRegistration && user ? { scale: 0.88 } : {}}
                    onClick={() => handleCardClick(num)}
                    disabled={taken || !isRegistration || !user}
                    className={`
                      w-full h-9 rounded-lg text-xs font-bold
                      flex items-center justify-center relative
                      transition-all duration-100 touch-manipulation select-none
                      ${isMe
                        ? 'text-charcoal font-black'
                        : taken
                        ? 'opacity-40 cursor-not-allowed'
                        : isRegistration && user
                        ? 'cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                      }
                    `}
                    style={
                      isMe
                        ? { background: color, boxShadow: `0 0 8px ${color}60` }
                        : taken
                        ? { background: '#FF444420', border: '1px solid #FF444430' }
                        : isRegistration && user
                        ? {
                            background: '#2A2A2A',
                            border: `1px solid ${color}20`,
                          }
                        : { background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.05)' }
                    }
                  >
                    {loading ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                        style={{ color }}
                      >
                        ⟳
                      </motion.span>
                    ) : (
                      <>
                        <span style={isMe ? {} : { color: taken ? '#FF4444' : 'white' }}>
                          {num}
                        </span>
                        {taken && !isMe && (
                          <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-danger" />
                        )}
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-[11px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-surface2 border border-white/10" />
          <span className="text-muted">ነፃ</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-danger/20 border border-danger/30" />
          <span className="text-muted">ተያዘ</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-neon" />
          <span className="text-muted">የኔ</span>
        </div>
        <div className="ml-auto text-muted">
          ክፍያ: <span className="text-neon font-bold">10 ETB</span>
        </div>
      </div>

      <AnimatePresence>
        {previewCard && (
          <CardPreviewModal
            card={previewCard}
            onConfirm={handleConfirm}
            onClose={() => setPreviewCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
