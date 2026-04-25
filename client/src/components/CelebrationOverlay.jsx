import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
import { useGameStore } from '../store/gameStore';

export default function CelebrationOverlay() {
  const { winners, prizeShare, clearCelebration, user } = useGameStore();
  const isWinner  = winners.some(w => w.userId === user?.id);
  const isRefund  = useGameStore.getState().lastRound?.refund;

  useEffect(() => {
    const t = setTimeout(clearCelebration, 10000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
        colors={['#39FF14', '#D4AF37', '#F0D060', '#ffffff', '#3B82F6']}
        numberOfPieces={isWinner ? 300 : 150}
        recycle={false}
      />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="glass rounded-3xl p-8 mx-6 text-center border border-gold/30 relative z-10"
        style={{ maxWidth: 320 }}
      >
        {isWinner ? (
          <>
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="text-6xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-gradient-gold font-black text-3xl mb-2">
              {isRefund ? 'ተመልሷል!' : 'አሸነፍህ!'}
            </h2>
            <p className="text-white/80 text-sm mb-1 font-amharic">
              {isRefund ? 'ብቸኛ ተጫዋች ነህ — ክፍያህ ተመልሷል' : `እንኳን ደስ አለህ!`}
            </p>
            <p className="text-white/80 text-sm mb-1 font-amharic">
              እንኳን ደስ አለህ, <span className="text-gold font-bold">
                {winners.find(w => w.userId === user?.id)?.firstName ||
                 winners.find(w => w.userId === user?.id)?.username ||
                 user?.firstName || user?.username}
              </span>!
            </p>
            <div className="bg-gold/10 border border-gold/30 rounded-2xl px-6 py-4 mb-4">
              {/* Coin stack animation */}
              <div className="flex justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="w-6 h-6 rounded-full bg-gold border-2 border-goldLight flex items-center justify-center text-xs font-black text-charcoal"
                  >
                    $
                  </motion.div>
                ))}
              </div>
              <p className="text-gold font-black text-2xl">
                {prizeShare?.toFixed(2)} ETB
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-white font-black text-2xl mb-3">BINGO!</h2>

            {/* Show winner names */}
            <div className="flex flex-col gap-2 mb-4">
              {winners.map((w, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface2 rounded-xl px-3 py-2">
                  <span className="text-gold text-base">🏆</span>
                  <span className="text-white font-bold text-sm">
                    {w.firstName || w.username || `User #${w.userId}`}
                  </span>
                  <span className="ml-auto text-gold font-black text-sm">
                    +{parseFloat(prizeShare || 0).toFixed(0)} ETB
                  </span>
                </div>
              ))}
            </div>

            {winners.length > 1 && (
              <p className="text-muted text-xs font-amharic mb-2">
                {winners.length} አሸናፊዎች — ሽልማት ተካፍሏል
              </p>
            )}
          </>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={clearCelebration}
          className="mt-4 w-full py-3 rounded-xl bg-neon text-charcoal font-black"
        >
          ቀጥል
        </motion.button>
      </motion.div>
    </div>
  );
}
