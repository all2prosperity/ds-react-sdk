'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('react');

const DS_DEVICE_ID_KEY = 'ds_device_id';
const DS_SESSION_ID_KEY = 'ds_session_id';
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
function getDeviceId(configured) {
    if (configured)
        return configured;
    try {
        const stored = localStorage.getItem(DS_DEVICE_ID_KEY);
        if (stored)
            return stored;
        const id = generateUUID();
        localStorage.setItem(DS_DEVICE_ID_KEY, id);
        return id;
    }
    catch (_a) {
        return generateUUID();
    }
}
function getSessionId() {
    try {
        const stored = sessionStorage.getItem(DS_SESSION_ID_KEY);
        if (stored)
            return stored;
        const id = generateUUID();
        sessionStorage.setItem(DS_SESSION_ID_KEY, id);
        return id;
    }
    catch (_a) {
        return generateUUID();
    }
}
function getPlatform() {
    if (typeof navigator === 'undefined')
        return 'unknown';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android'))
        return 'android';
    if (ua.includes('iphone') || ua.includes('ipad'))
        return 'ios';
    return 'web';
}
function getOSVersion() {
    if (typeof navigator === 'undefined')
        return 'unknown';
    const ua = navigator.userAgent;
    const match = ua.match(/Windows NT ([\d.]+)/) ||
        ua.match(/Mac OS X ([\d._]+)/) ||
        ua.match(/Android ([\d.]+)/) ||
        ua.match(/OS ([\d_]+) like Mac OS X/);
    if (match)
        return match[1].replace(/_/g, '.');
    return 'unknown';
}
function getNetworkType() {
    var _a;
    if (typeof navigator === 'undefined')
        return 'unknown';
    const conn = navigator.connection;
    return (_a = conn === null || conn === void 0 ? void 0 : conn.effectiveType) !== null && _a !== void 0 ? _a : 'unknown';
}

const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const REQUEST_TIMEOUT = 10000;
const OFFLINE_QUEUE_KEY = 'ds_offline_queue';
class DataSneakerClient {
    constructor(config) {
        var _a, _b, _c, _d, _e;
        this.queue = [];
        this.flushTimer = null;
        this.destroyed = false;
        this.onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                this.sendBeacon();
            }
        };
        this.onBeforeUnload = () => {
            this.persistQueue();
            this.sendBeacon();
        };
        this.onOnline = () => {
            if (this.config.debug)
                console.log('[DataSneaker] Network online, flushing');
            this.flush();
        };
        this.config = {
            ...config,
            flushInterval: (_a = config.flushInterval) !== null && _a !== void 0 ? _a : DEFAULT_FLUSH_INTERVAL,
            maxBatchSize: (_b = config.maxBatchSize) !== null && _b !== void 0 ? _b : DEFAULT_MAX_BATCH_SIZE,
            maxQueueSize: (_c = config.maxQueueSize) !== null && _c !== void 0 ? _c : DEFAULT_MAX_QUEUE_SIZE,
            debug: (_d = config.debug) !== null && _d !== void 0 ? _d : false,
        };
        this.deviceId = getDeviceId(config.deviceId);
        this.sessionId = getSessionId();
        this.platform = (_e = config.platform) !== null && _e !== void 0 ? _e : getPlatform();
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
    track(event) {
        if (this.destroyed)
            return;
        if (this.queue.length >= this.config.maxQueueSize) {
            if (this.config.debug)
                console.warn('[DataSneaker] Queue full, dropping event');
            return;
        }
        const payload = {
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
        if (this.config.debug)
            console.log('[DataSneaker] Event queued:', payload.event_type);
        if (this.queue.length >= this.config.maxBatchSize) {
            this.flush();
        }
    }
    async flush() {
        if (this.queue.length === 0)
            return;
        const events = this.queue.splice(0);
        const url = `${this.config.serverUrl}/api/v1/track/batch`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.appKey)
            headers['X-App-Key'] = this.config.appKey;
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
                if (this.config.debug)
                    console.error('[DataSneaker] Flush failed:', response.status);
                this.queue.unshift(...events);
                this.persistQueue();
            }
            else {
                this.clearPersistedQueue();
                if (this.config.debug)
                    console.log('[DataSneaker] Flushed', events.length, 'events');
            }
        }
        catch (err) {
            if (this.config.debug)
                console.error('[DataSneaker] Flush error:', err);
            this.queue.unshift(...events);
            this.persistQueue();
        }
    }
    setUserId(userId) {
        this.config.userId = userId;
    }
    destroy() {
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
    sendBeacon() {
        if (this.queue.length === 0)
            return;
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
        }
        else {
            this.queue.unshift(...events);
            this.persistQueue();
            this.flush();
        }
    }
    persistQueue() {
        if (this.queue.length === 0)
            return;
        try {
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
        }
        catch (_a) {
            // localStorage quota exceeded or unavailable — drop oldest events
            if (this.config.debug)
                console.warn('[DataSneaker] Failed to persist offline queue');
        }
    }
    loadPersistedQueue() {
        try {
            const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
            if (stored) {
                const events = JSON.parse(stored);
                if (Array.isArray(events) && events.length > 0) {
                    this.queue.unshift(...events);
                    if (this.config.debug)
                        console.log('[DataSneaker] Restored', events.length, 'offline events');
                }
                localStorage.removeItem(OFFLINE_QUEUE_KEY);
            }
        }
        catch (_a) {
            // Parse error or localStorage unavailable
        }
    }
    clearPersistedQueue() {
        try {
            localStorage.removeItem(OFFLINE_QUEUE_KEY);
        }
        catch (_a) {
            // Ignore
        }
    }
}

const DataSneakerContext = react.createContext(null);
function DataSneakerProvider({ config, children }) {
    const clientRef = react.useRef(null);
    if (!clientRef.current) {
        clientRef.current = new DataSneakerClient(config);
    }
    react.useEffect(() => {
        return () => {
            var _a;
            (_a = clientRef.current) === null || _a === void 0 ? void 0 : _a.destroy();
            clientRef.current = null;
        };
    }, []);
    return (jsxRuntime.jsx(DataSneakerContext.Provider, { value: clientRef.current, children: children }));
}

function useTracker() {
    const client = react.useContext(DataSneakerContext);
    if (!client) {
        throw new Error('useTracker must be used within a DataSneakerProvider');
    }
    return {
        track: (event) => client.track(event),
        flush: () => client.flush(),
        setUserId: (userId) => client.setUserId(userId),
    };
}
function usePageView(screenName) {
    const client = react.useContext(DataSneakerContext);
    if (!client) {
        throw new Error('usePageView must be used within a DataSneakerProvider');
    }
    react.useEffect(() => {
        const name = screenName !== null && screenName !== void 0 ? screenName : (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
        client.track({
            eventType: 'page_view',
            screenName: name,
        });
    }, [screenName, client]);
}

exports.DataSneakerClient = DataSneakerClient;
exports.DataSneakerContext = DataSneakerContext;
exports.DataSneakerProvider = DataSneakerProvider;
exports.usePageView = usePageView;
exports.useTracker = useTracker;
//# sourceMappingURL=index.cjs.js.map
