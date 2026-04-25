import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ProfilePanel() {
  const { user, setUser } = useGameStore();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Refresh user data
    api.get('/auth/me').then(({ user: u }) => setUser(u)).catch(() => {});

    // Load transaction summary
    api.get('/wallet/transactions').then(({ transactions }) => {
      const wins      = transactions.filter(t => t.type === 'PRIZE');
      const entries   = transactions.filter(t => t.type === 'ENTRY_FEE');
      const deposits  = transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'APPROVED');
      const totalWon  = wins.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalSpent = entries.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalDeposited = deposits.reduce((s, t) => s + parseFloat(t.amount), 0);
      setStats({ totalWon, totalSpent, totalDeposited, gamesPlayed: entries.length });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const winRate = stats?.gamesPlayed > 0
    ? ((user.totalWins / stats.gamesPlayed) * 100).toFixed(0)
    : 0;

  const statCards = [
    { icon: '🎮', label: 'ጨዋታዎች',   value: stats?.gamesPlayed || 0,                color: 'text-white' },
    { icon: '🏆', label: 'አሸናፊ',     value: user.totalWins || 0,                    color: 'text-gold' },
    { icon: '📈', label: 'Win Rate',  value: `${winRate}%`,                          color: 'text-neon' },
    { icon: '💰', label: 'ደራሽ',      value: `${parseFloat(user.totalWinnings||0).toFixed(0)} ETB`, color: 'text-gold' },
    { icon: '💸', label: 'ወጪ',       value: `${(stats?.totalSpent||0).toFixed(0)} ETB`,  color: 'text-danger' },
    { icon: '📥', label: 'ተቀምጧል',   value: `${(stats?.totalDeposited||0).toFixed(0)} ETB`, color: 'text-neon' },
  ];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Profile card */}
      <div className="glass rounded-2xl p-5 border border-gold/20 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold/40 to-gold/10
                        border-2 border-gold/50 flex items-center justify-center mx-auto mb-3">
          <span className="text-gold font-black text-3xl">
            {(user.firstName || user.username || 'U')[0].toUpperCase()}
          </span>
        </div>
        <h2 className="text-white font-black text-xl">{user.firstName || user.username}</h2>
        <p className="text-muted text-sm">@{user.username}</p>
        {user.isAdmin && (
          <span className="inline-block mt-1 bg-gold/20 text-gold text-xs font-bold px-2 py-0.5 rounded-full border border-gold/30">
            ★ Admin
          </span>
        )}

        {/* Referral code */}
        {user.referralCode && (
          <div className="mt-3 bg-surface2 rounded-xl p-3 border border-neon/20">
            <p className="text-muted text-xs font-amharic mb-1">🎁 የሪፈራል ኮድ</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(user.referralCode).catch(() => {});
                toast.success('ኮድ ተቀድቷል!');
              }}
              className="flex items-center gap-2 w-full"
            >
              <span className="text-neon font-black text-xl tracking-widest">{user.referralCode}</span>
              <span className="text-muted text-xs ml-auto">ቅዳ →</span>
            </button>
            <p className="text-muted text-[10px] font-amharic mt-1">
              ጓደኛ ሲመዘገብ ሁለታችሁ 30 ETB ትቀበላላችሁ
            </p>
          </div>
        )}

        {/* Balance */}
        <div className="mt-4 bg-surface2 rounded-xl p-3">
          <p className="text-muted text-xs font-amharic">ቀሪ ሂሳብ</p>
          <p className="text-gradient-gold font-black text-3xl">
            {parseFloat(user.balance || 0).toFixed(2)}
          </p>
          <p className="text-gold text-xs">ETB</p>
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-neon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-3 text-center border border-white/5"
            >
              <p className="text-xl mb-1">{s.icon}</p>
              <p className={`font-black text-sm ${s.color}`}>{s.value}</p>
              <p className="text-muted text-[10px] font-amharic mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rank badge */}
      {user.totalWins > 0 && (
        <div className="glass rounded-2xl p-4 border border-gold/20 flex items-center gap-3">
          <span className="text-3xl">
            {user.totalWins >= 10 ? '👑' : user.totalWins >= 5 ? '🥇' : user.totalWins >= 2 ? '🥈' : '🥉'}
          </span>
          <div>
            <p className="text-gold font-bold text-sm font-amharic">
              {user.totalWins >= 10 ? 'ቻምፒዮን' : user.totalWins >= 5 ? 'ምርጥ ተጫዋች' : user.totalWins >= 2 ? 'ልምድ ያለው' : 'ጀማሪ አሸናፊ'}
            </p>
            <p className="text-muted text-xs font-amharic">{user.totalWins} ጊዜ አሸንፏል</p>
          </div>
        </div>
      )}
    </div>
  );
}
