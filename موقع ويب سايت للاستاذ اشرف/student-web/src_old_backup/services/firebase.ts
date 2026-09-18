import type { Messaging } from 'firebase/messaging';

// ⚠️ مشروع Firebase الخارجي — يحتاج ترحيلاً يدوياً إلى مشروع يخصّ فُصْحَى.
// معرّف المشروع أدناه يخص مشروعاً قائماً بالفعل ولا يمكن تغييره دون كسر إشعارات
// Push للطلاب المسجَّلين؛ أي ترحيل يتطلب إنشاء مشروع Firebase جديد وإعادة تسجيل
// الأجهزة. القيم آمنة للتضمين في الواجهة — إعدادات Firebase ليست سراً، والتحكم
// الفعلي يتم من قواعد الأمان على الخادم ومن مصادقة الباكند.
const firebaseConfig = {
  apiKey: 'AIzaSyAV8sko2FrZhxu64DXmqm1ZG1eTVVbVUWM',
  authDomain: 'synaptic-3ef0d.firebaseapp.com',
  projectId: 'synaptic-3ef0d',
  storageBucket: 'synaptic-3ef0d.firebasestorage.app',
  messagingSenderId: '633875033612',
  appId: '1:633875033612:web:ed65fa0d99ff5b086fc829',
  measurementId: 'G-NY9CYE8YN8',
};

const VAPID_KEY = 'BPgvqsnXE4JiPzLjz21EOgyqE9MCQGKaRCFtvC6nD-CywAANZPYBVy0U1whXkNwTb5xYGnWd0l4juufwmGUI5n0';

const PUSH_PERMISSION_TIMEOUT_MS = 10000;

// Races a promise against a timeout so an unanswered permission prompt or a
// stalled token fetch can never hang the caller indefinitely.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); }
    );
  });
}

let messagingInstance: Messaging | null = null;
let messagingSupportChecked = false;

/**
 * Lazily resolve a Messaging instance, guarded by feature support detection.
 * The `firebase/app` and `firebase/messaging` SDKs (and `initializeApp`) are
 * only fetched here, on first actual use — every caller in this file is
 * already async, so this never blocks initial page load / the main bundle
 * for guests and students who never touch push notifications.
 */
async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (messagingSupportChecked) return null;

  messagingSupportChecked = true;
  try {
    const [{ initializeApp }, { getMessaging, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    const supported = await isSupported();
    if (!supported) return null;
    const firebaseApp = initializeApp(firebaseConfig);
    messagingInstance = getMessaging(firebaseApp);
    return messagingInstance;
  } catch {
    return null;
  }
}

/**
 * Requests browser notification permission and, if granted, retrieves an
 * FCM registration token bound to the existing PWA service worker (the same
 * /sw.js registration created in main.tsx — never registers a duplicate SW).
 *
 * This is a nice-to-have feature: it never throws. Any failure (unsupported
 * browser, denied permission, missing SW, network error) resolves to null so
 * callers can safely ignore the result and continue.
 */
export async function requestPushPermission(): Promise<string | null> {
  const attempt = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null;
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;

      const messaging = await getMessagingInstance();
      if (!messaging) return null;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      // Reuse the PWA service worker registration (registered in main.tsx)
      // instead of registering a second one at the same scope.
      const registration = await navigator.serviceWorker.ready;

      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      return token || null;
    } catch (err) {
      console.error('Failed to obtain push notification token:', err);
      return null;
    }
  };

  // An unanswered permission prompt or a stalled token fetch must never hang
  // the caller — fall back to "no token" past the timeout.
  return withTimeout(attempt(), PUSH_PERMISSION_TIMEOUT_MS, null);
}

/**
 * Returns the current browser Notification permission state, or null if the
 * Notification API isn't available (unsupported browser / non-browser env).
 */
export function getNotificationPermissionState(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

/**
 * Subscribes to foreground FCM messages (i.e. push events that arrive while
 * the app tab is open and focused — background messages are handled by the
 * service worker's onBackgroundMessage handler in public/sw.js instead).
 * Returns an unsubscribe function, or a no-op if messaging isn't supported.
 */
export async function subscribeToForegroundMessages(
  callback: (payload: { title?: string; body?: string }) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  const { onMessage } = await import('firebase/messaging');
  const unsubscribe = onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
    });
  });

  return unsubscribe;
}
