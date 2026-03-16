import type { TrackEvent } from './types';
export declare function useTracker(): {
    track: (event: TrackEvent) => void;
    flush: () => Promise<void>;
    setUserId: (userId: string) => void;
};
export declare function usePageView(screenName?: string): void;
