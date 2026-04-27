import { create } from 'zustand';
import { validateBingo } from '../utils/bingoValidator';

// Persist some settings to localStorage
const savedAutoMark   = localStorage.getItem('bingo_automark') === 'true';
const savedAudioOn    = localStorage.getItem('bingo_audio') !== 'false'; // default on

export const useGameStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  user:  null,
  token: localStorage.getItem('bingo_token') || null,

  setUser:  (user)  => set({ user }),
  setToken: (token) => {
    localStorage.setItem('bingo_token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('bingo_token');
    set({ user: null, token: null, myCard: null, markedCells: [[2,2]], isWatcher: false });
  },
  updateBalance: (balance) => set((s) => ({
    user: s.user ? { ...s.user, balance } : s.user,
  })),

  // ── Game state ──────────────────────────────────────────
  gameState:   'IDLE',
  gameId:      null,
  gameCode:    null,
  elapsed:     0,
  remaining:   180,
  balls:       [],
  latestBall:  null,
  takenCards:  {},
  playerCount: 0,
  prizePool:   0,
  netPrize:    0,
  entryFee:    10,

  // ── Rooms ────────────────────────────────────────────────
  currentRoom: 'standard',
  rooms:       [],
  setCurrentRoom: (roomId) => set({ currentRoom: roomId }),
  setRooms:    (rooms) => set({ rooms }),

  // ── My ticket ───────────────────────────────────────────
  myCard:      null,
  markedCells: [[2, 2]],
  isWatcher:   false,

  // ── Settings ────────────────────────────────────────────
  autoMark: savedAutoMark,   // auto-mark drawn numbers on card
  audioOn:  savedAudioOn,    // sound on/off

  // Socket claim fn — injected by useSocket after connect
  _claimBingo: null,
  setClaimBingo: (fn) => set({ _claimBingo: fn }),

  setAutoMark: (v) => {
    localStorage.setItem('bingo_automark', v);
    set({ autoMark: v });
  },
  setAudioOn: (v) => {
    localStorage.setItem('bingo_audio', v);
    set({ audioOn: v });
  },

  // ── Winners ─────────────────────────────────────────────
  winners:         [],
  prizeShare:      0,
  showCelebration: false,

  // ── Round summary (last finished round) ─────────────────
  lastRound: null,   // { gameCode, winners, prizeShare, pattern, balls }
  setLastRound: (data) => set({ lastRound: data }),

  // ── UI ──────────────────────────────────────────────────
  activeTab: 'game',

  // ── Actions ─────────────────────────────────────────────

  applySnapshot: (snap) => set({
    gameState:   snap.state,
    gameId:      snap.gameId,
    gameCode:    snap.gameCode,
    elapsed:     snap.elapsed,
    remaining:   snap.remaining,
    balls:       snap.balls || [],
    takenCards:  Object.fromEntries(
      Object.entries(snap.takenCards || {}).map(([k, v]) => [Number(k), Number(v)])
    ),
    playerCount: snap.playerCount || 0,
    prizePool:   snap.prizePool   || 0,
    netPrize:    snap.netPrize    || 0,
    entryFee:    snap.entryFee    || 10,
  }),

  applyTick: (tick) => set({
    elapsed:   tick.e   ?? tick.elapsed,
    remaining: tick.r   ?? tick.remaining,
    gameState: tick.s   ?? tick.state,
  }),

  addBall: (ball) => {
    const s = get();
    const newBalls = [...s.balls, ball];

    // Auto-mark: if ball is on user's card, mark it
    let newMarked = s.markedCells;
    if (s.autoMark && s.myCard) {
      s.myCard.grid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell === ball) {
            const alreadyMarked = s.markedCells.some(([mr, mc]) => mr === r && mc === c);
            if (!alreadyMarked) {
              newMarked = [...newMarked, [r, c]];
            }
          }
        });
      });
    }

    set({ balls: newBalls, latestBall: ball, markedCells: newMarked });

    // Auto-BINGO: if auto-mark is ON, check for a winning line after marking
    if (s.autoMark && s.myCard && s.gameState === 'ACTIVE') {
      const drawnSet = new Set(newBalls);
      const { valid } = validateBingo(s.myCard.grid, drawnSet);
      if (valid) {
        setTimeout(() => {
          const { _claimBingo, showCelebration, gameState } = get();
          if (_claimBingo && !showCelebration && gameState === 'ACTIVE') {
            _claimBingo();
            console.log('🎯 Auto-BINGO claimed!');
          }
        }, 300);
      }
    }
  },

  lockCard: (cardNumber, userId) => set((s) => ({
    takenCards:  { ...s.takenCards, [Number(cardNumber)]: Number(userId) },
    playerCount: s.playerCount + 1,
  })),

  setMyCard: (card) => set({
    myCard:      card,
    markedCells: [[2, 2]],
  }),

  toggleMark: (row, col) => set((s) => {
    if (row === 2 && col === 2) return s;
    const exists = s.markedCells.some(([r, c]) => r === row && c === col);
    const markedCells = exists
      ? s.markedCells.filter(([r, c]) => !(r === row && c === col))
      : [...s.markedCells, [row, col]];
    return { markedCells };
  }),

  setWatcher: (v) => set({ isWatcher: v }),

  setWinners: (winners, prizeShare) => set({
    winners,
    prizeShare,
    showCelebration: true,
  }),

  clearCelebration: () => set({ showCelebration: false }),
  setActiveTab:     (tab) => set({ activeTab: tab }),

  newRound: (snap) => set((s) => ({
    gameState:       snap.state,
    gameId:          snap.gameId,
    gameCode:        snap.gameCode,
    elapsed:         0,
    remaining:       snap.remaining || 135,
    balls:           [],
    latestBall:      null,
    takenCards:      {},
    playerCount:     0,
    prizePool:       0,
    netPrize:        snap.netPrize || snap.minPrize || 0,
    entryFee:        snap.entryFee || 10,
    myCard:          null,
    markedCells:     [[2, 2]],
    isWatcher:       false,
    winners:         [],
    prizeShare:      0,
    showCelebration: false,
  })),
}));
