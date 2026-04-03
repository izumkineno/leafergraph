export const RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY =
  "__LEAFERGRAPH_RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE__";

export const RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY =
  "__LEAFERGRAPH_RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE__";

export interface DemoStreamFrameBase {
  nodeId: string;
  kind: "scope" | "spectrum" | "perf";
  frameIndex: number;
  emittedAt: number;
}

export interface DemoScopeFrame extends DemoStreamFrameBase {
  kind: "scope";
  sampleRate: number;
  frameSize: number;
  min: number;
  max: number;
  peak: number;
  rms: number;
  elapsedMs: number;
  points: number[];
}

export interface DemoSpectrumFrame extends DemoStreamFrameBase {
  kind: "spectrum";
  sampleRate: number;
  frameSize: number;
  binCount: number;
  dominantFrequency: number;
  peakMagnitude: number;
  elapsedMs: number;
  bins: number[];
}

export interface DemoPerfFrame extends DemoStreamFrameBase {
  kind: "perf";
  sampleRate: number;
  frameSize: number;
  waveformPeak: number;
  waveformRms: number;
  dominantFrequency: number;
  generatorElapsedMs: number;
  fftElapsedMs: number;
  totalElapsedMs: number;
  framesPerSecond: number;
  publishedFramesPerSecond: number;
  history: number[];
}

export type DemoStreamFrame = DemoScopeFrame | DemoSpectrumFrame | DemoPerfFrame;

export interface DemoStreamFrameMessage {
  type: "stream.frame";
  frame: DemoStreamFrame;
}

export interface RuntimeBridgeNodeDemoAuthorityStreamBridge {
  publish(frame: DemoStreamFrame): void;
  clear(): void;
}

export interface DemoBrowserStreamStats {
  totalFrames: number;
  framesPerSecond: number;
  latestNodeCount: number;
  lastFrameAt: number | null;
  lastFrameKind: DemoStreamFrame["kind"] | null;
}

export interface RuntimeBridgeNodeDemoBrowserStreamStore {
  publish(frame: DemoStreamFrame): void;
  getLatestFrame(nodeId: string): DemoStreamFrame | undefined;
  subscribe(
    nodeId: string,
    listener: (frame: DemoStreamFrame) => void
  ): () => void;
  clear(): void;
  getStats(): DemoBrowserStreamStats;
  subscribeStats(listener: (stats: DemoBrowserStreamStats) => void): () => void;
}

export function isDemoStreamFrameMessage(
  message: unknown
): message is DemoStreamFrameMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as DemoStreamFrameMessage).type === "stream.frame"
  );
}

export function summarizeDemoStreamFrame(frame: DemoStreamFrame): string {
  switch (frame.kind) {
    case "scope":
      return `scope node=${frame.nodeId} frame=${frame.frameIndex} points=${frame.points.length} rms=${frame.rms.toFixed(3)} peak=${frame.peak.toFixed(3)}`;
    case "spectrum":
      return `spectrum node=${frame.nodeId} frame=${frame.frameIndex} bins=${frame.bins.length} dominant=${frame.dominantFrequency.toFixed(1)}Hz`;
    case "perf":
      return `perf node=${frame.nodeId} frame=${frame.frameIndex} total=${frame.totalElapsedMs.toFixed(2)}ms fps=${frame.framesPerSecond.toFixed(1)}`;
  }
}

