import { useContext, useEffect } from 'react';
import { DataSneakerContext } from './context';
import type { TrackEvent } from './types';

export function useTracker() {
  const client = useContext(DataSneakerContext);
  if (!client) {
    throw new Error('useTracker must be used within a DataSneakerProvider');
  }

  return {
    track: (event: TrackEvent) => client.track(event),
    flush: () => client.flush(),
    setUserId: (userId: string) => client.setUserId(userId),
  };
}

export function usePageView(screenName?: string) {
  const client = useContext(DataSneakerContext);
  if (!client) {
    throw new Error('usePageView must be used within a DataSneakerProvider');
  }

  useEffect(() => {
    const name = screenName ?? (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
    client.track({
      eventType: 'page_view',
      screenName: name,
    });
  }, [screenName, client]);
}
