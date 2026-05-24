// Web Audio API notification sounds — WhatsApp-style.
// All functions are no-ops if AudioContext is unavailable (SSR, policy block).

function makeCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

/** Soft single ding — played when a new client message arrives (admin side). */
export function playNewMessageSound(): void {
  const ac = makeCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sine';
  // C6 → G5 slide (warm, non-intrusive)
  osc.frequency.setValueAtTime(1046.5, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(783.99, ac.currentTime + 0.14);
  gain.gain.setValueAtTime(0.32, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.45);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.5);
}

/** Two-tone chime — played when a new order comes in (admin side). */
export function playNewOrderSound(): void {
  const ac = makeCtx();
  if (!ac) return;
  const notes: Array<{ freq: number; start: number }> = [
    { freq: 880, start: 0 },       // A5
    { freq: 1108.73, start: 0.15 }, // C#6
  ];
  notes.forEach(({ freq, start }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.28, ac.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + 0.3);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + 0.35);
  });
}

// ─── Desktop Notifications ────────────────────────────────────

/** Request browser notification permission once (call on admin page mount). */
export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/** Show a desktop notification if permission is granted. Silent on error. */
export function showDesktopNotif(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Silently ignore (Firefox may throw if icon is missing)
  }
}
