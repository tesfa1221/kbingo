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
    set({ user: null, token: null, myCards: [], myCard: null, markedCells: [[2,2]], isWatcher: false });
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

  // ── My tickets (up to 2 cards) ──────────────────────────
  myCards:     [],   // [{ cardNumber, grid, markedCells }]
  myCard:      null, // kept for backward compat — first card
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

    // Auto-mark all cards
    let newCards = s.myCards;
    if (s.autoMark && s.myCards.length > 0) {
      newCards = s.myCards.map(card => {
        let marked = card.markedCells;
        card.grid.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (cell === ball && !marked.some(([mr, mc]) => mr === r && mc === c)) {
              marked = [...marked, [r, c]];
            }
          });
        });
        return { ...card, markedCells: marked };
      });
    }
    let newMarked = newCards[0]?.markedCells || s.markedCells;

    set({ balls: newBalls, latestBall: ball, myCards: newCards, markedCells: newMarked });

    // Auto-BINGO: check ALL cards
    if (s.autoMark && s.myCards.length > 0 && s.gameState === 'ACTIVE') {
      const drawnSet = new Set(newBalls);
      const anyValid = s.myCards.some(card => validateBingo(card.grid, drawnSet).valid);
      if (anyValid) {
        setTimeout(() => {
          const { _claimBingo, showCelebration, gameState } = get();
          if (_claimBingo && !showCelebration && gameState === 'ACTIVE') {
            _claimBingo();
          }
        }, 300);
      }
    }
  },

  lockCard: (cardNumber, userId) => set((s) => ({
    takenCards:  { ...s.takenCards, [Number(cardNumber)]: Number(userId) },
    playerCount: s.playerCount + 1,
  })),

  setMyCard: (card) => set((s) => {
    const existing = s.myCards.find(c => c.cardNumber === card.cardNumber);
    if (existing) return s; // already have this card
    const newCards = [...s.myCards, { ...card, markedCells: [[2, 2]] }];
    return {
      myCards:     newCards,
      myCard:      newCards[0], // first card for backward compat
      markedCells: [[2, 2]],
    };
  }),

  toggleMark: (row, col, cardNumber) => set((s) => {
    if (row === 2 && col === 2) return s;
    // Find which card to mark
    const cardIdx = cardNumber !== undefined
      ? s.myCards.findIndex(c => c.cardNumber === cardNumber)
      : 0;
    if (cardIdx === -1) return s;

    const card = s.myCards[cardIdx];
    const exists = card.markedCells.some(([r, c]) => r === row && c === col);
    const newMarked = exists
      ? card.markedCells.filter(([r, c]) => !(r === row && c === col))
      : [...card.markedCells, [row, col]];

    const newCards = s.myCards.map((c, i) =>
      i === cardIdx ? { ...c, markedCells: newMarked } : c
    );
    return {
      myCards:     newCards,
      myCard:      newCards[0],
      markedCells: newCards[0]?.markedCells || [[2, 2]],
    };
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
    remaining:       snap.remaining || 115,
    balls:           [],
    latestBall:      null,
    takenCards:      {},
    playerCount:     0,
    prizePool:       0,
    netPrize:        snap.netPrize || 0,
    entryFee:        snap.entryFee || 10,
    myCards:         [],
    myCard:          null,
    markedCells:     [[2, 2]],
    isWatcher:       false,
    winners:         [],
    prizeShare:      0,
    showCelebration: false,
  })),
}));
