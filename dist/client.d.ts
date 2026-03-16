import type { DataSneakerConfig, TrackEvent } from './types';
export declare class DataSneakerClient {
    private config;
    private deviceId;
    private sessionId;
    private platform;
    private osVersion;
    private queue;
    private flushTimer;
    private destroyed;
    constructor(config: DataSneakerConfig);
    track(event: TrackEvent): void;
    flush(): Promise<void>;
    setUserId(userId: string): void;
    destroy(): void;
    private onVisibilityChange;
    private onBeforeUnload;
    private onOnline;
    private sendBeacon;
    private persistQueue;
    private loadPersistedQueue;
    private clearPersistedQueue;
}
