export interface DataSneakerConfig {
  serverUrl: string;
  appKey?: string;
  userId: string;
  deviceId?: string;
  appVersion?: string;
  platform?: string;
  flushInterval?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  autoTrackPageView?: boolean;
  debug?: boolean;
}

export interface TrackEvent {
  eventType: string;
  screenName?: string;
  properties?: Record<string, unknown>;
}

export interface EventPayload {
  event_id: string;
  user_id: string;
  device_id: string;
  session_id: string;
  event_type: string;
  timestamp: number;
  app_version?: string;
  platform?: string;
  os_version?: string;
  network_type?: string;
  screen_name?: string;
  properties?: Record<string, unknown>;
}

export interface BatchResponse {
  status: string;
  message: string;
  data: {
    processed: number;
    failed: number;
    processed_events: string[];
    failed_events: string[];
  };
}
