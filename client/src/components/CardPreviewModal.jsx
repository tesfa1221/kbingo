import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const COLS = ['B', 'I', 'N', 'G', 'O'];

export default function CardPreviewModal({ card, onConfirm, onClose }) {
  const { entryFee, user } = useGameStore();
  const { cardNumber, grid } = card;

  const balance        = parseFloat(user?.balance || 0);
  const remainingAfter = balance - entryFee;
  const canAfford      = balance >= entryFee;
  const lowBalance     = canAfford && remainingAfter < 20;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1,   y: 0 }}
        exit={{ scale: 0.8,    y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="glass rounded-2xl p-5 w-full max-w-xs"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gold font-black text-lg">ካርድ #{cardNumber}</h3>
          <button onClick={onClose} className="text-muted hover:text-white text-xl">✕</button>
        </div>

        {/* Mini Bingo Card */}
        <div className="rounded-xl overflow-hidden border border-gold/30 mb-4">
          {/* Column headers */}
          <div className="grid grid-cols-5 bg-gold/10">
            {COLS.map(c => (
              <div key={c} className="text-center py-2 text-gold font-black text-sm border-r border-gold/20 last:border-0">
                {c}
              </div>
            ))}
          </div>
          {/* Rows */}
          {grid.map((row, r) => (
            <div key={r} className="grid grid-cols-5 border-t border-white/5">
              {row.map((cell, c) => {
                const isFree = r === 2 && c === 2;
                return (
                  <div
                    key={c}
                    className={`
                      aspect-square flex items-center justify-center text-sm font-bold
                      border-r border-white/5 last:border-0
                      ${isFree ? 'bg-gold/20 text-gold' : 'text-white'}
                    `}
                  >
                    {isFree ? (
                      <span className="text-gold font-black text-base">K</span>
                    ) : cell}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Balance info */}
        <div className="bg-surface2 rounded-xl p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted font-amharic">ቀሪ ሂሳብ</span>
            <span className="text-white font-bold">{balance.toFixed(2)} ETB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted font-amharic">የመግቢያ ክፍያ</span>
            <span className="text-neon font-bold">-{entryFee} ETB</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1">
            <span className="text-muted font-amharic">ከክፍያ በኋላ</span>
            <span className={`font-bold ${canAfford ? 'text-white' : 'text-danger'}`}>
              {remainingAfter.toFixed(2)} ETB
            </span>
          </div>
        </div>

        {/* Warnings */}
        {!canAfford && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 mb-3 text-center">
            <p className="text-danger text-sm font-bold font-amharic">ሂሳብ ያልበቃ</p>
            <p className="text-danger/80 text-xs font-amharic">ቢያንስ {entryFee} ETB ያስፈልጋል</p>
          </div>
        )}
        {lowBalance && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2 mb-3 text-center">
            <p className="text-orange-400 text-xs font-amharic">⚠️ ከክፍያ በኋላ ሂሳብ ዝቅ ይላል (ከ20 ETB በታች)</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-muted font-semibold hover:border-white/20 transition-colors"
          >
            ሰርዝ
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            disabled={!canAfford}
            className="flex-1 py-3 rounded-xl bg-neon text-charcoal font-black hover:bg-neon/90 transition-colors shadow-neon disabled:opacity-40 disabled:cursor-not-allowed"
          >
            አረጋግጥ
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
