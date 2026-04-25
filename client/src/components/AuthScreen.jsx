import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { useGameStore } from '../store/gameStore';
import { reconnectWithToken } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const { setUser, setToken } = useGameStore();

  return (
    <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex flex-col items-center mb-8"
      >
        <div className="w-20 h-20 rounded-full bg-gold/10 border-2 border-gold/50 flex items-center justify-center mb-3 shadow-gold">
          <span className="text-gold font-black text-4xl">K</span>
        </div>
        <h1 className="text-gradient-gold font-black text-3xl font-amharic tracking-wide">
          K Bingo
        </h1>
        <p className="text-muted text-sm mt-1">Premium Bingo Experience</p>
      </motion.div>

      {/* Tab switcher */}
      <div className="w-full max-w-sm bg-surface rounded-2xl p-1 flex mb-4">
        {['login', 'register'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
              ${mode === m
                ? 'bg-gold text-charcoal shadow-gold'
                : 'text-muted hover:text-white'
              }`}
          >
            {m === 'login' ? 'ግባ' : 'ተመዝገብ'}
          </button>
        ))}
      </div>

      {/* Form card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{   opacity: 0, y: -16 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          {mode === 'login'
            ? <LoginForm setUser={setUser} setToken={setToken} />
            : <RegisterForm setUser={setUser} setToken={setToken} onSuccess={() => setMode('login')} />
          }
        </motion.div>
      </AnimatePresence>

      <p className="text-muted text-xs mt-6 text-center">
        ሁሉም ግብይቶች ደህንነቱ የተጠበቀ ነው
      </p>
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm({ setUser, setToken }) {
  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error('ሁሉንም ሙሉ');
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/login', form);
      setToken(token);
      setUser(user);
      reconnectWithToken(token);   // ← upgrade socket with auth
      toast.success(`እንኳን ደህና መጡ, ${user.firstName}!`);
    } catch (err) {
      toast.error(err.error || 'ስህተት ተፈጥሯል');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 border border-white/5 flex flex-col gap-4">
      <h2 className="text-white font-black text-xl font-amharic text-center">ወደ ጨዋታ ግባ</h2>

      <Field
        label="የተጠቃሚ ስም"
        type="text"
        value={form.username}
        onChange={set('username')}
        placeholder="username"
        autoComplete="username"
        icon="👤"
      />

      <Field
        label="የይለፍ ቃል"
        type={showPw ? 'text' : 'password'}
        value={form.password}
        onChange={set('password')}
        placeholder="••••••"
        autoComplete="current-password"
        icon="🔒"
        suffix={
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="text-muted hover:text-white text-xs px-2">
            {showPw ? 'ደብቅ' : 'አሳይ'}
          </button>
        }
      />

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl bg-neon text-charcoal font-black text-lg
                   disabled:opacity-50 shadow-neon hover:shadow-neon transition-all"
      >
        {loading ? <Spinner /> : 'ግባ →'}
      </motion.button>
    </form>
  );
}

// ─── Register Form ────────────────────────────────────────────────────────────
function RegisterForm({ setUser, setToken, onSuccess }) {
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '',
    firstName: '', phone: '', referralCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.firstName) {
      return toast.error('ስም፣ የተጠቃሚ ስም እና የይለፍ ቃል ያስፈልጋሉ');
    }
    if (form.password !== form.confirmPassword) {
      return toast.error('የይለፍ ቃሎቹ አይዛመዱም');
    }
    if (form.password.length < 6) {
      return toast.error('የይለፍ ቃሉ ቢያንስ 6 ቁምፊ መሆን አለበት');
    }

    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/register', {
        username:     form.username,
        password:     form.password,
        firstName:    form.firstName,
        phone:        form.phone || undefined,
        referralCode: form.referralCode || undefined,
      });
      setToken(token);
      setUser(user);
      reconnectWithToken(token);   // ← upgrade socket with auth
      toast.success(`ተመዝግበዋል! 10 ETB ጀምሪያ ሂሳብ ተሰጥቷል 🎉`);
    } catch (err) {
      toast.error(err.error || 'ምዝገባ አልተሳካም');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 border border-white/5 flex flex-col gap-3">
      <h2 className="text-white font-black text-xl font-amharic text-center">አዲስ ተጠቃሚ</h2>
      <p className="text-center text-neon text-xs font-amharic -mt-1">
        ሲመዘገቡ 10 ETB ጀምሪያ ሂሳብ ያገኛሉ!
      </p>

      <Field label="ስም *" type="text" value={form.firstName}
        onChange={set('firstName')} placeholder="ስምዎን ያስገቡ" icon="✏️" />

      <Field label="የተጠቃሚ ስም *" type="text" value={form.username}
        onChange={set('username')} placeholder="letters, numbers, _" icon="👤"
        autoComplete="username" />

      <Field label="ስልክ ቁጥር" type="tel" value={form.phone}
        onChange={set('phone')} placeholder="09xxxxxxxx" icon="📱" />

      <Field label="የሪፈራል ኮድ (አማራጭ)" type="text" value={form.referralCode}
        onChange={set('referralCode')} placeholder="ለምሳሌ: TES4K2M" icon="🎁" />

      <Field label="የይለፍ ቃል *" type={showPw ? 'text' : 'password'}
        value={form.password} onChange={set('password')}
        placeholder="ቢያንስ 6 ቁምፊ" icon="🔒" autoComplete="new-password"
        suffix={
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="text-muted hover:text-white text-xs px-2">
            {showPw ? 'ደብቅ' : 'አሳይ'}
          </button>
        }
      />

      <Field label="የይለፍ ቃሉን አረጋግጥ *" type={showPw ? 'text' : 'password'}
        value={form.confirmPassword} onChange={set('confirmPassword')}
        placeholder="ደግሞ ያስገቡ" icon="🔒" autoComplete="new-password" />

      {/* Password strength bar */}
      {form.password && <PasswordStrength password={form.password} />}

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl bg-neon text-charcoal font-black text-lg
                   disabled:opacity-50 shadow-neon mt-1"
      >
        {loading ? <Spinner /> : 'ተመዝገብ →'}
      </motion.button>
    </form>
  );
}

// ─── Shared Field component ───────────────────────────────────────────────────
function Field({ label, icon, suffix, ...inputProps }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted text-xs font-semibold font-amharic">{label}</label>
      <div className="flex items-center bg-surface2 border border-white/10 rounded-xl
                      focus-within:border-neon/50 transition-colors overflow-hidden">
        {icon && (
          <span className="pl-3 text-base select-none">{icon}</span>
        )}
        <input
          {...inputProps}
          className="flex-1 bg-transparent px-3 py-3 text-white placeholder-muted
                     focus:outline-none text-sm"
        />
        {suffix}
      </div>
    </div>
  );
}

// ─── Password strength indicator ─────────────────────────────────────────────
function PasswordStrength({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'ደካማ', 'መካከለኛ', 'ጥሩ', 'ጠንካራ'];
  const colors = ['', 'bg-danger', 'bg-orange-400', 'bg-yellow-400', 'bg-neon'];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1,2,3,4].map(i => (
          <div key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300
              ${i <= score ? colors[score] : 'bg-surface2'}`}
          />
        ))}
      </div>
      <span className={`text-xs font-semibold ${score >= 3 ? 'text-neon' : 'text-muted'}`}>
        {labels[score]}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center">
      <div className="w-5 h-5 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
