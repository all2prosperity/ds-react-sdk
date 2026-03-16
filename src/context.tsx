import { createContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { DataSneakerClient } from './client';
import type { DataSneakerConfig } from './types';

export const DataSneakerContext = createContext<DataSneakerClient | null>(null);

interface DataSneakerProviderProps {
  config: DataSneakerConfig;
  children: ReactNode;
}

export function DataSneakerProvider({ config, children }: DataSneakerProviderProps) {
  const clientRef = useRef<DataSneakerClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new DataSneakerClient(config);
  }

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  return (
    <DataSneakerContext.Provider value={clientRef.current}>
      {children}
    </DataSneakerContext.Provider>
  );
}
