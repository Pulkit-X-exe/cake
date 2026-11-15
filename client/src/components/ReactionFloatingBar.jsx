import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, Smile, PartyPopper } from 'lucide-react';
import { soundEngine } from '../utils/audio';

const REACTIONS = [
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'kiss', emoji: '😘', label: 'Kiss' },
  { type: 'party', emoji: '🎉', label: 'Celebrate' },
  { type: 'sparkle', emoji: '✨', label: 'Sparkle' },
  { type: 'cake', emoji: '🍰', label: 'Sweet' }
];

export default function ReactionFloatingBar({
  socket,
  roomId,
  userName = 'You'
}) {
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleReactionReceived = ({ type, senderName, id }) => {
      soundEngine.playPopSound();
      const reactionObj = REACTIONS.find(r => r.type === type) || REACTIONS[0];

      // Spawn floating particle
      const newFloating = {
        id: id || Date.now() + Math.random(),
        emoji: reactionObj.emoji,
        senderName,
        startX: 20 + Math.random() * 60 // 20% to 80% screen width
      };

      setFloatingEmojis(prev => [...prev.slice(-15), newFloating]);

      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(e => e.id !== newFloating.id));
      }, 2600);
    };

    socket.on('reaction-received', handleReactionReceived);
    return () => {
      socket.off('reaction-received', handleReactionReceived);
    };
  }, [socket]);

  const triggerReaction = (type) => {
    soundEngine.playPopSound();
    if (socket && roomId) {
      socket.emit('send-reaction', { type, senderName: userName });
    }
  };

  return (
    <>
      {/* Floating upward floating particles */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingEmojis.map(item => (
          <div
            key={item.id}
            className="absolute bottom-20 flex flex-col items-center animate-floatUp"
            style={{ left: `${item.startX}%` }}
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-lg">{item.emoji}</span>
            <span className="text-[10px] text-pink-200/90 font-semibold bg-black/60 px-2 py-0.5 rounded-full mt-1 backdrop-blur-sm">
              {item.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Floating Reaction Dock */}
      <div className="fixed bottom-4 right-4 z-40 hidden sm:flex items-center gap-1.5 p-1.5 rounded-full bg-black/60 border border-pink-500/30 backdrop-blur-xl shadow-xl">
        {REACTIONS.map(r => (
          <button
            key={r.type}
            onClick={() => triggerReaction(r.type)}
            title={r.label}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg hover:scale-125 active:scale-95 transition-transform bg-white/5 hover:bg-white/20"
          >
            {r.emoji}
          </button>
        ))}
      </div>
    </>
  );
}

