# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the React SDK (`@datasneaker/react`) for the DataSneaker event tracking system. It is a TypeScript library built with Rollup, distributed as both CJS and ESM bundles.

## Commands

```bash
# Install dependencies
npm install

# Build (outputs to dist/)
npm run build

# Watch mode
npm run dev
```

There are no tests in this package.

## Architecture

The SDK is structured around a single `DataSneakerClient` class with a thin React wrapper:

- **`src/client.ts`** — Core logic. Manages an in-memory event queue, periodic flush timer, and offline persistence. All event tracking flows through `track()` → queue → `flush()` → `POST /api/v1/track/batch`.
- **`src/context.tsx`** — `DataSneakerProvider` wraps the app. Creates a single `DataSneakerClient` instance via `useRef` (not state, to avoid re-renders), and destroys it on unmount.
- **`src/hooks.ts`** — `useTracker()` exposes `track`, `flush`, `setUserId`. `usePageView()` auto-tracks a `page_view` event on mount/screenName change.
- **`src/utils.ts`** — Stateless helpers: UUID generation, device/session ID persistence (localStorage/sessionStorage), platform/OS/network detection.
- **`src/types.ts`** — All exported TypeScript interfaces.

### Reliability mechanisms in `DataSneakerClient`

| Mechanism | How |
|-----------|-----|
| Offline cache | `localStorage` key `ds_offline_queue`; restored on next init |
| Page unload | `beforeunload` → persist queue; `visibilitychange hidden` → `sendBeacon` |
| Network restore | `window online` event → `flush()` |
| Batch trigger | Auto-flush when queue reaches `maxBatchSize` (default 50) |
| Periodic flush | `setInterval` every `flushInterval` ms (default 5000) |

### Build output

Rollup produces three files in `dist/`:
- `index.cjs.js` — CommonJS
- `index.esm.js` — ES module
- `index.d.ts` — TypeScript declarations

`react` and `react/jsx-runtime` are externalized (peer dependencies).
