import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useGameStore } from '../store/gameStore';
import toast from 'react-hot-toast';

// ─── Copyable account number card ────────────────────────
function CopyableAccount({ icon, label, number, display, name, color }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
    } catch {
      // Fallback for older browsers / WebView
      const el = document.createElement('textarea');
      el.value = number;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    toast.success(`${display} ተቀድቷል!`, { duration: 1500 });
    setTimeout(() => setCopied(false), 2000);
  };

  const borderColor = color === 'neon' ? 'border-neon/20' : 'border-gold/20';
  const textColor   = color === 'neon' ? 'text-neon'      : 'text-gold';

  return (
    <button
      onClick={copy}
      className={`w-full bg-surface2 rounded-xl p-3 border ${borderColor}
                  active:scale-98 transition-transform text-left touch-manipulation`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{icon}</span>
          <p className={`${textColor} font-bold text-xs`}>{label}</p>
        </div>
        <motion.div
          animate={copied ? { scale: [1, 1.2, 1] } : {}}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
            ${copied
              ? 'bg-neon/20 text-neon border border-neon/40'
              : `bg-surface border border-white/10 text-muted`}`}
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              ተቀድቷል
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              ቅዳ
            </>
          )}
        </motion.div>
      </div>
      <p className={`font-black text-xl tracking-widest ${copied ? textColor : 'text-white'} transition-colors`}>
        {display}
      </p>
      <p className="text-muted text-xs font-amharic mt-0.5">ስም: {name}</p>
    </button>
  );
}

const TX_COLORS = {
  DEPOSIT:    'text-neon',
  PRIZE:      'text-gold',
  ENTRY_FEE:  'text-danger',
  PENALTY:    'text-danger',
  REFUND:     'text-blue-400',
  WITHDRAWAL: 'text-orange-400',
};

const TX_ICONS = {
  DEPOSIT:    '⬆️',
  PRIZE:      '🏆',
  ENTRY_FEE:  '🎮',
  PENALTY:    '⛔',
  REFUND:     '↩️',
  WITHDRAWAL: '⬇️',
};

const TX_LABELS = {
  DEPOSIT:    'ተቀምጧል',
  PRIZE:      'ሽልማት',
  ENTRY_FEE:  'ክፍያ',
  PENALTY:    'ቅጣት',
  REFUND:     'ተመልሷል',
  WITHDRAWAL: 'ወጪ',
};

// ─── Parse amount from Telebirr / CBE SMS ────────────────
function parseAmountFromMessage(text) {
  if (!text) return null;
  // Telebirr: "ETB 150.00" or "150.00 ETB" or "birr 150" or "ብር 150"
  const patterns = [
    /ETB\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*ETB/i,
    /birr\s*([\d,]+\.?\d*)/i,
    /ብር\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*ብር/,
    /amount[:\s]*([\d,]+\.?\d*)/i,
    /transferred\s*([\d,]+\.?\d*)/i,
    /sent\s*([\d,]+\.?\d*)/i,
    /received\s*([\d,]+\.?\d*)/i,
    /payment.*?([\d,]+\.?\d*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

export default function WalletPanel() {
  const { user, setUser } = useGameStore();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('deposit');

  // Deposit state
  const [smsText, setSmsText]           = useState('');
  const [parsedAmount, setParsedAmount] = useState(null);
  const [manualAmount, setManualAmount] = useState('');
  const [uploading, setUploading]       = useState(false);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone]   = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('telebirr');
  const [withdrawing, setWithdrawing]       = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ user: u }) => setUser(u)).catch(() => {});
    api.get('/wallet/transactions')
      .then(d => setTransactions(d.transactions || []))
      .finally(() => setLoading(false));
  }, []);

  // Auto-parse when SMS text changes
  const handleSmsChange = (text) => {
    setSmsText(text);
    const amt = parseAmountFromMessage(text);
    setParsedAmount(amt);
    if (amt) setManualAmount(amt.toString());
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(manualAmount);
    if (!smsText.trim()) return toast.error('የ Telebirr መልዕክቱን ይለጥፉ');
    if (!amt || amt < 10 || amt > 100000) return toast.error('መጠን ከ10 እስከ 100,000 ETB መሆን አለበት');

    setUploading(true);
    try {
      await api.post('/wallet/deposit-sms', { smsText: smsText.trim(), amount: amt });
      toast.success('ጥያቄ ተልኳል! አስተዳዳሪ ያረጋግጣሉ');
      setSmsText('');
      setParsedAmount(null);
      setManualAmount('');
      api.get('/wallet/transactions').then(d => setTransactions(d.transactions || []));
    } catch (err) {
      toast.error(err.error || 'ስህተት ተፈጥሯል');
    } finally {
      setUploading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 10 || amt > 100000) return toast.error('መጠን ከ10 እስከ 100,000 ETB መሆን አለበት');
    if (!withdrawPhone.trim()) return toast.error('ስልክ ቁጥር ያስፈልጋል');
    setWithdrawing(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt, phone: withdrawPhone.trim(), method: withdrawMethod });
      toast.success('የወጪ ጥያቄ ተልኳል! አስተዳዳሪ ያረጋግጣሉ');
      setWithdrawAmount('');
      setWithdrawPhone('');
      api.get('/auth/me').then(({ user: u }) => setUser(u)).catch(() => {});
      api.get('/wallet/transactions').then(d => setTransactions(d.transactions || []));
    } catch (err) {
      toast.error(err.error || 'ስህተት ተፈጥሯል');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Balance card */}
      <div className="glass rounded-2xl p-5 border border-gold/20 text-center">
        <p className="text-muted text-sm font-amharic mb-1">ቀሪ ሂሳብ</p>
        <p className="text-gradient-gold font-black text-4xl">
          {parseFloat(user?.balance || 0).toFixed(2)}
        </p>
        <p className="text-gold text-sm">ETB</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-surface2 rounded-xl p-1">
        {[
          ['deposit',  '💳 ጨምር'],
          ['withdraw', '⬇️ አውጣ'],
          ['history',  '📋 ታሪክ'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
              ${tab === k ? 'bg-gold text-charcoal' : 'text-muted hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Deposit tab ── */}
      {tab === 'deposit' && (
        <div className="glass rounded-2xl p-4 border border-white/5">
          <h3 className="text-white font-bold mb-1 font-amharic">💳 ገንዘብ ጨምር</h3>

          {/* Payment accounts */}
          <div className="flex flex-col gap-2 mb-4">
            {/* Telebirr */}
            <CopyableAccount
              icon="📱"
              label="Telebirr"
              number="0946336242"
              display="0946 336 242"
              name="Tesfamichael"
              color="neon"
            />
            {/* CBE */}
            <CopyableAccount
              icon="🏦"
              label="CBE (Commercial Bank)"
              number="1000296475387"
              display="1000 2964 75387"
              name="Tesfamikael Worku"
              color="gold"
            />
          </div>

          {/* Step instructions */}
          <div className="bg-surface2 rounded-xl p-3 mb-4">
            <p className="text-gold text-xs font-bold font-amharic mb-2">እንዴት ማድረግ ይቻላል?</p>
            <div className="flex flex-col gap-1.5">
              {[
                ['1', 'ከላይ ወደ አንዱ ቁጥር ገንዘብ ይላኩ'],
                ['2', 'የ Telebirr / CBE ማረጋገጫ SMS ይምጣዎ'],
                ['3', 'SMS ቅዱ (Copy) ከዚህ ይለጥፉ (Paste)'],
                ['4', 'ጥያቄ ላክ ይጫኑ — አስተዳዳሪ ያረጋግጣሉ'],
              ].map(([n, text]) => (
                <div key={n} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-neon/20 text-neon text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                  <p className="text-white/80 text-xs font-amharic">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleDeposit} className="flex flex-col gap-3">
            {/* SMS paste area */}
            <div className="relative">
              <textarea
                placeholder="የ Telebirr ወይም CBE SMS ይለጥፉ ይህን...&#10;&#10;ምሳሌ: You have sent ETB 150.00 to..."
                value={smsText}
                onChange={e => handleSmsChange(e.target.value)}
                rows={4}
                className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-white
                           placeholder-muted focus:border-neon/50 focus:outline-none text-sm resize-none
                           font-amharic leading-relaxed"
              />
              {smsText && (
                <button type="button" onClick={() => { setSmsText(''); setParsedAmount(null); setManualAmount(''); }}
                  className="absolute top-2 right-2 text-muted hover:text-white text-xs bg-surface2 rounded-lg px-2 py-1">
                  ✕
                </button>
              )}
            </div>

            {/* Auto-parsed amount display */}
            <AnimatePresence>
              {parsedAmount && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 bg-neon/10 border border-neon/30 rounded-xl px-4 py-2.5"
                >
                  <span className="text-neon text-base">✅</span>
                  <div className="flex-1">
                    <p className="text-neon font-bold text-sm font-amharic">መጠን ተገኘ</p>
                    <p className="text-neon/70 text-xs font-amharic">ከ SMS ተነቦ ተቀምጧል</p>
                  </div>
                  <span className="text-neon font-black text-lg">{parsedAmount.toFixed(2)} ETB</span>
                </motion.div>
              )}
              {smsText && !parsedAmount && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 bg-orange-400/10 border border-orange-400/30 rounded-xl px-4 py-2.5"
                >
                  <span className="text-orange-400 text-base">⚠️</span>
                  <p className="text-orange-400 text-xs font-amharic">
                    መጠን ራሱ አልተነበበም — ከዚህ በታች ያስገቡ
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Manual amount override */}
            <div className="flex flex-col gap-1">
              <label className="text-muted text-xs font-amharic">
                {parsedAmount ? 'መጠን (ማስተካከያ ይቻላል)' : 'መጠን (ETB) *'}
              </label>
              <input
                type="number"
                placeholder="ለምሳሌ 150"
                value={manualAmount}
                onChange={e => setManualAmount(e.target.value)}
                min="10"
                max="100000"
                className={`bg-surface2 border rounded-xl px-4 py-3 text-white placeholder-muted
                            focus:outline-none transition-colors
                            ${parsedAmount ? 'border-neon/40 focus:border-neon/60' : 'border-white/10 focus:border-neon/50'}`}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={uploading || !smsText.trim() || !manualAmount}
              className="py-3.5 rounded-xl bg-neon text-charcoal font-black text-base disabled:opacity-40"
            >
              {uploading ? 'እየተላከ...' : 'ጥያቄ ላክ →'}
            </motion.button>
          </form>
        </div>
      )}

      {/* ── Withdraw tab ── */}
      {tab === 'withdraw' && (
        <div className="glass rounded-2xl p-4 border border-white/5">
          <h3 className="text-white font-bold mb-3 font-amharic">⬇️ ገንዘብ አውጣ</h3>
          <form onSubmit={handleWithdraw} className="flex flex-col gap-3">
            <input
              type="number"
              placeholder="መጠን (ETB)"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              min="10"
              max="100000"
              className="bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:border-neon/50 focus:outline-none"
            />

            <input
              type="tel"
              placeholder="ስልክ ቁጥር (ለምሳሌ 0911111111)"
              value={withdrawPhone}
              onChange={e => setWithdrawPhone(e.target.value)}
              className="bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:border-neon/50 focus:outline-none"
            />

            {/* Method selector */}
            <div className="flex gap-2">
              {['telebirr', 'cbe'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWithdrawMethod(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                    ${withdrawMethod === m
                      ? 'bg-neon/20 text-neon border-neon/60'
                      : 'bg-surface2 text-muted border-white/10 hover:border-white/20'}`}
                >
                  {m === 'telebirr' ? '📱 Telebirr' : '🏦 CBE'}
                </button>
              ))}
            </div>

            <div className="bg-surface2 rounded-xl p-3 text-xs text-muted font-amharic">
              ቀሪ ሂሳብ: <span className="text-white font-bold">{parseFloat(user?.balance || 0).toFixed(2)} ETB</span>
              <span className="ml-2 text-orange-400/80">· ከወጪ በኋላ ቢያንስ 100 ETB ይቆያል</span>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={withdrawing}
              className="py-3 rounded-xl bg-orange-500 text-white font-black disabled:opacity-50"
            >
              {withdrawing ? 'እየተላከ...' : 'ጥያቄ ላክ'}
            </motion.button>
          </form>
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="glass rounded-2xl p-4 border border-white/5">
          <h3 className="text-white font-bold mb-3 font-amharic">📋 ታሪክ</h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-neon border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-muted text-center text-sm font-amharic py-4">ምንም ግብይት የለም</p>
          ) : (
            <div className="flex flex-col gap-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-xl shrink-0">{TX_ICONS[tx.type] || '💱'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold font-amharic">
                      {TX_LABELS[tx.type] || tx.type}
                    </p>
                    <p className="text-muted text-xs">
                      {new Date(tx.created_at).toLocaleString('am-ET', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${TX_COLORS[tx.type] || 'text-white'}`}>
                      {['ENTRY_FEE','PENALTY','WITHDRAWAL'].includes(tx.type) ? '-' : '+'}
                      {parseFloat(tx.amount).toFixed(2)} ETB
                    </p>
                    <p className={`text-[10px] font-amharic
                      ${tx.status === 'PENDING' ? 'text-orange-400' :
                        tx.status === 'APPROVED' || tx.status === 'COMPLETED' ? 'text-neon/60' :
                        tx.status === 'REJECTED' ? 'text-danger/60' : 'text-muted'}`}>
                      {tx.status === 'PENDING'   ? 'በጥበቃ ላይ' :
                       tx.status === 'APPROVED'  ? 'ተፈቅዷል' :
                       tx.status === 'COMPLETED' ? 'ተጠናቋል' :
                       tx.status === 'REJECTED'  ? 'ተቀባይነት አልተሰጠም' : tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
