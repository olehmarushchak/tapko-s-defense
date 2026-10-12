import { supabase } from './supabase';

// ─── Session state ─────────────────────────────────────────────────────────────
// One session row per NFC tap (page load). All events share the same session_id.

let sessionId: string | null = null;
let sessionStart: number = Date.now();

function getChipId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('chip') ?? 'unknown';
}

async function initSession(): Promise<void> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      chip_id:    getChipId(),
      user_agent: navigator.userAgent,
      referrer:   document.referrer || null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[analytics] session init failed:', error.message);
    return;
  }

  sessionId    = data.id;
  sessionStart = Date.now();
}

async function closeSession(): Promise<void> {
  if (!sessionId) return;
  const duration = Math.round((Date.now() - sessionStart) / 1000);
  await supabase
    .from('sessions')
    .update({ ended_at: new Date().toISOString(), duration_seconds: duration })
    .eq('id', sessionId);
}

// ─── Public API ────────────────────────────────────────────────────────────────

// Drop-in replacement for the old stub. Fire-and-forget — never blocks the UI.
export function logEvent(eventName: string, payload: Record<string, unknown> = {}): void {
  console.log('[analytics]', eventName, payload);

  supabase
    .from('events')
    .insert({ session_id: sessionId, chip_id: getChipId(), event_name: eventName, payload })
    .then(({ error }) => {
      if (error) console.warn('[analytics] event failed:', error.message);
    });
}

// Call once on app mount. Creates the session and registers leave listeners.
export async function initAnalytics(): Promise<void> {
  await initSession();
  logEvent('page_open', { chip_id: getChipId(), url: window.location.href });

  const handleLeave = () => closeSession();
  window.addEventListener('beforeunload', handleLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') closeSession();
  });
}
