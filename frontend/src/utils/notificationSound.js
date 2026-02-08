// Subtle notification sound using Web Audio API (no external file needed)
// Plays a soft two-tone chime suitable for order alerts

let audioContext = null;

/**
 * Lazily initialize AudioContext (must be triggered by user interaction first)
 */
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play a subtle two-tone notification chime
 * @param {number} volume - Volume level 0.0 to 1.0 (default 0.15 for subtlety)
 */
export const playNotificationSound = (volume = 0.15) => {
  try {
    const ctx = getAudioContext();

    // First tone: soft C5 (523 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 523;
    gain1.gain.setValueAtTime(volume, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second tone: soft E5 (659 Hz), slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 659;
    gain2.gain.setValueAtTime(volume, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (error) {
    console.warn('No se pudo reproducir sonido de notificación:', error);
  }
};
