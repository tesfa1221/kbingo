import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { initAudio } from '../utils/audio';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TOTAL = 180;

const Icons = {
  logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  soundOn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ),
  soundOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ),
};

export default function Header() {
  const { gameCode, playerCount, netPrize, remaining, gameState, user, entryFee,
          logout, audioOn, setAudioOn } = useGameStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    toast('ወጥተዋል', { icon: '👋' });
    setShowMenu(false);
  };

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    if (next) initAudio();
    toast(next ? '🔊 ድምፅ ተከፈተ' : '🔇 ድምፅ ተዘጋ', { duration: 1500 });
  };

  const isReg    = gameState === 'REGISTRATION';
  const isActive = gameState === 'ACTIVE';
  const regSecsLeft = Math.max(0, remaining - (TOTAL - 60));
  const timerColor  = remaining <= 10 ? '#FF4444' : isActive ? '#D4AF37' : '#39FF14';
  const progress    = Math.min(100, ((TOTAL - remaining) / TOTAL) * 100);

  return (
    <header className="sticky top-0 z-40 bg-charcoal/95 backdrop-blur-md border-b border-white/5">
      {/* Progress bar */}
      <div className="h-0.5 bg-surface2 overflow-hidden">
        <motion.div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: isActive
              ? 'linear-gradient(90deg, #D4AF37, #F0D060)'
              : 'linear-gradient(90deg, #39FF14, #00ff88)',
            transition: 'width 1s linear',
          }}
        />
      </div>

      <div className="px-4 pt-2 pb-2">
        {/* Single compact row */}
        <div className="flex items-center gap-2">
          {/* Logo — compact */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/50 flex items-center justify-center">
              <span className="text-gold font-black text-xs">K</span>
            </div>
            <span className="text-gradient-gold font-black text-sm font-amharic hidden xs:block">
              K Bingo
            </span>
          </div>

          {/* Stats row — compact pills */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Players */}
            <div className="flex items-center gap-1 bg-surface2 rounded-full px-2 py-0.5 text-[11px]">
              <span className="text-white/50">👥</span>
              <span className="text-white font-bold">{playerCount}</span>
            </div>

            {/* Prize */}
            <div className="flex items-center gap-1 bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5 text-[11px]">
              <span className="text-gold font-bold">
                {netPrize > 0 ? netPrize.toFixed(0) : (playerCount * entryFee * 0.8).toFixed(0)}
              </span>
              <span className="text-gold/60 font-amharic text-[9px]">ደራሽ</span>
            </div>

            {/* Phase */}
            <div className={`rounded-full px-2 py-0.5 text-[11px] font-bold border
              ${isReg    ? 'bg-neon/10 text-neon border-neon/30' : ''}
              ${isActive ? 'bg-gold/10 text-gold border-gold/30' : ''}
              ${!isReg && !isActive ? 'bg-surface2 text-muted border-white/5' : ''}
            `}>
              {isReg && 'ምዝገባ'}
              {isActive && 'ጨዋታ'}
              {!isReg && !isActive && '---'}
            </div>
          </div>

          {/* Timer — right side */}
          <motion.div
            key={remaining}
            className="font-mono font-black text-xl tabular-nums shrink-0"
            style={{ color: timerColor }}
            animate={remaining <= 10 ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {String(Math.floor(remaining / 60)).padStart(2, '0')}:
            {String(remaining % 60).padStart(2, '0')}
          </motion.div>

          {/* Sound toggle + User avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleAudio}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors
                ${audioOn
                  ? 'bg-neon/10 border-neon/30 text-neon'
                  : 'bg-surface2 border-white/10 text-muted'}`}
            >
              {audioOn ? Icons.soundOn : Icons.soundOff}
            </button>

            {user && (
              <button onClick={() => setShowMenu(v => !v)}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold/40 to-gold/10 border border-gold/40 flex items-center justify-center">
                  <span className="text-gold text-[11px] font-black">
                    {(user.firstName || user.username || 'U')[0].toUpperCase()}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Balance bar — slim, below main row */}
        {user && (
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span className="text-muted truncate max-w-[120px]">
              {user.firstName || user.username}
              {user.isAdmin && <span className="ml-1 text-gold">★</span>}
            </span>
            <span className="text-neon font-bold">
              {parseFloat(user.balance || 0).toFixed(2)} ETB
            </span>
          </div>
        )}

        {/* Registration urgency bar */}
        {isReg && regSecsLeft <= 20 && regSecsLeft > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1.5 bg-neon/10 border border-neon/30 rounded-lg px-3 py-1 text-center"
          >
            <span className="text-neon text-xs font-bold font-amharic animate-pulse">
              ⚡ ምዝገባ ሊያልቅ፡ {regSecsLeft} ሰከንድ
            </span>
          </motion.div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-3 top-full mt-1 w-52 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white font-semibold text-sm">{user?.firstName || user?.username}</p>
                <p className="text-muted text-xs">@{user?.username}</p>
                <p className="text-neon text-xs font-bold mt-0.5">
                  {parseFloat(user?.balance || 0).toFixed(2)} ETB
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-danger text-sm
                           hover:bg-danger/10 transition-colors font-amharic"
              >
                {Icons.logout}
                ውጣ
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
