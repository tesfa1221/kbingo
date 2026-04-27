import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useGameStore } from '../store/gameStore';
import { playBallCall, playBingoWin, playPenalty } from '../utils/audio';

let socketInstance = null;

// ─── Attach all event listeners to a socket ──────────────
function attachListeners(socket) {
  const getStore = () => useGameStore.getState();

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    // Inject auto-BINGO claim function into store
    getStore().setClaimBingo(() => socket.emit('bingo:claim'));
    // Request all room data
    socket.emit('rooms:list');
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected:', reason);
  });

  socket.on('game:snapshot', (snap) => {
    getStore().applySnapshot(snap);
    const { myCard, user } = getStore();
    if (snap.state === 'ACTIVE' && !myCard && user) {
      getStore().setWatcher(true);
    }
  });

  socket.on('game:new_round', (snap) => {
    const store = getStore();
    if (snap.roomId && snap.roomId !== store.currentRoom) return;
    store.newRound(snap);
    toast('🎮 ዙር ጀምሯል! ካርዶን ምረጥ', { icon: '🎯' });
  });

  socket.on('rooms:data', (rooms) => {
    getStore().setRooms(rooms);
  });

  socket.on('game:tick', (tick) => {
    getStore().applyTick(tick);
  });

  socket.on('game:update', (snap) => {
    getStore().applySnapshot(snap);
  });

  socket.on('game:phase_change', ({ state }) => {
    if (state === 'ACTIVE') {
      const { myCard, user } = getStore();
      if (!myCard && user) {
        getStore().setWatcher(true);
        toast('ተመልካች ብቻ - የዚህ ዙር ጨዋታ ተጀምሯል', { duration: 5000, icon: '👁️' });
      }
    }
  });

  socket.on('ball:drawn', ({ b, ball }) => {
    const num = b ?? ball;  // support both short and long key
    getStore().addBall(num);
    playBallCall(num);
  });

  socket.on('card:locked', ({ cardNumber, userId }) => {
    getStore().lockCard(cardNumber, userId);
  });

  socket.on('card:select_result', (result) => {
    if (result.ok) {
      getStore().setMyCard({ cardNumber: result.cardNumber, grid: result.grid });
      const { user, entryFee, myCards } = getStore();
      if (user) getStore().updateBalance(parseFloat(user.balance) - (entryFee || 10));
      const cardNum = myCards.length;
      toast.success(`ካርድ #${result.cardNumber} ተመርጧል! ${cardNum >= 2 ? '(2/2)' : '(1/2)'}`);
    } else {
      const msgs = {
        CARD_TAKEN:           'ይህ ካርድ ተወስዷል',
        MAX_CARDS_REACHED:    'ቢያንስ 2 ካርዶች ብቻ ይፈቀዳሉ',
        ALREADY_REGISTERED:   'ካርድ አስቀድሞ ተመርጧል',
        INSUFFICIENT_BALANCE: 'በቂ ሂሳብ የለም',
        USER_BANNED:          'ታግደዋል',
        REGISTRATION_CLOSED:  'ምዝገባ ተዘግቷል',
      };
      toast.error(msgs[result.reason] || result.reason || 'ካርድ ማስያዝ አልተቻለም');
    }
  });

  socket.on('bingo:result', (result) => {
    if (result.ok) {
      playBingoWin();
      toast.success('🎉 BINGO! አሸነፍህ!', { duration: 8000 });
    } else {
      // Not a valid line yet — friendly message, no penalty
      toast('ገና አልተሞላም! ቁጥሮቹ ሲጠሩ ምልክት አድርግ', {
        icon: '⏳',
        duration: 3000,
        style: { background: '#1E1E1E', color: '#D4AF37', border: '1px solid #D4AF3740' },
      });
    }
  });

  socket.on('game:bingo', ({ winners, prizeShare, gameCode, pattern, balls, refund }) => {
    const store = getStore();
    store.setWinners(winners, prizeShare);
    store.setLastRound({ gameCode, winners, prizeShare, pattern, balls, refund });
    const { user } = store;
    if (user && winners.some(w => w.userId === user.id)) {
      store.updateBalance(parseFloat(user.balance) + prizeShare);
    }
  });

  socket.on('penalty:false_bingo', ({ message }) => {
    toast.error(message, { duration: 8000 });
  });

  socket.on('game:round_end', ({ gameCode }) => {
    toast('🔄 ዙር ተጠናቀቀ. ቀጣይ ዙር ይጀምራል...', { duration: 3000 });
  });

  // Emoji reactions from other players
  socket.on('reaction:new', (reaction) => {
    getStore().addReaction(reaction);
  });

  socket.on('error', ({ message }) => {
    toast.error(message);
  });
}

// ─── Create (or recreate) the socket with a given token ──
function createSocket(token) {
  // Disconnect old socket cleanly
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }

  const serverUrl = import.meta.env.VITE_API_URL || '';

  socketInstance = io(serverUrl, {
    auth:                token ? { token } : {},
    transports:          ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay:   1000,
  });

  attachListeners(socketInstance);
  return socketInstance;
}

// ─── Call this after login to upgrade the socket ─────────
export function reconnectWithToken(token) {
  console.log('🔄 Reconnecting socket with auth token...');
  createSocket(token);
}

// ─── Hook: initialise socket on app mount ────────────────
export function useSocket() {
  useEffect(() => {
    // Only create if not already connected
    if (!socketInstance) {
      const token = useGameStore.getState().token;
      createSocket(token);
    }
  }, []);

  return socketInstance;
}

export function getSocket() {
  return socketInstance;
}
