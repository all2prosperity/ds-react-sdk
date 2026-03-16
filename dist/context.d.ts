import type { ReactNode } from 'react';
import { DataSneakerClient } from './client';
import type { DataSneakerConfig } from './types';
export declare const DataSneakerContext: import("react").Context<DataSneakerClient | null>;
interface DataSneakerProviderProps {
    config: DataSneakerConfig;
    children: ReactNode;
}
export declare function DataSneakerProvider({ config, children }: DataSneakerProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
