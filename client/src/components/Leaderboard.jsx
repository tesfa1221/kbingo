import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';

const MEDALS = ['🥇', '🥈', '🥉'];

const PATTERN_LABELS = {
  HORIZONTAL:   'አግድም መስመር',
  VERTICAL:     'ቀጥ ያለ መስመር',
  DIAGONAL:     'ሰያፍ መስመር',
  FOUR_CORNERS: 'አራት ማዕዘን',
  FULL_HOUSE:   'ሙሉ ካርድ',
};

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/game/leaderboard'),
      api.get('/game/history'),
    ]).then(([lb, hist]) => {
      setLeaders(lb.leaderboard || []);
      setHistory(hist.history || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4 bg-surface rounded-xl p-1">
        {[['weekly', 'ሳምንታዊ ምርጦች'], ['history', 'ታሪክ']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all font-amharic
              ${tab === key ? 'bg-gold text-charcoal' : 'text-muted hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'weekly' ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-gradient-gold font-black text-lg font-amharic text-center mb-2">
            🏆 ሳምንቱ ምርጥ አሸናፊዎች
          </h2>
          {leaders.length === 0 && (
            <p className="text-center text-muted font-amharic py-8">
              ይህ ሳምንት ምንም አሸናፊ የለም
            </p>
          )}
          {leaders.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`glass rounded-xl p-4 flex items-center gap-4 border
                ${i === 0 ? 'border-gold/40' : i === 1 ? 'border-white/20' : 'border-white/10'}
              `}
            >
              <span className="text-2xl w-8 text-center">{MEDALS[i] || `#${i+1}`}</span>
              <div className="flex-1">
                <p className="font-bold text-white">
                  {p.first_name || p.username || `User#${p.id}`}
                </p>
                <p className="text-muted text-xs">{p.wins_this_week} አሸናፊ ዙሮች</p>
              </div>
              <div className="text-right">
                <p className="text-gold font-black">
                  {parseFloat(p.earnings_this_week).toFixed(0)} ETB
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-white font-black text-lg text-center mb-2 font-amharic">
            የቅርብ ጊዜ ዙሮች
          </h2>
          {history.length === 0 && (
            <p className="text-center text-muted font-amharic py-8">ምንም ዙር አልተጠናቀቀም</p>
          )}
          {history.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-4 border border-white/5"
            >
              {/* Game header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted text-xs font-mono">{g.game_code}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted text-xs">👥 {g.player_count || 0}</span>
                  <span className="text-xs text-muted">
                    {new Date(g.finished_at).toLocaleString('am-ET', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Winners list */}
              {g.winners && g.winners.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {g.winners.map((w, wi) => (
                    <div key={wi} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏆</span>
                        <div>
                          <p className="text-white font-semibold text-sm">
                            {w.first_name || w.username || `User #${w.user_id}`}
                          </p>
                          <p className="text-muted text-[10px] font-amharic">
                            {PATTERN_LABELS[w.pattern] || w.pattern}
                            {w.winning_ball ? ` · Ball ${w.winning_ball}` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-gold font-black text-sm">
                        +{parseFloat(w.prize_share || 0).toFixed(0)} ETB
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-xs font-amharic">ምንም አሸናፊ አልነበረም</p>
              )}

              {/* Prize total */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <span className="text-muted text-[10px] font-amharic">
                  {g.entry_fee} ETB ክፍያ
                </span>
                <span className="text-gold text-xs font-bold">
                  {parseFloat(g.net_prize || 0).toFixed(0)} ETB ደራሽ
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
