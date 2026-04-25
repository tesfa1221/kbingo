import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function LowBalanceBanner() {
  const { user, entryFee, setActiveTab, gameState, myCard } = useGameStore();

  if (!user) return null;

  const balance    = parseFloat(user.balance || 0);
  const canAfford  = balance >= entryFee;
  const isLow      = balance < entryFee * 3 && balance >= entryFee; // low but can still play
  const isBroke    = !canAfford;

  // Only show during registration when user hasn't picked a card yet
  const show = (isBroke || isLow) && gameState === 'REGISTRATION' && !myCard;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          onClick={() => setActiveTab('wallet')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left
            ${isBroke
              ? 'bg-danger/10 border-danger/30'
              : 'bg-orange-500/10 border-orange-500/30'}`}
        >
          <span className="text-2xl shrink-0">{isBroke ? '⚠️' : '💡'}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm font-amharic
              ${isBroke ? 'text-danger' : 'text-orange-400'}`}>
              {isBroke ? 'ሂሳብ አልቆብሃል!' : 'ሂሳብ እያለቀ ነው'}
            </p>
            <p className="text-muted text-xs font-amharic">
              {isBroke
                ? `ለመጫወት ቢያንስ ${entryFee} ETB ያስፈልጋል — ጠቅ ያድርጉ ለማስቀመጥ`
                : `ቀሪ ሂሳብ: ${balance.toFixed(2)} ETB — ጠቅ ያድርጉ ለማስቀመጥ`}
            </p>
          </div>
          <span className={`text-xs font-bold shrink-0
            ${isBroke ? 'text-danger' : 'text-orange-400'}`}>
            ጨምር →
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
