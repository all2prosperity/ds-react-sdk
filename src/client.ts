import type { DataSneakerConfig, TrackEvent, EventPayload } from './types';
import { generateUUID, getDeviceId, getSessionId, getPlatform, getOSVersion, getNetworkType } from './utils';

const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const REQUEST_TIMEOUT = 10000;
const OFFLINE_QUEUE_KEY = 'ds_offline_queue';

export class DataSneakerClient {
  private config: Required<
    Pick<DataSneakerConfig, 'serverUrl' | 'userId' | 'flushInterval' | 'maxBatchSize' | 'maxQueueSize' | 'debug'>
  > &
    DataSneakerConfig;
  private deviceId: string;
  private sessionId: string;
  private platform: string;
  private osVersion: string;
  private queue: EventPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(config: DataSneakerConfig) {
    this.config = {
      ...config,
      flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
      maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
      maxQueueSize: config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      debug: config.debug ?? false,
    };
    this.deviceId = getDeviceId(config.deviceId);
    this.sessionId = getSessionId();
    this.platform = config.platform ?? getPlatform();
    this.osVersion = getOSVersion();

    // Restore any persisted offline events
    this.loadPersistedQueue();

    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onBeforeUnload);
      window.addEventListener('online', this.onOnline);
    }
  }

  track(event: TrackEvent): void {
    if (this.destroyed) return;
    if (this.queue.length >= this.config.maxQueueSize) {
      if (this.config.debug) console.warn('[DataSneaker] Queue full, dropping event');
      return;
    }

    const payload: EventPayload = {
      event_id: generateUUID(),
      user_id: this.config.userId,
      device_id: this.deviceId,
      session_id: this.sessionId,
      event_type: event.eventType,
      timestamp: Date.now(),
      app_version: this.config.appVersion,
      platform: this.platform,
      os_version: this.osVersion,
      network_type: getNetworkType(),
      screen_name: event.screenName,
      properties: event.properties,
    };

    this.queue.push(payload);
    if (this.config.debug) console.log('[DataSneaker] Event queued:', payload.event_type);

    if (this.queue.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0);
    const url = `${this.config.serverUrl}/api/v1/track/batch`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.appKey) headers['X-App-Key'] = this.config.appKey;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(events),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (this.config.debug) console.error('[DataSneaker] Flush failed:', response.status);
        this.queue.unshift(...events);
        this.persistQueue();
      } else {
        this.clearPersistedQueue();
        if (this.config.debug) console.log('[DataSneaker] Flushed', events.length, 'events');
      }
    } catch (err) {
      if (this.config.debug) console.error('[DataSneaker] Flush error:', err);
      this.queue.unshift(...events);
      this.persistQueue();
    }
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onBeforeUnload);
      window.removeEventListener('online', this.onOnline);
    }
    this.sendBeacon();
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.sendBeacon();
    }
  };

  private onBeforeUnload = (): void => {
    this.persistQueue();
    this.sendBeacon();
  };

  private onOnline = (): void => {
    if (this.config.debug) console.log('[DataSneaker] Network online, flushing');
    this.flush();
  };

  private sendBeacon(): void {
    if (this.queue.length === 0) return;

    const url = `${this.config.serverUrl}/api/v1/track/batch`;
    const events = this.queue.splice(0);
    const body = JSON.stringify(events);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (!sent) {
        this.queue.unshift(...events);
        this.persistQueue();
      }
    } else {
      this.queue.unshift(...events);
      this.persistQueue();
      this.flush();
    }
  }

  private persistQueue(): void {
    if (this.queue.length === 0) return;
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // localStorage quota exceeded or unavailable — drop oldest events
      if (this.config.debug) console.warn('[DataSneaker] Failed to persist offline queue');
    }
  }

  private loadPersistedQueue(): void {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const events: EventPayload[] = JSON.parse(stored);
        if (Array.isArray(events) && events.length > 0) {
          this.queue.unshift(...events);
          if (this.config.debug) console.log('[DataSneaker] Restored', events.length, 'offline events');
        }
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch {
      // Parse error or localStorage unavailable
    }
  }

  private clearPersistedQueue(): void {
    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {
      // Ignore
    }
  }
}
