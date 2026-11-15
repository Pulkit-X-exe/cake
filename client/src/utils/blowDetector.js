// Microphone-based Candle Blow Detection using Web Audio API

export class BlowDetector {
  constructor(options = {}) {
    this.sensitivity = options.sensitivity || 1.0; // 0.5 to 2.0
    this.onBlow = options.onBlow || (() => {}); // callback with intensity (0 - 1)
    this.onExtinguish = options.onExtinguish || (() => {}); // callback when target reached
    this.onMeter = options.onMeter || (() => {}); // callback for mic test meter

    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.source = null;
    this.isRunning = false;
    this.animationFrameId = null;

    this.accumulatedProgress = 0; // 0 to 100
    this.targetToExtinguish = 100;
    this.extinguished = false;
  }

  async start() {
    if (this.isRunning) return true;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Turn off cancellation so wind/blow noise isn't suppressed!
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2; // Quick response to breath bursts

      this.source.connect(this.analyser);
      this.isRunning = true;
      this.extinguished = false;
      this.accumulatedProgress = 0;

      this.processAudio();
      return true;
    } catch (err) {
      console.warn('[BlowDetector] Could not access microphone:', err);
      return false;
    }
  }

  processAudio() {
    if (!this.isRunning || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    this.analyser.getByteFrequencyData(dataArray);
    this.analyser.getByteTimeDomainData(timeData);

    // 1. Calculate RMS volume (loudness)
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // 2. Frequency bands analysis
    // Bin width = sampleRate / fftSize (e.g. 48000 / 512 ~ 93.75 Hz per bin)
    // Wind/breath turbulence is concentrated in low-to-mid bins (bins 1 to 6: ~90Hz - 560Hz)
    // Vocal/speech harmonics are concentrated in bins 9 to 35: ~800Hz - 3300Hz
    let lowEnergy = 0;
    let highEnergy = 0;

    for (let i = 1; i <= 6; i++) {
      lowEnergy += dataArray[i];
    }
    lowEnergy /= 6; // Average 0-255

    for (let i = 9; i <= 35 && i < bufferLength; i++) {
      highEnergy += dataArray[i];
    }
    highEnergy /= 27; // Average 0-255

    // Breath turbulence ratio
    // When someone speaks, highEnergy is strong. When blowing, low turbulence dominates.
    const blowRatio = (lowEnergy + 1) / (highEnergy + 8);
    const energyLevel = lowEnergy / 255; // 0 to 1

    // Overall Blow Score
    // Adjusted by user sensitivity
    const thresholdRMS = 0.04 / this.sensitivity;
    const isBlowing = rms > thresholdRMS && lowEnergy > 50 && blowRatio > 0.85;

    let blowIntensity = 0;
    if (isBlowing) {
      blowIntensity = Math.min(1.0, (lowEnergy / 180) * this.sensitivity);
    }

    // Live callback for mic meter
    this.onMeter({
      rms: Math.min(1, rms * 5),
      lowEnergy: energyLevel,
      blowIntensity,
      isBlowing
    });

    if (!this.extinguished) {
      if (isBlowing && blowIntensity > 0.25) {
        // Accumulate progress
        const increment = blowIntensity * 3.5 * this.sensitivity;
        this.accumulatedProgress = Math.min(100, this.accumulatedProgress + increment);
        this.onBlow(blowIntensity, this.accumulatedProgress);

        if (this.accumulatedProgress >= this.targetToExtinguish) {
          this.extinguished = true;
          this.onExtinguish();
        }
      } else {
        // Decay progress if they stop blowing
        if (this.accumulatedProgress > 0) {
          this.accumulatedProgress = Math.max(0, this.accumulatedProgress - 0.8);
          this.onBlow(0, this.accumulatedProgress);
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.processAudio());
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.4, Math.min(3.0, val));
  }

  reset() {
    this.accumulatedProgress = 0;
    this.extinguished = false;
  }

  manualBlow() {
    this.accumulatedProgress = 100;
    this.extinguished = true;
    this.onBlow(1.0, 100);
    this.onExtinguish();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }
  }
}

