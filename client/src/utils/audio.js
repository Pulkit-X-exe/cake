// Web Audio API procedural sound engine and synthesizer
// Guarantees high-quality romantic music and celebration sound effects with ZERO external network dependencies!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.isPlayingMusic = false;
    this.musicMode = 'romantic'; // 'romantic' | 'celebration'
    this.musicInterval = null;
    this.step = 0;
    this.volume = 0.7;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Romantic piano/celesta bell note
  playPluckNote(freq, time, duration = 2.5, gainLevel = 0.25) {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    // Warm sine and triangle harmonics
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + duration);

    noteGain.gain.setValueAtTime(0.001, time);
    noteGain.gain.linearRampToValueAtTime(gainLevel, time + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.musicGain);

    osc.start(time);
    osc2.start(time);
    osc.stop(time + duration);
    osc2.stop(time + duration);
  }

  // Play warm bass pad
  playPad(freq, time, duration = 4.0) {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.12, time + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  startMusic(mode = 'romantic') {
    this.ensureContext();
    this.musicMode = mode;
    this.isPlayingMusic = true;

    if (this.musicInterval) clearInterval(this.musicInterval);

    // Romantic Pentatonic Progression (Db Major / Ab / Bb minor / Gb)
    const romanticProgression = [
      // Chord 1: Db major
      { bass: 138.59, notes: [277.18, 349.23, 415.30, 554.37, 698.46] },
      // Chord 2: Ab major
      { bass: 103.83, notes: [207.65, 261.63, 311.13, 415.30, 523.25] },
      // Chord 3: Bb minor
      { bass: 116.54, notes: [233.08, 277.18, 349.23, 466.16, 554.37] },
      // Chord 4: Gb major 7
      { bass: 92.50,  notes: [185.00, 277.18, 370.00, 466.16, 554.37] }
    ];

    // Celebration Upbeat Chords (Joyful C - G - Am - F with faster arpeggios)
    const celebrationProgression = [
      { bass: 130.81, notes: [261.63, 329.63, 392.00, 523.25, 659.25] },
      { bass: 98.00,  notes: [196.00, 246.94, 293.66, 392.00, 587.33] },
      { bass: 110.00, notes: [220.00, 261.63, 329.63, 440.00, 659.25] },
      { bass: 87.31,  notes: [174.61, 261.63, 349.23, 440.00, 523.25] }
    ];

    let chordIndex = 0;
    let noteIndex = 0;
    const tempo = this.musicMode === 'celebration' ? 240 : 420; // ms per beat

    this.musicInterval = setInterval(() => {
      if (!this.isPlayingMusic || !this.ctx || this.isMuted) return;

      const prog = this.musicMode === 'celebration' ? celebrationProgression : romanticProgression;
      const currentChord = prog[chordIndex];
      const now = this.ctx.currentTime;

      // Play bass on first beat of chord
      if (noteIndex === 0) {
        this.playPad(currentChord.bass, now, (tempo * 4) / 1000);
      }

      // Play melodic arpeggio note
      const noteFreq = currentChord.notes[noteIndex % currentChord.notes.length];
      const duration = this.musicMode === 'celebration' ? 1.2 : 2.5;
      const level = this.musicMode === 'celebration' ? 0.35 : 0.22;
      this.playPluckNote(noteFreq, now, duration, level);

      noteIndex++;
      if (noteIndex >= 4) {
        noteIndex = 0;
        chordIndex = (chordIndex + 1) % prog.length;
      }
    }, tempo);
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  setMusicMode(mode) {
    if (this.musicMode !== mode) {
      this.musicMode = mode;
      if (this.isPlayingMusic) {
        this.startMusic(mode);
      }
    }
  }

  // Sound Effects

  // 1. Candle blowing whoosh
  playBlowingSound(duration = 0.8) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + duration);
    filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  // 2. Candle puff extinguish
  playExtinguishSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    this.playBlowingSound(0.5);

    // Gentle smoke hiss
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 3. Firework Launch and Burst
  playFireworkSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Launch whistle
    const whistle = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();
    whistle.type = 'triangle';
    whistle.frequency.setValueAtTime(300, now);
    whistle.frequency.exponentialRampToValueAtTime(1800, now + 0.4);

    whistleGain.gain.setValueAtTime(0.1, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    whistle.connect(whistleGain);
    whistleGain.connect(this.sfxGain);
    whistle.start(now);
    whistle.stop(now + 0.4);

    // Explosion Boom (at now + 0.4s)
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      const boomTime = this.ctx.currentTime;

      // Low sub boom
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(140, boomTime);
      boomOsc.frequency.exponentialRampToValueAtTime(35, boomTime + 0.8);

      boomGain.gain.setValueAtTime(0.5, boomTime);
      boomGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.8);

      boomOsc.connect(boomGain);
      boomGain.connect(this.sfxGain);
      boomOsc.start(boomTime);
      boomOsc.stop(boomTime + 0.8);

      // Crackles
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          if (!this.ctx || this.isMuted) return;
          const pop = this.ctx.createOscillator();
          const popGain = this.ctx.createGain();
          pop.type = 'triangle';
          pop.frequency.setValueAtTime(800 + Math.random() * 1200, this.ctx.currentTime);
          popGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
          popGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

          pop.connect(popGain);
          popGain.connect(this.sfxGain);
          pop.start();
          pop.stop(this.ctx.currentTime + 0.08);
        }, 100 + i * 80 + Math.random() * 50);
      }
    }, 400);
  }

  // 4. Cake Knife Slice Sound
  playKnifeCutSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic shimmer
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.35);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.35);

    // Chime
    this.playSparkleChime();
  }

  // 5. Sparkle / Wish / Celebration Chime
  playSparkleChime() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major arpeggio high

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.7);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.7);
    });
  }

  // 6. Pop / Reaction Sound
  playPopSound() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const soundEngine = new SoundEngine();

