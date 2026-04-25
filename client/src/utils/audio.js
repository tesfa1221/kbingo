/**
 * Audio engine — lightweight version.
 * Uses AudioContext tones only (no Speech Synthesis = less data, faster).
 * Speech synthesis is optional and only loads voices once.
 */
import { useGameStore } from '../store/gameStore';

let ctx             = null;
let gestureReceived = false;
let voicesLoaded    = false;
let cachedVoice     = null;

export function initAudio() {
  gestureReceived = true;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { /* not supported */ }
  }
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  // Pre-load voices once
  if (window.speechSynthesis && !voicesLoaded) {
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      cachedVoice = voices.find(v => v.lang === 'en-US') || voices[0] || null;
      voicesLoaded = true;
    };
    if (window.speechSynthesis.getVoices().length) load();
    else window.speechSynthesis.onvoiceschanged = load;
  }
}

function isOn() {
  return gestureReceived && useGameStore.getState().audioOn;
}

function getBallLetter(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

function getCtx() {
  if (!ctx) initAudio();
  return ctx;
}

function playTone(freq, duration, type = 'sine', gain = 0.25) {
  if (!isOn()) return;
  try {
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch { /* ignore */ }
}

// Ball call: short beep + optional speech
export function playBallCall(number) {
  if (!isOn()) return;
  // Short beep first (instant, no data)
  playTone(660, 0.12, 'sine', 0.2);
  // Speech only if voices are loaded (non-blocking)
  if (window.speechSynthesis && voicesLoaded) {
    const letter = getBallLetter(number);
    const utt    = new SpeechSynthesisUtterance(`${letter} ${number}`);
    utt.rate   = 1.0;
    utt.volume = 0.9;
    if (cachedVoice) utt.voice = cachedVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }
}

export function playDrumRoll() {
  if (!isOn()) return;
  // Simple rapid beeps instead of noise buffer (lighter)
  [0, 80, 160, 240, 320, 400].forEach((delay, i) => {
    setTimeout(() => playTone(200 + i * 30, 0.06, 'square', 0.15), delay);
  });
}

export function playBingoWin() {
  if (!isOn()) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.35, 'triangle', 0.35), i * 120);
  });
}

export function playPenalty() {
  if (!isOn()) return;
  [200, 150].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.25), i * 180);
  });
}

export function playHapticPulse() {
  if (!isOn()) return;
  playTone(440, 0.04, 'sine', 0.12);
  if (navigator.vibrate) navigator.vibrate(20);
}
