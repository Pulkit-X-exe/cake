import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  Send,
  Edit3,
  Check,
  RotateCcw,
  Star,
  Mail,
  Feather
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundEngine } from '../utils/audio';

export default function RomanticEnding({
  letter = {
    senderName: 'Forever Yours',
    recipientName: 'Birthday Star',
    title: 'Under the Midnight Stars',
    body: `Happy Birthday, my favorite soul in the universe!

Even across the distance and miles between us, my heart is right beside yours tonight.
Watching you smile as you blow out these candles makes the whole world feel warmer.

May this new year bring you infinite joy, gentle mornings, soaring dreams, and all the love you give so effortlessly to the world.

Always and forever with you ❤️`,
    revealed: false
  },
  onUpdateLetter = () => {},
  onRevealLetter = () => {},
  onRelightCandles = () => {},
  onSendWish = () => {},
  wishes = [],
  isHost = true
}) {
  const defaultBody = `Happy Birthday, my favorite soul in the universe!

Even across the distance and miles between us, my heart is right beside yours tonight.
Watching you smile as you blow out these candles makes the whole world feel warmer.

May this new year bring you infinite joy, gentle mornings, soaring dreams, and all the love you give so effortlessly to the world.

Always and forever with you ❤️`;

  const letterBody = (letter && letter.body && letter.body.trim()) ? letter.body : defaultBody;
  const recipientName = (letter && letter.recipientName && letter.recipientName.trim()) ? letter.recipientName : 'Birthday Star';
  const senderName = (letter && letter.senderName && letter.senderName.trim()) ? letter.senderName : 'Forever Yours';
  const letterTitle = (letter && letter.title && letter.title.trim()) ? letter.title : 'Under the Midnight Stars';

  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(letterBody);
  const [editTitle, setEditTitle] = useState(letterTitle);
  const [editSender, setEditSender] = useState(senderName);
  const [editRecipient, setEditRecipient] = useState(recipientName);

  React.useEffect(() => {
    if (letter?.body) setEditBody(letter.body);
    if (letter?.title) setEditTitle(letter.title);
    if (letter?.senderName) setEditSender(letter.senderName);
    if (letter?.recipientName) setEditRecipient(letter.recipientName);
  }, [letter]);

  const [wishText, setWishText] = useState('');
  const [showWishModal, setShowWishModal] = useState(false);
  const [shootingStars, setShootingStars] = useState([]);

  // Break Wax Seal & Reveal Letter
  const handleOpenEnvelope = () => {
    soundEngine.playSparkleChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#f43f5e', '#fbbf24', '#ffffff']
    });
    onRevealLetter();
  };

  // Save edited letter
  const handleSaveLetter = () => {
    setIsEditing(false);
    onUpdateLetter({
      title: editTitle,
      body: editBody,
      senderName: editSender,
      recipientName: editRecipient
    });
  };

  // Make a wish (shooting star)
  const handleMakeWish = (e) => {
    e.preventDefault();
    if (!wishText.trim()) return;

    soundEngine.playSparkleChime();
    onSendWish(wishText.trim());

    // Trigger visual shooting star
    const newStar = {
      id: Date.now(),
      startX: Math.random() * 80 + 10,
      startY: Math.random() * 30 + 10
    };
    setShootingStars(prev => [...prev, newStar]);
    setTimeout(() => {
      setShootingStars(prev => prev.filter(s => s.id !== newStar.id));
    }, 2000);

    setWishText('');
    setShowWishModal(false);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-start p-4 sm:p-8 overflow-y-auto">
      {/* Shooting stars animation */}
      {shootingStars.map(star => (
        <div
          key={star.id}
          className="fixed z-50 pointer-events-none w-1 h-1 bg-white rounded-full shadow-[0_0_12px_#ffffff] animate-shootingStar"
          style={{
            top: `${star.startY}%`,
            left: `${star.startX}%`
          }}
        />
      ))}

      {/* Main Quote Banner */}
      <div className="text-center max-w-2xl mt-4 sm:mt-8 animate-fadeIn">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 text-xs sm:text-sm font-semibold mb-4 backdrop-blur-md">
          <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
          <span>OUR CELEBRATION</span>
          <Sparkles className="w-4 h-4 text-amber-300" />
        </div>

        <h1 className="font-serif-luxury italic text-3xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-pink-300 drop-shadow-md leading-tight">
          “Distance means nothing when two hearts celebrate together.”
        </h1>
        <p className="mt-3 text-xs sm:text-sm text-pink-300/80">
          The candles may be blown, but our midnight memories glow forever.
        </p>
      </div>

      {/* The Wax-Sealed Romantic Envelope / Parchment Letter */}
      <div className="w-full max-w-xl mt-8 mb-10 transition-all duration-500">
        {!letter.revealed ? (
          // Sealed Romantic Envelope
          <div
            onClick={handleOpenEnvelope}
            className="group relative cursor-pointer mx-auto max-w-md p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#2a0c3b] via-[#3d1149] to-[#1e072b] border-2 border-amber-400/50 shadow-2xl hover:border-amber-300 hover:shadow-glow-gold transition-all duration-300 text-center"
          >
            {/* Envelope Flap Lines */}
            <div className="absolute top-0 left-0 right-0 h-28 border-b border-amber-400/20 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <Mail className="w-12 h-12 text-amber-300/80 mb-3 group-hover:scale-110 transition-transform" />

              <span className="text-xs uppercase tracking-widest text-amber-300/70 font-semibold">
                Private Message For
              </span>
              <h3 className="font-script-romantic text-3xl sm:text-4xl text-rose-200 mt-1">
                {letter.recipientName || 'Birthday Star'}
              </h3>

              {/* Glowing Wax Seal */}
              <div className="mt-6 w-20 h-20 rounded-full bg-gradient-to-br from-rose-600 to-rose-950 border-2 border-rose-400/80 shadow-[0_0_25px_rgba(225,29,72,0.6)] flex items-center justify-center group-hover:scale-110 active:scale-95 transition-all">
                <Heart className="w-9 h-9 text-rose-200 fill-rose-300 drop-shadow" />
              </div>

              <p className="mt-4 text-xs sm:text-sm text-amber-200/90 font-medium">
                Click Wax Seal to Open Your Letter ❤️
              </p>
            </div>
          </div>
        ) : (
          // Unfolded Parchment Love Letter
          <div className="relative mx-auto rounded-3xl bg-[#fdf6e7] text-[#2c1810] p-6 sm:p-10 shadow-2xl border-2 border-amber-300/60 font-serif-luxury animate-fadeIn">
            {/* Parchment styling texture */}
            <div className="flex items-center justify-between border-b border-amber-900/20 pb-4 mb-6">
              <div className="flex items-center gap-2 text-rose-700">
                <Feather className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest font-sans font-bold">Midnight Keepsake</span>
              </div>

              {isHost && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3 py-1 text-xs font-sans rounded-full bg-amber-900/10 hover:bg-amber-900/20 text-amber-950 flex items-center gap-1.5 transition-colors"
                >
                  {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  <span>{isEditing ? 'Done Editing' : 'Edit Letter'}</span>
                </button>
              )}
            </div>

            {isEditing ? (
              // Edit Mode
              <div className="space-y-4 font-sans text-sm">
                <div>
                  <label className="block text-xs font-semibold text-amber-950/70 mb-1">Letter Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-900/30 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-rose-500 font-serif-luxury text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-950/70 mb-1">Your Personal Message</label>
                  <textarea
                    rows={7}
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-900/30 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-rose-500 font-serif-luxury text-sm leading-relaxed"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleSaveLetter}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors"
                  >
                    Save & Sync Letter
                  </button>
                </div>
              </div>
            ) : (
              // Display Mode
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-amber-950 mb-4 text-center">
                  {letter.title || 'Under the Midnight Stars'}
                </h2>

                <div className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-amber-900/90 font-serif-luxury px-2 sm:px-4">
                  {letter.body}
                </div>

                <div className="mt-8 text-right pr-4">
                  <p className="font-script-romantic text-2xl sm:text-3xl text-rose-800">
                    {letter.senderName || 'Forever Yours'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons: "One More Wish?" & "Relight Candles" */}
      <div className="flex flex-wrap items-center justify-center gap-4 z-20">
        <button
          onClick={() => setShowWishModal(true)}
          className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-bold text-sm sm:text-base shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 border border-amber-300/40"
        >
          <Star className="w-5 h-5 text-amber-200 fill-amber-200 animate-spin" />
          <span>One More Wish? 🌟</span>
        </button>

        <button
          onClick={onRelightCandles}
          className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-pink-100 font-semibold text-sm sm:text-base backdrop-blur-md transition-all flex items-center gap-2 border border-white/20"
        >
          <RotateCcw className="w-4 h-4 text-pink-300" />
          <span>Relight Candles 🎂</span>
        </button>
      </div>

      {/* Shared Birthday Constellation Wishes */}
      {wishes.length > 0 && (
        <div className="w-full max-w-xl mt-10">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-amber-300/80 text-center mb-3">
            ✨ Shared Midnight Wishes ✨
          </h4>
          <div className="space-y-2">
            {wishes.map(w => (
              <div
                key={w.id}
                className="p-3 rounded-2xl bg-white/5 border border-pink-500/20 text-pink-100 text-xs sm:text-sm backdrop-blur-sm flex items-center justify-between"
              >
                <span>“{w.text}”</span>
                <span className="text-[11px] text-pink-400/80 font-serif-luxury italic ml-2">
                  — {w.author}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Make a Wish Modal */}
      {showWishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#1d092c] border border-amber-400/40 p-6 shadow-2xl text-center">
            <Star className="w-10 h-10 text-amber-300 mx-auto mb-2 fill-amber-300 animate-bounce" />
            <h3 className="font-serif-luxury text-2xl font-bold text-amber-200">
              Make a Secret Midnight Wish 🌟
            </h3>
            <p className="mt-1 text-xs text-pink-300/80">
              Type your wish and release it to the midnight sky as a shooting star.
            </p>

            <form onSubmit={handleMakeWish} className="mt-5 space-y-4">
              <textarea
                rows={3}
                required
                value={wishText}
                onChange={e => setWishText(e.target.value)}
                placeholder="What does your heart wish for tonight?"
                className="w-full p-3 bg-black/50 border border-pink-500/30 rounded-2xl text-pink-100 placeholder-pink-400/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWishModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-pink-200 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to the Stars</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

