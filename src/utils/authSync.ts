/**
 * Sincronización de eventos de autenticación entre pestañas del navegador.
 *
 * CRÍTICO POR SEGURIDAD:
 * Jamás transmite tokens, contraseñas, perfiles de usuario ni credenciales.
 * Únicamente emite señales atómicas de tipo ('LOGOUT' | 'LOGIN') con marca temporal
 * para que otras pestañas abiertas limpien su estado y caché o re-validen la sesión con el servidor.
 */

export type AuthSyncEventType = 'LOGOUT' | 'LOGIN';

export interface AuthSyncEvent {
  type: AuthSyncEventType;
  timestamp: number;
}

const CHANNEL_NAME = 'sc_auth_sync_channel';
const STORAGE_KEY = 'sc_auth_sync_event';
const UNCONFIRMED_EXIT_KEY = 'sc_unconfirmed_local_exit';

let broadcastChannel: BroadcastChannel | null = null;

export function _resetChannelForTesting(): void {
  broadcastChannel = null;
}

/**
 * Marca la existencia de una salida local no confirmada en el servidor.
 * CRÍTICO: No almacena tokens, contraseñas ni datos del usuario. Solo una marca booleana.
 */
export function setUnconfirmedExitMarker(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(UNCONFIRMED_EXIT_KEY, 'true');
  } catch {}
  try {
    window.localStorage?.setItem(UNCONFIRMED_EXIT_KEY, 'true');
  } catch {}
}

/**
 * Comprueba si existe una salida local previa pendiente de confirmación remota.
 */
export function hasUnconfirmedExitMarker(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage?.getItem(UNCONFIRMED_EXIT_KEY) === 'true') return true;
  } catch {}
  try {
    if (window.localStorage?.getItem(UNCONFIRMED_EXIT_KEY) === 'true') return true;
  } catch {}
  return false;
}

/**
 * Elimina la marca de salida local una vez que la revocación remota fue confirmada
 * o se estableció una nueva sesión legítima.
 */
export function clearUnconfirmedExitMarker(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(UNCONFIRMED_EXIT_KEY);
  } catch {}
  try {
    window.localStorage?.removeItem(UNCONFIRMED_EXIT_KEY);
  } catch {}
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      broadcastChannel = null;
    }
  }
  return broadcastChannel;
}

/**
 * Emite una señal de evento de autenticación a todas las demás pestañas abiertas.
 */
export function broadcastAuthEvent(event: AuthSyncEvent): void {
  if (typeof window === 'undefined') return;

  // 1. Vía BroadcastChannel (mecanismo primario moderno)
  const channel = getChannel();
  if (channel) {
    try {
      channel.postMessage(event);
    } catch {
      // Ignorar fallos de postMessage y continuar con fallback
    }
  }

  // 2. Vía localStorage 'storage' event (mecanismo de respaldo cross-tab)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  } catch {
    // Si localStorage no está disponible (modo incógnito estricto o cuota excedida), no bloquear
  }
}

/**
 * Suscribe un listener a eventos de autenticación emitidos por otras pestañas.
 * Retorna una función de desuscripción (cleanup).
 */
export function onAuthBroadcast(callback: (event: AuthSyncEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const channel = getChannel();

  // Handler para BroadcastChannel
  const channelListener = (messageEvent: MessageEvent<AuthSyncEvent>) => {
    if (messageEvent.data && (messageEvent.data.type === 'LOGOUT' || messageEvent.data.type === 'LOGIN')) {
      callback(messageEvent.data);
    }
  };

  if (channel) {
    channel.addEventListener('message', channelListener);
  }

  // Handler para storage event (respaldo)
  const storageListener = (storageEvent: StorageEvent) => {
    if (storageEvent.key === STORAGE_KEY && storageEvent.newValue) {
      try {
        const parsed = JSON.parse(storageEvent.newValue) as AuthSyncEvent;
        if (parsed.type === 'LOGOUT' || parsed.type === 'LOGIN') {
          callback(parsed);
        }
      } catch {
        // Ignorar JSON malformado
      }
    }
  };

  window.addEventListener('storage', storageListener);

  return () => {
    if (channel) {
      channel.removeEventListener('message', channelListener);
    }
    window.removeEventListener('storage', storageListener);
  };
}
