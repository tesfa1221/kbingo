import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../hooks/useSocket';

export default function RoomSelector() {
  const { rooms, currentRoom, setCurrentRoom, user } = useGameStore();

  if (!rooms || rooms.length < 2) return null;

  const handleSwitch = (roomId) => {
    if (roomId === currentRoom) return;
    const socket = getSocket();
    if (socket) socket.emit('room:join', { roomId });
    setCurrentRoom(roomId);
  };

  return (
    <div className="flex gap-2 px-3 pt-2">
      {rooms.map(room => {
        const active   = room.roomId === currentRoom;
        const canAfford = parseFloat(user?.balance || 0) >= room.entryFee;

        return (
          <motion.button
            key={room.roomId}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSwitch(room.roomId)}
            className={`flex-1 rounded-xl p-3 border transition-all text-left
              ${active
                ? 'bg-gold/15 border-gold/50'
                : 'bg-surface2 border-white/5 hover:border-white/20'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-black ${active ? 'text-gold' : 'text-muted'}`}>
                {room.roomLabel || room.roomId}
              </span>
              {active && <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold">ያሁኑ</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-black ${active ? 'text-white' : canAfford ? 'text-white/70' : 'text-danger/60'}`}>
                {room.entryFee} ETB
              </span>
              <div className="text-right">
                <p className={`text-[10px] font-bold ${active ? 'text-neon' : 'text-muted'}`}>
                  {room.playerCount} ተጫዋቾች
                </p>
                <p className={`text-[9px] ${active ? 'text-gold/70' : 'text-muted/60'}`}>
                  ≥{room.minPrize} ETB ደራሽ
                </p>
              </div>
            </div>
            {!canAfford && (
              <p className="text-danger text-[9px] font-amharic mt-0.5">ሂሳብ አልበቃም</p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
