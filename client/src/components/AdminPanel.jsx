import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useGameStore } from '../store/gameStore';
import toast from 'react-hot-toast';

// ─── Dashboard Overview ───────────────────────────────────
function Dashboard({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: 'ጠቅላላ ተጠቃሚዎች', value: stats.totalUsers,    color: 'text-white',  bg: 'bg-surface2' },
    { label: 'ዛሬ ዙሮች',        value: stats.todayGames,   color: 'text-neon',   bg: 'bg-neon/10'  },
    { label: 'ጠቅላላ ደራሽ',     value: `${stats.totalPaid?.toFixed(0)} ETB`, color: 'text-gold', bg: 'bg-gold/10' },
    { label: 'ጠቅላላ ሂሳብ',     value: `${stats.totalBalance?.toFixed(0)} ETB`, color: 'text-neon', bg: 'bg-neon/10' },
    { label: 'ጥያቄዎች',         value: stats.pendingDeposits, color: stats.pendingDeposits > 0 ? 'text-orange-400' : 'text-muted', bg: stats.pendingDeposits > 0 ? 'bg-orange-400/10' : 'bg-surface2' },
    { label: 'ወጪ ጥያቄዎች',     value: stats.pendingWithdrawals, color: stats.pendingWithdrawals > 0 ? 'text-orange-400' : 'text-muted', bg: stats.pendingWithdrawals > 0 ? 'bg-orange-400/10' : 'bg-surface2' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {cards.map(c => (
        <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center border border-white/5`}>
          <p className={`font-black text-lg ${c.color}`}>{c.value}</p>
          <p className="text-muted text-[10px] font-amharic mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Bots Tab ─────────────────────────────────────────────
function BotsTab({ bots, onRefresh }) {
  const [newName, setNewName]     = useState('');
  const [newBal, setNewBal]       = useState('500');
  const [adding, setAdding]       = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const addBot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error('ስም ያስፈልጋል');
    setAdding(true);
    try {
      await api.post('/wallet/admin/bots', { firstName: newName.trim(), balance: parseFloat(newBal) || 500 });
      toast.success(`${newName} ቦት ተጨምሯል`);
      setNewName('');
      setNewBal('500');
      onRefresh();
    } catch (e) { toast.error(e.error || 'ስህተት'); }
    finally { setAdding(false); }
  };

  const deleteBot = async (bot) => {
    if (!window.confirm(`${bot.first_name} ቦትን ይሰርዙ?`)) return;
    setDeletingId(bot.id);
    try {
      await api.delete(`/wallet/admin/bots/${bot.id}`);
      toast.success(`${bot.first_name} ተሰርዟል`);
      onRefresh();
    } catch (e) { toast.error(e.error || 'ስህተት'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add bot form */}
      <div className="glass rounded-2xl p-4 border border-neon/20">
        <p className="text-neon font-bold text-sm font-amharic mb-3">➕ አዲስ ቦት ጨምር</p>
        <form onSubmit={addBot} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="የቦቱ ስም (ለምሳሌ: Kebede)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-neon/50"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="ሂሳብ (ETB)"
              value={newBal}
              onChange={e => setNewBal(e.target.value)}
              className="flex-1 bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-neon/50"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={adding}
              className="px-5 py-2.5 rounded-xl bg-neon text-charcoal font-black disabled:opacity-50"
            >
              {adding ? '...' : 'ጨምር'}
            </motion.button>
          </div>
        </form>
      </div>

      {/* Bot list */}
      <div className="flex flex-col gap-2">
        <p className="text-muted text-xs font-amharic">{bots.length} ቦቶች</p>
        {bots.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">🤖</p>
            <p className="text-muted font-amharic text-sm">ምንም ቦት የለም</p>
          </div>
        )}
        {bots.map(bot => (
          <motion.div
            key={bot.id}
            layout
            className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center text-neon font-black text-sm shrink-0">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{bot.first_name}</p>
              <p className="text-muted text-xs">@{bot.username} · {bot.total_wins} wins</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-neon font-bold text-sm">{parseFloat(bot.balance).toFixed(0)} ETB</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => deleteBot(bot)}
              disabled={deletingId === bot.id}
              className="ml-1 w-8 h-8 rounded-lg bg-danger/20 text-danger border border-danger/30 flex items-center justify-center text-sm disabled:opacity-50 shrink-0"
            >
              {deletingId === bot.id ? '...' : '✕'}
            </motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Entry Fee Settings ───────────────────────────────────
function EntryFeeSettings() {
  const { entryFee } = useGameStore();
  const [selected, setSelected] = useState(entryFee);
  const [saving, setSaving] = useState(false);
  const options = [5, 10, 25, 50, 100];

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/game/set-entry-fee', { entryFee: selected });
      toast.success(`ቀጣይ ዙር ክፍያ: ${selected} ETB`);
    } catch (e) { toast.error(e.error || 'ስህተት'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl p-4 border border-white/5">
        <h3 className="text-white font-bold mb-1 font-amharic">💰 የመግቢያ ክፍያ</h3>
        <p className="text-muted text-xs font-amharic mb-3">ቀጣይ ዙር ክፍያ ይምረጡ</p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {options.map(fee => (
            <motion.button key={fee} whileTap={{ scale: 0.9 }} onClick={() => setSelected(fee)}
              className={`py-3 rounded-xl font-black text-sm border transition-all
                ${selected === fee ? 'bg-gold text-charcoal border-gold shadow-gold' : 'bg-surface2 text-muted border-white/10'}`}>
              {fee}
            </motion.button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-muted font-amharic">ምርጫ: <span className="text-gold font-bold">{selected} ETB</span></span>
          <span className="text-muted font-amharic">ደራሽ: <span className="text-neon font-bold">{(selected * 0.8).toFixed(0)} ETB</span></span>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl bg-neon text-charcoal font-black disabled:opacity-50">
          {saving ? 'እየተቀመጠ...' : 'ቀጣይ ዙር ላይ ተግብር'}
        </motion.button>
      </div>

      {/* Payment accounts editor */}
      <PaymentSettings />

      {/* Bots toggle */}
      <BotsToggle />
    </div>
  );
}

// ─── Bots Toggle ──────────────────────────────────────────
function BotsToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get('/settings/bots-enabled')
      .then(d => setEnabled(d.enabled !== false))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    setSaving(true);
    const next = !enabled;
    try {
      await api.put('/settings/bots-enabled', { enabled: next });
      setEnabled(next);
      toast.success(next ? '🤖 ቦቶች ተከፍተዋል' : '🤖 ቦቶች ተዘግተዋል');
    } catch (e) { toast.error(e.error || 'ስህተት'); }
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <div className="glass rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm font-amharic">🤖 ቦቶች</h3>
          <p className="text-muted text-xs font-amharic mt-0.5">
            {enabled ? 'ቦቶች ዙሮችን ይቀላቀላሉ' : 'ቦቶች አይቀላቀሉም'}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggle}
          disabled={saving}
          className={`relative w-14 h-7 rounded-full transition-colors disabled:opacity-50
            ${enabled ? 'bg-neon' : 'bg-surface2 border border-white/20'}`}
        >
          <motion.div
            animate={{ x: enabled ? 28 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow"
          />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Payment Settings ─────────────────────────────────────
function PaymentSettings() {
  const [form, setForm] = useState({
    telebirr_number: '', telebirr_name: '',
    cbe_number: '',      cbe_name: '',
  });
  const [loadingP, setLoadingP] = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get('/settings/payment').then(d => {
      setForm({
        telebirr_number: d.telebirr?.number || '',
        telebirr_name:   d.telebirr?.name   || '',
        cbe_number:      d.cbe?.number      || '',
        cbe_name:        d.cbe?.name        || '',
      });
    }).catch(() => {}).finally(() => setLoadingP(false));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/payment', form);
      toast.success('የክፍያ መረጃ ተቀይሯል ✅');
    } catch (err) { toast.error(err.error || 'ስህተት'); }
    finally { setSaving(false); }
  };

  if (loadingP) return <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="glass rounded-2xl p-4 border border-white/5">
      <h3 className="text-white font-bold mb-3 font-amharic">💳 የክፍያ መረጃ ቀይር</h3>
      <form onSubmit={save} className="flex flex-col gap-3">
        <p className="text-neon text-xs font-bold">📱 Telebirr</p>
        <input value={form.telebirr_number} onChange={set('telebirr_number')}
          placeholder="Telebirr ቁጥር" type="tel"
          className="bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-neon/50" />
        <input value={form.telebirr_name} onChange={set('telebirr_name')}
          placeholder="የባለቤቱ ስም"
          className="bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-neon/50" />

        <p className="text-gold text-xs font-bold mt-1">🏦 CBE</p>
        <input value={form.cbe_number} onChange={set('cbe_number')}
          placeholder="CBE አካውንት ቁጥር" type="tel"
          className="bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-gold/50" />
        <input value={form.cbe_name} onChange={set('cbe_name')}
          placeholder="የባለቤቱ ስም"
          className="bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-gold/50" />

        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={saving}
          className="py-3 rounded-xl bg-gold text-charcoal font-black disabled:opacity-50 mt-1">
          {saving ? 'እየተቀመጠ...' : '💾 አስቀምጥ'}
        </motion.button>
      </form>
    </div>
  );
}

// ─── Main AdminPanel ──────────────────────────────────────
export default function AdminPanel() {
  const [pending, setPending]         = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers]             = useState([]);
  const [allTx, setAllTx]             = useState([]);
  const [bots, setBots]               = useState([]);
  const [stats, setStats]             = useState(null);
  const [tab, setTab]                 = useState('overview');
  const [loading, setLoading]         = useState(true);
  const [notes, setNotes]             = useState({});
  const [topupMap, setTopupMap]       = useState({});
  const [pwMap, setPwMap]             = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedUser, setExpandedUser]   = useState(null);
  const [userSearch, setUserSearch]       = useState('');
  const [txFilter, setTxFilter]           = useState('ALL');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/wallet/admin/pending'),
      api.get('/wallet/admin/users'),
      api.get('/wallet/admin/withdrawals'),
      api.get('/wallet/admin/all-transactions'),
      api.get('/wallet/admin/bots'),
    ]).then(([p, u, w, tx, b]) => {
      const pendingList = p.pending || [];
      const userList    = u.users   || [];
      const wList       = w.withdrawals || [];
      const txList      = tx.transactions || [];
      const botList     = b.bots || [];
      setPending(pendingList);
      setUsers(userList);
      setWithdrawals(wList);
      setAllTx(txList);
      setBots(botList);
      setStats({
        totalUsers:          userList.length,
        todayGames:          0,
        totalPaid:           userList.reduce((s, u) => s + parseFloat(u.total_winnings || 0), 0),
        totalBalance:        userList.reduce((s, u) => s + parseFloat(u.balance || 0), 0),
        pendingDeposits:     pendingList.length,
        pendingWithdrawals:  wList.length,
      });
    }).catch(() => toast.error('ዳታ ማምጣት አልተቻለም'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Actions ──────────────────────────────────────────────
  const approve = async (id) => {
    setActionLoading(`approve-${id}`);
    try { await api.post(`/wallet/admin/approve/${id}`, { note: notes[id] || '' }); toast.success('ተፈቅዷል ✅'); load(); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const reject = async (id) => {
    setActionLoading(`reject-${id}`);
    try { await api.post(`/wallet/admin/reject/${id}`, { note: notes[id] || '' }); toast.success('ተቀባይነት አልተሰጠም'); load(); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const approveW = async (id) => {
    setActionLoading(`aw-${id}`);
    try { await api.post(`/wallet/admin/approve-withdrawal/${id}`, { note: notes[id] || '' }); toast.success('ወጪ ተፈቅዷል ✅'); load(); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const rejectW = async (id) => {
    setActionLoading(`rw-${id}`);
    try { await api.post(`/wallet/admin/reject-withdrawal/${id}`, { note: notes[id] || '' }); toast.success('ወጪ ተሰርዟል — ሂሳብ ተመልሷል'); load(); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const toggleBan = async (u) => {
    setActionLoading(`ban-${u.id}`);
    try {
      if (u.is_banned) { await api.post(`/wallet/admin/unban/${u.id}`); toast.success(`${u.first_name} ታግዶ ተነሳ`); }
      else             { await api.post(`/wallet/admin/ban/${u.id}`);   toast.success(`${u.first_name} ታግዷል`); }
      load();
    } catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const topup = async (userId) => {
    const amount = parseFloat(topupMap[userId]);
    if (!amount || amount <= 0) return toast.error('መጠን ያስፈልጋል');
    setActionLoading(`topup-${userId}`);
    try { await api.post(`/wallet/admin/topup/${userId}`, { amount }); toast.success(`${amount} ETB ተጨምሯል`); setTopupMap(m => ({ ...m, [userId]: '' })); load(); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };
  const resetPw = async (userId) => {
    const pw = pwMap[userId];
    if (!pw || pw.length < 6) return toast.error('ቢያንስ 6 ቁምፊ');
    setActionLoading(`pw-${userId}`);
    try { await api.post('/auth/admin/reset-password', { userId, newPassword: pw }); toast.success('የይለፍ ቃሉ ተቀይሯል'); setPwMap(m => ({ ...m, [userId]: '' })); }
    catch (e) { toast.error(e.error || 'ስህተት'); } finally { setActionLoading(null); }
  };

  // Filtered users
  const filteredUsers = users.filter(u =>
    !userSearch ||
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.first_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filtered transactions
  const TX_TYPES = ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'ENTRY_FEE', 'PRIZE', 'PENALTY'];
  const filteredTx = allTx.filter(t => txFilter === 'ALL' || t.type === txFilter);

  const TABS = [
    { key: 'overview',     label: 'ዳሽቦርድ' },
    { key: 'deposits',     label: `ጥያቄ${pending.length ? ` (${pending.length})` : ''}` },
    { key: 'withdrawals',  label: `ወጪ${withdrawals.length ? ` (${withdrawals.length})` : ''}` },
    { key: 'transactions', label: 'ግብይቶች' },
    { key: 'users',        label: 'ተጠቃሚ' },
    { key: 'bots',         label: `🤖 ቦቶች` },
    { key: 'settings',     label: 'ቅንብር' },
  ];

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gradient-gold font-black text-lg font-amharic">አስተዳዳሪ ፓነል</h2>
        <button onClick={load} className="text-muted hover:text-white text-xs px-2 py-1 rounded-lg bg-surface2 border border-white/5">
          ↻ አድስ
        </button>
      </div>

      {/* Tab bar — scrollable */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap
              ${tab === t.key ? 'bg-gold text-charcoal' : 'bg-surface2 text-muted hover:text-white border border-white/5'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <Dashboard stats={stats} />
              {/* Urgent items */}
              {(pending.length > 0 || withdrawals.length > 0) && (
                <div className="glass rounded-2xl p-4 border border-orange-400/30">
                  <p className="text-orange-400 font-bold text-sm font-amharic mb-2">⚠️ ትኩረት የሚፈልጉ</p>
                  {pending.length > 0 && (
                    <button onClick={() => setTab('deposits')}
                      className="w-full flex items-center justify-between py-2 px-3 bg-surface2 rounded-xl mb-2 hover:bg-surface transition-colors">
                      <span className="text-white text-sm font-amharic">{pending.length} ያልተፈቀዱ ጥያቄዎች</span>
                      <span className="text-orange-400 text-xs">ይፈቅዱ →</span>
                    </button>
                  )}
                  {withdrawals.length > 0 && (
                    <button onClick={() => setTab('withdrawals')}
                      className="w-full flex items-center justify-between py-2 px-3 bg-surface2 rounded-xl hover:bg-surface transition-colors">
                      <span className="text-white text-sm font-amharic">{withdrawals.length} ያልተፈቀዱ ወጪዎች</span>
                      <span className="text-orange-400 text-xs">ይፈቅዱ →</span>
                    </button>
                  )}
                </div>
              )}
              {/* Zero-balance users */}
              {users.filter(u => parseFloat(u.balance) === 0).length > 0 && (
                <div className="glass rounded-2xl p-4 border border-white/5">
                  <p className="text-muted text-sm font-amharic mb-2">💸 ሂሳብ የሌላቸው ተጠቃሚዎች</p>
                  {users.filter(u => parseFloat(u.balance) === 0).map(u => (
                    <div key={u.id} className="flex items-center justify-between py-1.5">
                      <span className="text-white text-sm">@{u.username}</span>
                      <button onClick={() => { setTab('users'); setExpandedUser(u.id); }}
                        className="text-neon text-xs hover:underline">ሂሳብ ጨምር →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deposits ── */}
          {tab === 'deposits' && (
            <div className="flex flex-col gap-4">
              {pending.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-muted font-amharic">ምንም ጥያቄ የለም</p>
                </div>
              ) : pending.map(tx => (
                <motion.div key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-bold">{tx.first_name || tx.username}</p>
                      <p className="text-muted text-xs">@{tx.username}</p>
                      <p className="text-muted text-[10px]">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-neon font-black text-xl">{parseFloat(tx.amount).toFixed(2)}</p>
                      <p className="text-muted text-xs">ETB</p>
                    </div>
                  </div>
                  {tx.screenshot_url && (
                    <a href={tx.screenshot_url} target="_blank" rel="noreferrer" className="block mb-3">
                      <img src={tx.screenshot_url} alt="receipt"
                        className="w-full h-36 object-cover rounded-xl border border-white/10 hover:opacity-90 transition-opacity" />
                      <p className="text-center text-muted text-xs mt-1">ፎቶ ለማስፋት ጠቅ ያድርጉ</p>
                    </a>
                  )}
                  {!tx.screenshot_url && tx.admin_note?.startsWith('SMS:') && (
                    <div className="bg-surface2 rounded-xl p-3 mb-3 border border-white/5">
                      <p className="text-muted text-[10px] font-amharic mb-1">📱 የ SMS ጽሑፍ</p>
                      <p className="text-white/80 text-xs leading-relaxed break-words">
                        {tx.admin_note.replace('SMS: ', '')}
                      </p>
                    </div>
                  )}
                  <input type="text" placeholder="ማስታወሻ (አማራጭ)"
                    value={notes[tx.id] || ''} onChange={e => setNotes(n => ({ ...n, [tx.id]: e.target.value }))}
                    className="w-full bg-surface2 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted mb-3 focus:outline-none focus:border-gold/50" />
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => approve(tx.id)}
                      disabled={actionLoading === `approve-${tx.id}`}
                      className="flex-1 py-2.5 rounded-xl bg-neon text-charcoal font-bold text-sm disabled:opacity-50">
                      {actionLoading === `approve-${tx.id}` ? '...' : '✅ ፍቀድ'}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => reject(tx.id)}
                      disabled={actionLoading === `reject-${tx.id}`}
                      className="flex-1 py-2.5 rounded-xl bg-danger/20 text-danger border border-danger/30 font-bold text-sm disabled:opacity-50">
                      {actionLoading === `reject-${tx.id}` ? '...' : '❌ ሰርዝ'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Withdrawals ── */}
          {tab === 'withdrawals' && (
            <div className="flex flex-col gap-4">
              {withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-muted font-amharic">ምንም የወጪ ጥያቄ የለም</p>
                </div>
              ) : withdrawals.map(tx => {
                const [method, phone] = (tx.reference_id || ':').split(':');
                return (
                  <motion.div key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-bold">{tx.first_name || tx.username}</p>
                        <p className="text-muted text-xs">@{tx.username}</p>
                        <p className="text-muted text-xs mt-0.5 font-bold">{method?.toUpperCase()} · {phone}</p>
                        <p className="text-muted text-[10px]">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-black text-xl">{parseFloat(tx.amount).toFixed(2)}</p>
                        <p className="text-muted text-xs">ETB</p>
                      </div>
                    </div>
                    <input type="text" placeholder="ማስታወሻ (አማራጭ)"
                      value={notes[tx.id] || ''} onChange={e => setNotes(n => ({ ...n, [tx.id]: e.target.value }))}
                      className="w-full bg-surface2 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted mb-3 focus:outline-none focus:border-gold/50" />
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => approveW(tx.id)}
                        disabled={actionLoading === `aw-${tx.id}`}
                        className="flex-1 py-2.5 rounded-xl bg-neon text-charcoal font-bold text-sm disabled:opacity-50">
                        {actionLoading === `aw-${tx.id}` ? '...' : '✅ ፍቀድ'}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => rejectW(tx.id)}
                        disabled={actionLoading === `rw-${tx.id}`}
                        className="flex-1 py-2.5 rounded-xl bg-danger/20 text-danger border border-danger/30 font-bold text-sm disabled:opacity-50">
                        {actionLoading === `rw-${tx.id}` ? '...' : '↩️ ሰርዝ & መልስ'}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── All Transactions ── */}
          {tab === 'transactions' && (
            <div className="flex flex-col gap-3">
              {/* Filter */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {TX_TYPES.map(type => (
                  <button key={type} onClick={() => setTxFilter(type)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all
                      ${txFilter === type ? 'bg-neon text-charcoal border-neon' : 'bg-surface2 text-muted border-white/5'}`}>
                    {type === 'ALL' ? 'ሁሉም' : type}
                  </button>
                ))}
              </div>
              <p className="text-muted text-xs">{filteredTx.length} ግብይቶች</p>
              {filteredTx.slice(0, 50).map(tx => {
                const isCredit = ['DEPOSIT', 'PRIZE', 'REFUND'].includes(tx.type);
                return (
                  <div key={tx.id} className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0
                      ${isCredit ? 'bg-neon/15 text-neon' : 'bg-danger/15 text-danger'}`}>
                      {isCredit ? '↑' : '↓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">
                        {tx.username || tx.first_name || `#${tx.user_id}`}
                      </p>
                      <p className="text-muted text-[10px]">
                        {tx.type} · {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${isCredit ? 'text-neon' : 'text-danger'}`}>
                        {isCredit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}
                      </p>
                      <p className={`text-[10px] ${tx.status === 'PENDING' ? 'text-orange-400' : 'text-muted'}`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="flex flex-col gap-3">
              {/* Search */}
              <input type="text" placeholder="ተጠቃሚ ፈልግ..." value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-muted focus:outline-none focus:border-neon/50" />
              <p className="text-muted text-xs">{filteredUsers.length} ተጠቃሚዎች</p>
              {filteredUsers.map(u => (
                <motion.div key={u.id} layout
                  className={`glass rounded-xl border transition-colors ${u.is_banned ? 'border-danger/30' : 'border-white/5'}`}>
                  <button className="w-full flex items-center gap-3 p-3 text-left"
                    onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0
                      ${u.is_admin ? 'bg-gold/20 border border-gold/40 text-gold' : u.is_banned ? 'bg-danger/20 border border-danger/30 text-danger' : 'bg-surface2 text-white'}`}>
                      {(u.first_name || u.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white font-semibold text-sm truncate">{u.first_name || u.username}</p>
                        {u.is_admin  && <span className="text-gold text-[10px] font-bold">★ Admin</span>}
                        {u.is_banned && <span className="text-danger text-[10px] font-bold">🚫</span>}
                      </div>
                      <p className="text-muted text-xs">@{u.username} · {u.total_wins}W · {u.false_bingo_count}F</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${parseFloat(u.balance) === 0 ? 'text-danger' : 'text-neon'}`}>
                        {parseFloat(u.balance).toFixed(0)} ETB
                      </p>
                      <p className="text-muted text-[10px]">{expandedUser === u.id ? '▲' : '▼'}</p>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedUser === u.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/5">
                        <div className="p-3 flex flex-col gap-3">
                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {[['💰', 'ሂሳብ', `${parseFloat(u.balance).toFixed(0)} ETB`],
                              ['🏆', 'አሸናፊ', u.total_wins],
                              ['⛔', 'False', u.false_bingo_count]].map(([icon, label, val]) => (
                              <div key={label} className="bg-surface2 rounded-lg p-2">
                                <p className="text-base">{icon}</p>
                                <p className="text-white font-bold text-sm">{val}</p>
                                <p className="text-muted text-[10px]">{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Top-up */}
                          <div className="flex gap-2">
                            <input type="number" placeholder="ETB ጨምር" value={topupMap[u.id] || ''}
                              onChange={e => setTopupMap(m => ({ ...m, [u.id]: e.target.value }))}
                              className="flex-1 bg-surface2 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-neon/50" />
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => topup(u.id)}
                              disabled={actionLoading === `topup-${u.id}`}
                              className="px-4 py-2 rounded-lg bg-neon/20 text-neon border border-neon/30 font-bold text-sm disabled:opacity-50">
                              {actionLoading === `topup-${u.id}` ? '...' : '+ ጨምር'}
                            </motion.button>
                          </div>
                          {/* Reset password */}
                          <div className="flex gap-2">
                            <input type="password" placeholder="አዲስ የይለፍ ቃል" value={pwMap[u.id] || ''}
                              onChange={e => setPwMap(m => ({ ...m, [u.id]: e.target.value }))}
                              className="flex-1 bg-surface2 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-gold/50" />
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => resetPw(u.id)}
                              disabled={actionLoading === `pw-${u.id}`}
                              className="px-4 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 font-bold text-sm disabled:opacity-50">
                              {actionLoading === `pw-${u.id}` ? '...' : '🔑'}
                            </motion.button>
                          </div>
                          {/* Ban/Unban */}
                          {!u.is_admin && (
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => toggleBan(u)}
                              disabled={actionLoading === `ban-${u.id}`}
                              className={`w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50
                                ${u.is_banned ? 'bg-neon/20 text-neon border border-neon/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
                              {actionLoading === `ban-${u.id}` ? '...' : u.is_banned ? '✅ ታግዶ ነፃ አድርግ' : '🚫 ታግድ'}
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Bots ── */}
          {tab === 'bots' && <BotsTab bots={bots} onRefresh={load} />}

          {/* ── Settings ── */}
          {tab === 'settings' && <EntryFeeSettings />}
        </>
      )}
    </div>
  );
}
