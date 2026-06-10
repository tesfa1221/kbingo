import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BingoFlash({ show, isWinner, winnerName, onDone }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: isWinner
                ? 'radial-gradient(circle at center, #D4AF3730 0%, transparent 70%)'
                : 'radial-gradient(circle at center, #39FF1420 0%, transparent 70%)',
            }}
          />

          <div className="relative flex flex-col items-center gap-4">
            <motion.p
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.3, 1.0], opacity: 1 }}
              transition={{ duration: 0.5, times: [0, 0.6, 1] }}
              className="font-black leading-none text-center"
              style={{
                fontSize: '5rem',
                color: isWinner ? '#D4AF37' : '#39FF14',
                textShadow: isWinner
                  ? '0 0 40px #D4AF37, 0 0 80px #D4AF3780'
                  : '0 0 40px #39FF14, 0 0 80px #39FF1480',
                letterSpacing: '0.1em',
              }}
            >
              BINGO!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="text-center"
            >
              {isWinner ? (
                <>
                  <p className="text-gold font-black text-2xl font-amharic">🏆 አሸነፍህ!</p>
                  <p className="text-white/60 text-sm font-amharic mt-1">ሽልማቱ ወደ ሂሳብህ ገብቷል</p>
                </>
              ) : (
                <p className="text-neon font-bold text-lg font-amharic">
                  {winnerName ? `🏆 ${winnerName} አሸነፈ!` : '🏆 አሸናፊ ተገኘ!'}
                </p>
              )}
            </motion.div>

            <div className="flex gap-2 mt-1">
              {[0,1,2,3,4].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  className="w-2 h-2 rounded-full"
                  style={{ background: isWinner ? '#D4AF37' : '#39FF14' }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
