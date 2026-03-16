const DS_DEVICE_ID_KEY = 'ds_device_id';
const DS_SESSION_ID_KEY = 'ds_session_id';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceId(configured?: string): string {
  if (configured) return configured;
  try {
    const stored = localStorage.getItem(DS_DEVICE_ID_KEY);
    if (stored) return stored;
    const id = generateUUID();
    localStorage.setItem(DS_DEVICE_ID_KEY, id);
    return id;
  } catch {
    return generateUUID();
  }
}

export function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem(DS_SESSION_ID_KEY);
    if (stored) return stored;
    const id = generateUUID();
    sessionStorage.setItem(DS_SESSION_ID_KEY, id);
    return id;
  } catch {
    return generateUUID();
  }
}

export function getPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'web';
}

export function getOSVersion(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const match =
    ua.match(/Windows NT ([\d.]+)/) ||
    ua.match(/Mac OS X ([\d._]+)/) ||
    ua.match(/Android ([\d.]+)/) ||
    ua.match(/OS ([\d_]+) like Mac OS X/);
  if (match) return match[1].replace(/_/g, '.');
  return 'unknown';
}

export function getNetworkType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  return conn?.effectiveType ?? 'unknown';
}
