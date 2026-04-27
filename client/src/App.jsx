import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { useSocket, reconnectWithToken } from './hooks/useSocket';
import api from './utils/api';
import { initAudio } from './utils/audio';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import GameBoard from './components/GameBoard';
import CardGrid from './components/CardGrid';
import BallDisplay from './components/BallDisplay';
import WatcherOverlay from './components/WatcherOverlay';
import CelebrationOverlay from './components/CelebrationOverlay';
import Leaderboard from './components/Leaderboard';
import WalletPanel from './components/WalletPanel';
import AdminPanel from './components/AdminPanel';
import TabBar from './components/TabBar';
import RoundSummary from './components/RoundSummary';
import LowBalanceBanner from './components/LowBalanceBanner';
import HelpPanel from './components/HelpPanel';
import ProfilePanel from './components/ProfilePanel';
import RoomSelector from './components/RoomSelector';

export default function App() {
  const { user, token, myCards, myCard, setUser, setToken, activeTab, showCelebration } = useGameStore();
  const [authChecked, setAuthChecked] = useState(false);
  const audioInitialized = useRef(false);

  useSocket(); // always init socket (watchers connect too)

  // One-time audio init on first user gesture
  const handleFirstInteraction = () => {
    if (!audioInitialized.current) {
      audioInitialized.current = true;
      initAudio();
    }
  };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg && tg.initData) {
      // ── Telegram Mini App ──────────────────────────────
      api.post('/auth/telegram', { initData: tg.initData })
        .then(({ token: t, user: u }) => {
          setToken(t);
          setUser(u);
          tg.ready();
          tg.expand();
        })
        .catch(console.error)
        .finally(() => setAuthChecked(true));

    } else if (token) {
      // ── Restore existing session ───────────────────────
      api.get('/auth/me')
        .then(({ user: u }) => {
          setUser(u);
          // Socket was created without token on mount — upgrade it now
          reconnectWithToken(token);
        })
        .catch(() => {
          localStorage.removeItem('bingo_token');
          useGameStore.getState().logout();
        })
        .finally(() => setAuthChecked(true));

    } else {
      // ── No session — show login screen ────────────────
      setAuthChecked(true);
    }
  }, []);

  // Splash while checking session
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gold/10 border-2 border-gold/40
                          flex items-center justify-center shadow-gold">
            <span className="text-gold font-black text-3xl">K</span>
          </div>
          <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not logged in — show auth screen
  if (!user) {
    return <AuthScreen />;
  }

  // ── Main game UI ─────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-charcoal flex flex-col max-w-md mx-auto relative overflow-hidden"
      onClick={handleFirstInteraction}
    >
      <Header />

      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'game' && (
          <div className="flex flex-col gap-3">
            {/* Room selector */}
            <RoomSelector />
            <div className="flex flex-col gap-3 px-3">
              {/* Watcher banner */}
              <WatcherOverlay />
              {/* Low balance warning */}
              <LowBalanceBanner />
              {/* Last round summary */}
              <RoundSummary />
              <BallDisplay />
              {myCards.length > 0 ? <GameBoard /> : <CardGrid />}
            </div>
          </div>
        )}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'wallet'      && <WalletPanel />}
        {activeTab === 'help'        && <HelpPanel />}
        {activeTab === 'profile'     && <ProfilePanel />}
        {activeTab === 'admin'       && user?.isAdmin && <AdminPanel />}
      </main>

      <TabBar />
      {showCelebration && <CelebrationOverlay />}
    </div>
  );
}
