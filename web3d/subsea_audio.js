/**
 * Nautilus D-NAS — Subsea Acoustic Audio Synthesizer (Web Audio API)
 * Zero external dependencies: Procedural sound synthesis for:
 * 1. Deep Abyssal Ocean Ambience (low-frequency hydrostatic hum + swell LFO)
 * 2. High-Resonance Sonar Ping with underwater multi-tap acoustic reverberation
 * 3. Emergency Swarm Klaxon on drone hull breach / sink
 * 4. Checksum Bit-Rot Alert
 * 5. Reed-Solomon Reconstruction Success Chime
 */

(function () {
  let audioCtx = null;
  let masterGain = null;
  let humGain = null;
  let isMuted = false;
  let isInitialized = false;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ---------------------------------------------------------------------------
  // 1. Abyssal Ocean Ambience Hum
  // ---------------------------------------------------------------------------
  function startAbyssalHum() {
    const ctx = getAudioContext();
    if (!ctx || humGain) return;

    try {
      humGain = ctx.createGain();
      humGain.gain.setValueAtTime(0.04, ctx.currentTime);

      // Lowpass filter for deep subsea pressure feel
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(130, ctx.currentTime);

      // Fundamental ocean floor rumble (52 Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(52, ctx.currentTime);

      // Subtle harmonic overtone (104 Hz)
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(104, ctx.currentTime);

      // LFO for slow hydrostatic swell (0.15 Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.015, ctx.currentTime);
      lfo.connect(lfoGain.gain);

      osc1.connect(lowpass);
      osc2.connect(lowpass);
      lowpass.connect(humGain);
      humGain.connect(masterGain);

      osc1.start();
      osc2.start();
      lfo.start();
    } catch (e) {
      console.warn("[NautilusAudio] Abyssal hum init skipped:", e);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. High-Resonance Sonar Ping with Echo Reverb
  // ---------------------------------------------------------------------------
  function playSonarPing(baseFreq = 880, decay = 1.4) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Primary Ping Oscillator (Sine with subtle downward chirp)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, t + 0.15);

    // High Q Bandpass Filter for metallic hydrophone ring
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(baseFreq, t);
    filter.Q.setValueAtTime(8.0, t);

    // Exponential decay envelope
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(t);
    osc.stop(t + decay);

    // Underwater Acoustic Echo Taps (Seabed & Trench Reflections)
    const delays = [0.22, 0.45];
    const echoes = [0.12, 0.05];

    delays.forEach((delayTime, idx) => {
      const echoOsc = ctx.createOscillator();
      const echoGain = ctx.createGain();
      const echoTime = t + delayTime;

      echoOsc.type = "sine";
      echoOsc.frequency.setValueAtTime(baseFreq * 0.92, echoTime);

      echoGain.gain.setValueAtTime(echoes[idx], echoTime);
      echoGain.gain.exponentialRampToValueAtTime(0.0001, echoTime + decay * 0.7);

      echoOsc.connect(filter);
      filter.connect(echoGain);
      echoGain.connect(masterGain);

      echoOsc.start(echoTime);
      echoOsc.stop(echoTime + decay * 0.7);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Swarm Hull-Breach Emergency Siren / Klaxon
  // ---------------------------------------------------------------------------
  function playAlarm() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const duration = 0.65;

    // Dual-tone sawtooth alarm chirp
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "triangle";

    // Modulate pitch from 480 Hz to 720 Hz
    osc1.frequency.setValueAtTime(480, t);
    osc1.frequency.linearRampToValueAtTime(740, t + duration * 0.5);
    osc1.frequency.linearRampToValueAtTime(480, t + duration);

    osc2.frequency.setValueAtTime(240, t);
    osc2.frequency.linearRampToValueAtTime(370, t + duration * 0.5);
    osc2.frequency.linearRampToValueAtTime(240, t + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, t);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  // ---------------------------------------------------------------------------
  // 4. Bit-Rot Corruption Static Warning
  // ---------------------------------------------------------------------------
  function playBitRotWarning() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const duration = 0.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.setValueAtTime(280, t + 0.08);
    osc.frequency.setValueAtTime(210, t + 0.16);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  // ---------------------------------------------------------------------------
  // 5. Reed-Solomon Recovery Success Harmonic Chime
  // ---------------------------------------------------------------------------
  function playRecoveryChime() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // C Major Arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 1.2);
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Mute Controls & User Interaction Binding
  // ---------------------------------------------------------------------------
  function toggleMute() {
    isMuted = !isMuted;
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(isMuted ? 0.0 : 0.7, audioCtx.currentTime);
    }
    return isMuted;
  }

  function userInteractionInit() {
    if (!isInitialized) {
      isInitialized = true;
      getAudioContext();
      startAbyssalHum();
      console.log("[NautilusAudio] Subsea acoustic engine initialized.");
    }
  }

  // Attach auto-unlock listeners for modern browser autoplay policy
  window.addEventListener("pointerdown", userInteractionInit, { once: true });
  window.addEventListener("keydown", userInteractionInit, { once: true });

  // Expose global API
  window.NautilusAudio = {
    playSonarPing,
    playAlarm,
    playBitRotWarning,
    playRecoveryChime,
    toggleMute,
    isMuted: () => isMuted,
    init: userInteractionInit
  };
})();
