import type {
  RuntimeBridgeBlueprintCatalogEntry,
  RuntimeBridgeCatalogEntry,
  RuntimeBridgeComponentCatalogEntry,
  RuntimeBridgeNodeCatalogEntry
} from "@leafergraph/runtime-bridge";
import type { NodeDefinition } from "@leafergraph/node";
import {
  DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID,
  DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
  DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID,
  DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID,
  DEMO_PERF_METER_NODE_ENTRY_ID,
  DEMO_PERF_READOUT_COMPONENT_ENTRY_ID,
  DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
  DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
  DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
  DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
  DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID
} from "../shared/catalog";
import {
  RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY,
  RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY
} from "../shared/stream";
import { createRuntimeBridgeNodeDemoDocument } from "../shared/document";
import type { DemoFileSystemArtifactStore } from "./artifact_store";

const DEMO_FREQUENCY_WIDGET_TYPES = {
  scopePlot: "demo/scope-plot",
  spectrumBars: "demo/spectrum-bars",
  perfReadout: "demo/perf-readout"
} as const;

const DEMO_FREQUENCY_BLUEPRINT_NODE_IDS = {
  onPlay: "frequency-on-play",
  timer: "frequency-timer",
  generator: "frequency-generator",
  analyzer: "frequency-analyzer",
  scope: "frequency-scope",
  spectrum: "frequency-spectrum",
  perf: "frequency-perf"
} as const;

export async function createFrequencyCatalogEntries(
  artifactStore: DemoFileSystemArtifactStore
): Promise<RuntimeBridgeCatalogEntry[]> {
  const scopePlotArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createScopePlotWidgetArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-scope-plot.browser.mjs"
  });
  const spectrumBarsArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createSpectrumBarsWidgetArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-spectrum-bars.browser.mjs"
  });
  const perfReadoutArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createPerfReadoutWidgetArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-perf-readout.browser.mjs"
  });

  const signalGeneratorAuthorityArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createSignalGeneratorAuthorityArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-signal-generator.authority.mjs"
  });
  const signalGeneratorBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      serializeModuleExport([createSignalGeneratorBrowserDefinition()])
    ),
    contentType: "text/javascript",
    suggestedName: "demo-signal-generator.browser.mjs"
  });

  const fftAnalyzerAuthorityArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createFftAnalyzerAuthorityArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-fft-analyzer.authority.mjs"
  });
  const fftAnalyzerBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      serializeModuleExport([createFftAnalyzerBrowserDefinition()])
    ),
    contentType: "text/javascript",
    suggestedName: "demo-fft-analyzer.browser.mjs"
  });

  const scopeViewAuthorityArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createScopeViewAuthorityArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-scope-view.authority.mjs"
  });
  const scopeViewBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      serializeModuleExport([createScopeViewBrowserDefinition()])
    ),
    contentType: "text/javascript",
    suggestedName: "demo-scope-view.browser.mjs"
  });

  const spectrumViewAuthorityArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createSpectrumViewAuthorityArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-spectrum-view.authority.mjs"
  });
  const spectrumViewBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      serializeModuleExport([createSpectrumViewBrowserDefinition()])
    ),
    contentType: "text/javascript",
    suggestedName: "demo-spectrum-view.browser.mjs"
  });

  const perfMeterAuthorityArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(createPerfMeterAuthorityArtifactSource()),
    contentType: "text/javascript",
    suggestedName: "demo-perf-meter.authority.mjs"
  });
  const perfMeterBrowserArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      serializeModuleExport([createPerfMeterBrowserDefinition()])
    ),
    contentType: "text/javascript",
    suggestedName: "demo-perf-meter.browser.mjs"
  });

  const frequencyLabArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      JSON.stringify(createFrequencyLabBlueprintDocument(), null, 2)
    ),
    contentType: "application/json",
    suggestedName: "demo-frequency-lab.blueprint.json"
  });
  const frequencyStressArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      JSON.stringify(createFrequencyStressBlueprintDocument(), null, 2)
    ),
    contentType: "application/json",
    suggestedName: "demo-frequency-stress.blueprint.json"
  });
  const frequencyExtremeArtifactRef = await artifactStore.writeArtifact({
    bytes: new TextEncoder().encode(
      JSON.stringify(createFrequencyExtremeBlueprintDocument(), null, 2)
    ),
    contentType: "application/json",
    suggestedName: "demo-frequency-extreme.blueprint.json"
  });

  const componentEntries: RuntimeBridgeComponentCatalogEntry[] = [
    {
      entryId: DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
      entryKind: "component-entry",
      name: "高频示波图组件",
      description: "节点内复用 Path 的实时波形绘图组件。",
      widgetTypes: [DEMO_FREQUENCY_WIDGET_TYPES.scopePlot],
      browserArtifactRef: scopePlotArtifactRef
    },
    {
      entryId: DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
      entryKind: "component-entry",
      name: "频谱柱状组件",
      description: "节点内复用 Rect 的实时频谱条组件。",
      widgetTypes: [DEMO_FREQUENCY_WIDGET_TYPES.spectrumBars],
      browserArtifactRef: spectrumBarsArtifactRef
    },
    {
      entryId: DEMO_PERF_READOUT_COMPONENT_ENTRY_ID,
      entryKind: "component-entry",
      name: "性能读数组件",
      description: "显示 authority 计算耗时、帧率和小型 sparkline。",
      widgetTypes: [DEMO_FREQUENCY_WIDGET_TYPES.perfReadout],
      browserArtifactRef: perfReadoutArtifactRef
    }
  ];

  const nodeEntries: RuntimeBridgeNodeCatalogEntry[] = [
    {
      entryId: DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "信号发生器",
      description: "Authority 侧高频生成波形样本帧。",
      nodeTypes: ["demo/signal-generator"],
      componentEntryIds: [],
      authorityArtifactRef: signalGeneratorAuthorityArtifactRef,
      browserArtifactRef: signalGeneratorBrowserArtifactRef
    },
    {
      entryId: DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "频谱分析器",
      description: "Authority 侧 radix-2 FFT 分析节点。",
      nodeTypes: ["demo/fft-analyzer"],
      componentEntryIds: [],
      authorityArtifactRef: fftAnalyzerAuthorityArtifactRef,
      browserArtifactRef: fftAnalyzerBrowserArtifactRef
    },
    {
      entryId: DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "波形监视器",
      description: "把 authority 波形流下采样后推送到浏览器 Widget。",
      nodeTypes: ["demo/scope-view"],
      componentEntryIds: [DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID],
      authorityArtifactRef: scopeViewAuthorityArtifactRef,
      browserArtifactRef: scopeViewBrowserArtifactRef
    },
    {
      entryId: DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "频谱监视器",
      description: "把 authority 频谱流推送到浏览器柱状 Widget。",
      nodeTypes: ["demo/spectrum-view"],
      componentEntryIds: [DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID],
      authorityArtifactRef: spectrumViewAuthorityArtifactRef,
      browserArtifactRef: spectrumViewBrowserArtifactRef
    },
    {
      entryId: DEMO_PERF_METER_NODE_ENTRY_ID,
      entryKind: "node-entry",
      name: "性能监视器",
      description: "汇总生成/FFT 耗时与帧率并推送到浏览器读数组件。",
      nodeTypes: ["demo/perf-meter"],
      componentEntryIds: [DEMO_PERF_READOUT_COMPONENT_ENTRY_ID],
      authorityArtifactRef: perfMeterAuthorityArtifactRef,
      browserArtifactRef: perfMeterBrowserArtifactRef
    }
  ];

  const blueprintEntries: RuntimeBridgeBlueprintCatalogEntry[] = [
    {
      entryId: DEMO_FREQUENCY_LAB_BLUEPRINT_ENTRY_ID,
      entryKind: "blueprint-entry",
      name: "频谱实验室",
      description: "33ms 定时驱动的标准频谱实验图。",
      nodeEntryIds: [
        DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
        DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
        DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
        DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID,
        DEMO_PERF_METER_NODE_ENTRY_ID
      ],
      componentEntryIds: [
        DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
        DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
        DEMO_PERF_READOUT_COMPONENT_ENTRY_ID
      ],
      documentArtifactRef: frequencyLabArtifactRef
    },
    {
      entryId: DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID,
      entryKind: "blueprint-entry",
      name: "频谱压力实验",
      description: "16ms 定时 + 更大帧长的高压力实验图。",
      nodeEntryIds: [
        DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
        DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
        DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
        DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID,
        DEMO_PERF_METER_NODE_ENTRY_ID
      ],
      componentEntryIds: [
        DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
        DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
        DEMO_PERF_READOUT_COMPONENT_ENTRY_ID
      ],
      documentArtifactRef: frequencyStressArtifactRef
    },
    {
      entryId: DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID,
      entryKind: "blueprint-entry",
      name: "频谱极限压测",
      description: "8ms 定时 + 双分析链路的极限压力实验图。",
      nodeEntryIds: [
        DEMO_SIGNAL_GENERATOR_NODE_ENTRY_ID,
        DEMO_FFT_ANALYZER_NODE_ENTRY_ID,
        DEMO_SCOPE_VIEW_NODE_ENTRY_ID,
        DEMO_SPECTRUM_VIEW_NODE_ENTRY_ID,
        DEMO_PERF_METER_NODE_ENTRY_ID
      ],
      componentEntryIds: [
        DEMO_SCOPE_PLOT_COMPONENT_ENTRY_ID,
        DEMO_SPECTRUM_BARS_COMPONENT_ENTRY_ID,
        DEMO_PERF_READOUT_COMPONENT_ENTRY_ID
      ],
      documentArtifactRef: frequencyExtremeArtifactRef
    }
  ];

  return [...componentEntries, ...nodeEntries, ...blueprintEntries];
}

function serializeModuleExport(value: unknown): string {
  return `export default ${JSON.stringify(value, null, 2)};\n`;
}

function createSignalGeneratorBrowserDefinition(): NodeDefinition {
  return {
    type: "demo/signal-generator",
    title: "Signal Generator",
    category: "demo/frequency",
    description: "Authority 侧高频波形信号发生器。",
    inputs: [{ name: "trigger", type: "event" }],
    outputs: [{ name: "frame", type: "event" }],
    properties: [
      { name: "sampleRate", type: "number", default: 8000 },
      { name: "frameSize", type: "number", default: 1024 },
      { name: "frequency", type: "number", default: 440 },
      { name: "harmonics", type: "number", default: 3 },
      { name: "noise", type: "number", default: 0.04 },
      { name: "amplitude", type: "number", default: 0.9 }
    ],
    widgets: [
      {
        type: "select",
        name: "sampleRate",
        value: "8000",
        options: { label: "Sample Rate", items: ["4000", "8000", "16000"] }
      },
      {
        type: "select",
        name: "frameSize",
        value: "1024",
        options: { label: "Frame Size", items: ["256", "512", "1024", "2048"] }
      },
      {
        type: "input",
        name: "frequency",
        value: "440",
        options: { label: "Frequency", placeholder: "440" }
      },
      {
        type: "select",
        name: "harmonics",
        value: "3",
        options: { label: "Harmonics", items: ["1", "3", "5", "7"] }
      },
      {
        type: "slider",
        name: "amplitude",
        value: 0.9,
        options: { label: "Amplitude", min: 0.1, max: 1, step: 0.05 }
      },
      {
        type: "slider",
        name: "noise",
        value: 0.04,
        options: { label: "Noise", min: 0, max: 0.2, step: 0.01 }
      }
    ],
    size: [308, 440]
  };
}

function createFftAnalyzerBrowserDefinition(): NodeDefinition {
  return {
    type: "demo/fft-analyzer",
    title: "FFT Analyzer",
    category: "demo/frequency",
    description: "Authority 侧 radix-2 FFT 频谱分析节点。",
    inputs: [{ name: "frame", type: "event" }],
    outputs: [{ name: "spectrum", type: "event" }],
    properties: [{ name: "binCount", type: "number", default: 96 }],
    widgets: [
      {
        type: "select",
        name: "binCount",
        value: "96",
        options: { label: "Bin Count", items: ["96", "128"] }
      }
    ],
    size: [260, 160]
  };
}

function createScopeViewBrowserDefinition(): NodeDefinition {
  return {
    type: "demo/scope-view",
    title: "Scope View",
    category: "demo/frequency",
    description: "订阅 authority 波形流并在节点内实时绘图。",
    inputs: [{ name: "frame", type: "event" }],
    widgets: [
      {
        type: DEMO_FREQUENCY_WIDGET_TYPES.scopePlot,
        name: "scope",
        value: "scope"
      }
    ],
    size: [380, 264]
  };
}

function createSpectrumViewBrowserDefinition(): NodeDefinition {
  return {
    type: "demo/spectrum-view",
    title: "Spectrum View",
    category: "demo/frequency",
    description: "订阅 authority 频谱流并在节点内实时绘图。",
    inputs: [{ name: "spectrum", type: "event" }],
    widgets: [
      {
        type: DEMO_FREQUENCY_WIDGET_TYPES.spectrumBars,
        name: "spectrum",
        value: "spectrum"
      }
    ],
    size: [380, 264]
  };
}

function createPerfMeterBrowserDefinition(): NodeDefinition {
  return {
    type: "demo/perf-meter",
    title: "Perf Meter",
    category: "demo/frequency",
    description: "显示 authority 侧生成和 FFT 耗时、帧率与 sparkline。",
    inputs: [
      { name: "waveform", type: "event" },
      { name: "spectrum", type: "event" }
    ],
    widgets: [
      {
        type: DEMO_FREQUENCY_WIDGET_TYPES.perfReadout,
        name: "perf",
        value: "perf"
      }
    ],
    size: [336, 220]
  };
}

function createFrequencyLabBlueprintDocument() {
  const document = createRuntimeBridgeNodeDemoDocument();
  document.documentId = "runtime-bridge-frequency-lab";
  document.revision = 1;
  document.nodes = [
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.onPlay,
      type: "system/on-play",
      title: "Frequency Start",
      layout: { x: 70, y: 234 }
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.timer,
      type: "system/timer",
      title: "Frame Clock",
      layout: { x: 316, y: 176, width: 230, height: 188 },
      properties: { intervalMs: 33, immediate: true, runCount: 0, status: "READY" },
      widgets: [
        {
          type: "input",
          name: "intervalMs",
          value: 33,
          options: { label: "Interval (ms)", placeholder: "33" }
        },
        {
          type: "toggle",
          name: "immediate",
          value: true,
          options: { label: "Immediate", onText: "ON", offText: "WAIT" }
        }
      ]
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator,
      type: "demo/signal-generator",
      title: "Signal Generator",
      layout: { x: 620, y: 70, width: 308, height: 440 },
      widgets: createSignalGeneratorBrowserDefinition().widgets,
      properties: {
        sampleRate: 8000,
        frameSize: 1024,
        frequency: 440,
        harmonics: 3,
        noise: 0.04,
        amplitude: 0.9
      }
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.scope,
      type: "demo/scope-view",
      title: "Scope View",
      layout: { x: 966, y: 64, width: 380, height: 264 },
      widgets: createScopeViewBrowserDefinition().widgets
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer,
      type: "demo/fft-analyzer",
      title: "FFT Analyzer",
      layout: { x: 966, y: 368, width: 260, height: 160 },
      widgets: createFftAnalyzerBrowserDefinition().widgets,
      properties: { binCount: 96 }
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.spectrum,
      type: "demo/spectrum-view",
      title: "Spectrum View",
      layout: { x: 1268, y: 352, width: 380, height: 264 },
      widgets: createSpectrumViewBrowserDefinition().widgets
    },
    {
      id: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.perf,
      type: "demo/perf-meter",
      title: "Perf Meter",
      layout: { x: 1360, y: 64, width: 336, height: 220 },
      widgets: createPerfMeterBrowserDefinition().widgets
    }
  ];
  document.links = [
    {
      id: "frequency-lab:on-play->timer",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.onPlay, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.timer, slot: 0 }
    },
    {
      id: "frequency-lab:timer->generator",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.timer, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 }
    },
    {
      id: "frequency-lab:generator->scope",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.scope, slot: 0 }
    },
    {
      id: "frequency-lab:generator->analyzer",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer, slot: 0 }
    },
    {
      id: "frequency-lab:generator->perf",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.perf, slot: 0 }
    },
    {
      id: "frequency-lab:analyzer->spectrum",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.spectrum, slot: 0 }
    },
    {
      id: "frequency-lab:analyzer->perf",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer, slot: 0 },
      target: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.perf, slot: 1 }
    }
  ];
  return document;
}

function createFrequencyStressBlueprintDocument() {
  const document = createFrequencyLabBlueprintDocument();
  document.documentId = "runtime-bridge-frequency-stress";
  document.revision = 1;
  const timerNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.timer
  );
  if (timerNode) {
    timerNode.title = "Stress Clock";
    timerNode.properties = { intervalMs: 16, immediate: true, runCount: 0, status: "READY" };
    timerNode.widgets = [
      {
        type: "input",
        name: "intervalMs",
        value: 16,
        options: { label: "Interval (ms)", placeholder: "16" }
      },
      {
        type: "toggle",
        name: "immediate",
        value: true,
        options: { label: "Immediate", onText: "ON", offText: "WAIT" }
      }
    ];
  }

  const generatorNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator
  );
  if (generatorNode) {
    generatorNode.title = "Signal Generator Stress";
    generatorNode.properties = {
      sampleRate: 16000,
      frameSize: 2048,
      frequency: 660,
      harmonics: 5,
      noise: 0.06,
      amplitude: 0.95
    };
    generatorNode.widgets = [
      { type: "select", name: "sampleRate", value: "16000", options: { label: "Sample Rate", items: ["4000", "8000", "16000"] } },
      { type: "select", name: "frameSize", value: "2048", options: { label: "Frame Size", items: ["256", "512", "1024", "2048"] } },
      { type: "input", name: "frequency", value: "660", options: { label: "Frequency", placeholder: "660" } },
      { type: "select", name: "harmonics", value: "5", options: { label: "Harmonics", items: ["1", "3", "5", "7"] } },
      { type: "slider", name: "amplitude", value: 0.95, options: { label: "Amplitude", min: 0.1, max: 1, step: 0.05 } },
      { type: "slider", name: "noise", value: 0.06, options: { label: "Noise", min: 0, max: 0.2, step: 0.01 } }
    ];
  }

  const analyzerNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer
  );
  if (analyzerNode) {
    analyzerNode.title = "FFT Analyzer Stress";
    analyzerNode.properties = { binCount: 128 };
    analyzerNode.widgets = [
      {
        type: "select",
        name: "binCount",
        value: "128",
        options: { label: "Bin Count", items: ["96", "128"] }
      }
    ];
  }

  return document;
}

function createFrequencyExtremeBlueprintDocument() {
  const document = createFrequencyStressBlueprintDocument();
  document.documentId = "runtime-bridge-frequency-extreme";
  document.revision = 1;

  const timerNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.timer
  );
  if (timerNode) {
    timerNode.title = "Extreme Clock";
    timerNode.properties = { intervalMs: 8, immediate: true, runCount: 0, status: "READY" };
    timerNode.widgets = [
      {
        type: "input",
        name: "intervalMs",
        value: 8,
        options: { label: "Interval (ms)", placeholder: "8" }
      },
      {
        type: "toggle",
        name: "immediate",
        value: true,
        options: { label: "Immediate", onText: "ON", offText: "WAIT" }
      }
    ];
  }

  const generatorNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator
  );
  if (generatorNode) {
    generatorNode.title = "Signal Generator Extreme";
    generatorNode.properties = {
      sampleRate: 16000,
      frameSize: 2048,
      frequency: 880,
      harmonics: 7,
      noise: 0.08,
      amplitude: 1
    };
    generatorNode.widgets = [
      { type: "select", name: "sampleRate", value: "16000", options: { label: "Sample Rate", items: ["4000", "8000", "16000"] } },
      { type: "select", name: "frameSize", value: "2048", options: { label: "Frame Size", items: ["256", "512", "1024", "2048"] } },
      { type: "input", name: "frequency", value: "880", options: { label: "Frequency", placeholder: "880" } },
      { type: "select", name: "harmonics", value: "7", options: { label: "Harmonics", items: ["1", "3", "5", "7"] } },
      { type: "slider", name: "amplitude", value: 1, options: { label: "Amplitude", min: 0.1, max: 1, step: 0.05 } },
      { type: "slider", name: "noise", value: 0.08, options: { label: "Noise", min: 0, max: 0.2, step: 0.01 } }
    ];
  }

  const analyzerNode = document.nodes.find(
    (node) => node.id === DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.analyzer
  );
  if (analyzerNode) {
    analyzerNode.title = "FFT Analyzer Extreme";
    analyzerNode.properties = { binCount: 128 };
    analyzerNode.widgets = [
      {
        type: "select",
        name: "binCount",
        value: "128",
        options: { label: "Bin Count", items: ["96", "128"] }
      }
    ];
  }

  document.nodes.push(
    {
      id: "frequency-scope-b",
      type: "demo/scope-view",
      title: "Scope View B",
      layout: { x: 966, y: 648, width: 380, height: 264 },
      widgets: createScopeViewBrowserDefinition().widgets
    },
    {
      id: "frequency-analyzer-b",
      type: "demo/fft-analyzer",
      title: "FFT Analyzer B",
      layout: { x: 1368, y: 648, width: 260, height: 160 },
      widgets: createFftAnalyzerBrowserDefinition().widgets,
      properties: { binCount: 128 }
    },
    {
      id: "frequency-spectrum-b",
      type: "demo/spectrum-view",
      title: "Spectrum View B",
      layout: { x: 1688, y: 632, width: 380, height: 264 },
      widgets: createSpectrumViewBrowserDefinition().widgets
    },
    {
      id: "frequency-perf-b",
      type: "demo/perf-meter",
      title: "Perf Meter B",
      layout: { x: 1728, y: 320, width: 336, height: 220 },
      widgets: createPerfMeterBrowserDefinition().widgets
    }
  );

  document.links.push(
    {
      id: "frequency-extreme:generator->scope-b",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: "frequency-scope-b", slot: 0 }
    },
    {
      id: "frequency-extreme:generator->analyzer-b",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: "frequency-analyzer-b", slot: 0 }
    },
    {
      id: "frequency-extreme:generator->perf-b",
      source: { nodeId: DEMO_FREQUENCY_BLUEPRINT_NODE_IDS.generator, slot: 0 },
      target: { nodeId: "frequency-perf-b", slot: 0 }
    },
    {
      id: "frequency-extreme:analyzer-b->spectrum-b",
      source: { nodeId: "frequency-analyzer-b", slot: 0 },
      target: { nodeId: "frequency-spectrum-b", slot: 0 }
    },
    {
      id: "frequency-extreme:analyzer-b->perf-b",
      source: { nodeId: "frequency-analyzer-b", slot: 0 },
      target: { nodeId: "frequency-perf-b", slot: 1 }
    }
  );

  return document;
}

function createScopePlotWidgetArtifactSource(): string {
  return `
const STREAM_STORE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY
  )};
const PADDING_X = 12;
const PADDING_Y = 18;

function getStore() {
  return globalThis[STREAM_STORE_KEY] || null;
}

function createWavePath(points, x, y, width, height) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const step = points.length <= 1 ? 0 : width / (points.length - 1);
  const centerY = y + height / 2;
  const amplitude = height / 2;
  let path = "";
  for (let index = 0; index < points.length; index += 1) {
    const pointX = x + step * index;
    const pointY = centerY - Math.max(-1, Math.min(1, Number(points[index]) || 0)) * amplitude;
    path += index === 0 ? \`M \${pointX} \${pointY}\` : \` L \${pointX} \${pointY}\`;
  }
  return path;
}

function updateRuntime(runtime, context, frame) {
  if (!frame || frame.kind !== "scope") {
    return;
  }

  const { bounds } = context;
  const plotX = bounds.x + PADDING_X;
  const plotY = bounds.y + 42;
  const plotWidth = Math.max(24, bounds.width - PADDING_X * 2);
  const plotHeight = Math.max(32, bounds.height - 68);
  runtime.baseline.path = \`M \${plotX} \${plotY + plotHeight / 2} L \${plotX + plotWidth} \${plotY + plotHeight / 2}\`;
  runtime.wave.path = createWavePath(frame.points, plotX, plotY, plotWidth, plotHeight);
  runtime.title.text = \`Scope  \${frame.sampleRate} Hz / \${frame.frameSize}\`;
  runtime.subtitle.text = \`RMS \${frame.rms.toFixed(3)}  Peak \${frame.peak.toFixed(3)}  \${frame.elapsedMs.toFixed(2)} ms\`;
  context.requestRender();
}

export default [
  {
    type: ${JSON.stringify(DEMO_FREQUENCY_WIDGET_TYPES.scopePlot)},
    title: "Scope Plot",
    renderer(context) {
      const { ui, group, bounds } = context;
      const surface = new ui.Rect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        cornerRadius: 18,
        fill: "#0f172a",
        stroke: "#1e293b",
        strokeWidth: 1.2,
        opacity: 0.98
      });
      const baseline = new ui.Path({
        path: "",
        stroke: "#1e3a5f",
        strokeWidth: 1,
        opacity: 0.9,
        hittable: false
      });
      const wave = new ui.Path({
        path: "",
        stroke: "#38bdf8",
        strokeWidth: 1.8,
        strokeCap: "round",
        strokeJoin: "round",
        fill: "transparent",
        hittable: false
      });
      const title = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 10,
        text: "Scope  WAITING",
        fill: "#e2e8f0",
        fontSize: 12,
        fontWeight: "700"
      });
      const subtitle = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + Math.max(46, bounds.height - 22),
        width: Math.max(24, bounds.width - 24),
        text: "等待 authority 流帧",
        fill: "#94a3b8",
        fontSize: 11
      });

      group.addMany(surface, baseline, wave, title, subtitle);

      const runtime = {
        baseline,
        wave,
        title,
        subtitle,
        unsubscribe: null
      };

      const store = getStore();
      const latestFrame = store?.getLatestFrame(context.node.id);
      if (latestFrame) {
        updateRuntime(runtime, context, latestFrame);
      }

      runtime.unsubscribe = store?.subscribe(context.node.id, (frame) => {
        updateRuntime(runtime, context, frame);
      }) || null;

      return {
        update() {
          const nextFrame = store?.getLatestFrame(context.node.id);
          if (nextFrame) {
            updateRuntime(runtime, context, nextFrame);
          }
        },
        destroy() {
          runtime.unsubscribe?.();
          group.removeAll();
        }
      };
    }
  }
];
`.trim();
}

function createSpectrumBarsWidgetArtifactSource(): string {
  return `
const STREAM_STORE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY
  )};
const MAX_BARS = 128;

function getStore() {
  return globalThis[STREAM_STORE_KEY] || null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function updateRuntime(runtime, context, frame) {
  if (!frame || frame.kind !== "spectrum") {
    return;
  }

  const { bounds } = context;
  const plotX = bounds.x + 12;
  const plotY = bounds.y + 42;
  const plotWidth = Math.max(24, bounds.width - 24);
  const plotHeight = Math.max(30, bounds.height - 68);
  const activeBars = Math.max(1, Math.min(MAX_BARS, frame.bins.length));
  const barWidth = plotWidth / activeBars;

  for (let index = 0; index < runtime.bars.length; index += 1) {
    const bar = runtime.bars[index];
    if (index >= activeBars) {
      bar.visible = false;
      continue;
    }

    const magnitude = clamp01(Number(frame.bins[index]) || 0);
    const height = Math.max(2, magnitude * plotHeight);
    bar.visible = true;
    bar.x = plotX + index * barWidth + 0.5;
    bar.y = plotY + (plotHeight - height);
    bar.width = Math.max(1, barWidth - 1.5);
    bar.height = height;
    bar.fill = magnitude > 0.82 ? "#f97316" : magnitude > 0.58 ? "#facc15" : "#38bdf8";
  }

  runtime.title.text = \`Spectrum  \${frame.binCount} bins\`;
  runtime.subtitle.text = \`Peak \${frame.peakMagnitude.toFixed(3)}  Dom \${frame.dominantFrequency.toFixed(1)} Hz  \${frame.elapsedMs.toFixed(2)} ms\`;
  context.requestRender();
}

export default [
  {
    type: ${JSON.stringify(DEMO_FREQUENCY_WIDGET_TYPES.spectrumBars)},
    title: "Spectrum Bars",
    renderer(context) {
      const { ui, group, bounds } = context;
      const surface = new ui.Rect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        cornerRadius: 18,
        fill: "#111827",
        stroke: "#1f2937",
        strokeWidth: 1.2,
        opacity: 0.98
      });
      const bars = Array.from({ length: MAX_BARS }, () =>
        new ui.Rect({
          x: bounds.x,
          y: bounds.y,
          width: 1,
          height: 1,
          cornerRadius: 2,
          fill: "#38bdf8",
          visible: false,
          hittable: false
        })
      );
      const title = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 10,
        text: "Spectrum  WAITING",
        fill: "#e5e7eb",
        fontSize: 12,
        fontWeight: "700"
      });
      const subtitle = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + Math.max(46, bounds.height - 22),
        width: Math.max(24, bounds.width - 24),
        text: "等待 authority 频谱帧",
        fill: "#94a3b8",
        fontSize: 11
      });

      group.add(surface);
      group.addMany(bars);
      group.addMany(title, subtitle);

      const runtime = {
        bars,
        title,
        subtitle,
        unsubscribe: null
      };

      const store = getStore();
      const latestFrame = store?.getLatestFrame(context.node.id);
      if (latestFrame) {
        updateRuntime(runtime, context, latestFrame);
      }

      runtime.unsubscribe = store?.subscribe(context.node.id, (frame) => {
        updateRuntime(runtime, context, frame);
      }) || null;

      return {
        update() {
          const nextFrame = store?.getLatestFrame(context.node.id);
          if (nextFrame) {
            updateRuntime(runtime, context, nextFrame);
          }
        },
        destroy() {
          runtime.unsubscribe?.();
          group.removeAll();
        }
      };
    }
  }
];
`.trim();
}

function createPerfReadoutWidgetArtifactSource(): string {
  return `
const STREAM_STORE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY
  )};

function getStore() {
  return globalThis[STREAM_STORE_KEY] || null;
}

function createSparkline(history, x, y, width, height) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  const maxValue = Math.max(...history, 0.01);
  const minValue = Math.min(...history, 0);
  const range = Math.max(0.001, maxValue - minValue);
  const step = history.length <= 1 ? 0 : width / (history.length - 1);
  let path = "";
  for (let index = 0; index < history.length; index += 1) {
    const pointX = x + step * index;
    const normalized = (history[index] - minValue) / range;
    const pointY = y + height - normalized * height;
    path += index === 0 ? \`M \${pointX} \${pointY}\` : \` L \${pointX} \${pointY}\`;
  }
  return path;
}

function updateRuntime(runtime, context, frame) {
  if (!frame || frame.kind !== "perf") {
    return;
  }

  const { bounds } = context;
  runtime.header.text = \`Perf  \${frame.framesPerSecond.toFixed(1)} fps\`;
  runtime.lineA.text = \`Generator \${frame.generatorElapsedMs.toFixed(2)} ms  FFT \${frame.fftElapsedMs.toFixed(2)} ms\`;
  runtime.lineB.text = \`Total \${frame.totalElapsedMs.toFixed(2)} ms  Stream \${frame.publishedFramesPerSecond.toFixed(1)} fps\`;
  runtime.lineC.text = \`RMS \${frame.waveformRms.toFixed(3)}  Peak \${frame.waveformPeak.toFixed(3)}  Dom \${frame.dominantFrequency.toFixed(1)} Hz\`;
  runtime.lineD.text = \`Rate \${frame.sampleRate}  Size \${frame.frameSize}\`;
  runtime.sparkline.path = createSparkline(
    frame.history,
    bounds.x + 12,
    bounds.y + bounds.height - 46,
    Math.max(24, bounds.width - 24),
    28
  );
  context.requestRender();
}

export default [
  {
    type: ${JSON.stringify(DEMO_FREQUENCY_WIDGET_TYPES.perfReadout)},
    title: "Perf Readout",
    renderer(context) {
      const { ui, group, bounds } = context;
      const surface = new ui.Rect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        cornerRadius: 18,
        fill: "#18181b",
        stroke: "#27272a",
        strokeWidth: 1.2,
        opacity: 0.98
      });
      const header = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 10,
        text: "Perf  WAITING",
        fill: "#fafafa",
        fontSize: 12,
        fontWeight: "700"
      });
      const lineA = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 40,
        width: Math.max(24, bounds.width - 24),
        text: "等待 waveform/spectrum",
        fill: "#d4d4d8",
        fontSize: 11
      });
      const lineB = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 62,
        width: Math.max(24, bounds.width - 24),
        text: "Authority 还没有推送性能帧",
        fill: "#a1a1aa",
        fontSize: 11
      });
      const lineC = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 84,
        width: Math.max(24, bounds.width - 24),
        text: "",
        fill: "#a1a1aa",
        fontSize: 11
      });
      const lineD = new ui.Text({
        x: bounds.x + 12,
        y: bounds.y + 106,
        width: Math.max(24, bounds.width - 24),
        text: "",
        fill: "#71717a",
        fontSize: 11
      });
      const sparkline = new ui.Path({
        path: "",
        stroke: "#34d399",
        strokeWidth: 1.6,
        strokeCap: "round",
        strokeJoin: "round",
        fill: "transparent",
        hittable: false
      });

      group.addMany(surface, header, lineA, lineB, lineC, lineD, sparkline);

      const runtime = {
        header,
        lineA,
        lineB,
        lineC,
        lineD,
        sparkline,
        unsubscribe: null
      };

      const store = getStore();
      const latestFrame = store?.getLatestFrame(context.node.id);
      if (latestFrame) {
        updateRuntime(runtime, context, latestFrame);
      }

      runtime.unsubscribe = store?.subscribe(context.node.id, (frame) => {
        updateRuntime(runtime, context, frame);
      }) || null;

      return {
        update() {
          const nextFrame = store?.getLatestFrame(context.node.id);
          if (nextFrame) {
            updateRuntime(runtime, context, nextFrame);
          }
        },
        destroy() {
          runtime.unsubscribe?.();
          group.removeAll();
        }
      };
    }
  }
];
`.trim();
}

function createSignalGeneratorAuthorityArtifactSource(): string {
  return `
const generatorStateByNodeId = new Map();

function nowMs() {
  return typeof performance !== "undefined" && performance && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readWidgetValue(node, name, fallback) {
  const widget = Array.isArray(node.widgets)
    ? node.widgets.find((entry) => entry && entry.name === name)
    : null;
  return widget && widget.value !== undefined ? widget.value : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFrameSize(value) {
  const allowed = [256, 512, 1024, 2048];
  const nextValue = Math.round(parseNumber(value, 1024));
  return allowed.includes(nextValue) ? nextValue : 1024;
}

function normalizeSampleRate(value) {
  const allowed = [4000, 8000, 16000];
  const nextValue = Math.round(parseNumber(value, 8000));
  return allowed.includes(nextValue) ? nextValue : 8000;
}

function normalizeHarmonics(value) {
  const allowed = [1, 3, 5, 7];
  const nextValue = Math.round(parseNumber(value, 3));
  return allowed.includes(nextValue) ? nextValue : 3;
}

function getState(nodeId) {
  const existing = generatorStateByNodeId.get(nodeId);
  if (existing) {
    return existing;
  }

  const created = { phase: 0, frameIndex: 0 };
  generatorStateByNodeId.set(nodeId, created);
  return created;
}

export default [
  {
    type: "demo/signal-generator",
    title: "Signal Generator",
    category: "demo/frequency",
    description: "Authority 侧高频波形信号发生器。",
    inputs: [{ name: "trigger", type: "event" }],
    outputs: [{ name: "frame", type: "event" }],
    properties: [
      { name: "sampleRate", type: "number", default: 8000 },
      { name: "frameSize", type: "number", default: 1024 },
      { name: "frequency", type: "number", default: 440 },
      { name: "harmonics", type: "number", default: 3 },
      { name: "noise", type: "number", default: 0.04 },
      { name: "amplitude", type: "number", default: 0.9 }
    ],
    widgets: [
      { type: "select", name: "sampleRate", value: "8000", options: { label: "Sample Rate", items: ["4000", "8000", "16000"] } },
      { type: "select", name: "frameSize", value: "1024", options: { label: "Frame Size", items: ["256", "512", "1024", "2048"] } },
      { type: "input", name: "frequency", value: "440", options: { label: "Frequency", placeholder: "440" } },
      { type: "select", name: "harmonics", value: "3", options: { label: "Harmonics", items: ["1", "3", "5", "7"] } },
      { type: "slider", name: "amplitude", value: 0.9, options: { label: "Amplitude", min: 0.1, max: 1, step: 0.05 } },
      { type: "slider", name: "noise", value: 0.04, options: { label: "Noise", min: 0, max: 0.2, step: 0.01 } }
    ],
    size: [308, 440],
    onAction(node, action, _param, _options, api) {
      if (action !== "trigger") {
        return;
      }

      const startedAt = nowMs();
      const state = getState(node.id);
      const sampleRate = normalizeSampleRate(readWidgetValue(node, "sampleRate", node.properties?.sampleRate ?? 8000));
      const frameSize = normalizeFrameSize(readWidgetValue(node, "frameSize", node.properties?.frameSize ?? 1024));
      const frequency = clamp(parseNumber(readWidgetValue(node, "frequency", node.properties?.frequency ?? 440), 440), 20, sampleRate / 2);
      const harmonics = normalizeHarmonics(readWidgetValue(node, "harmonics", node.properties?.harmonics ?? 3));
      const amplitude = clamp(parseNumber(readWidgetValue(node, "amplitude", node.properties?.amplitude ?? 0.9), 0.9), 0.05, 1);
      const noise = clamp(parseNumber(readWidgetValue(node, "noise", node.properties?.noise ?? 0.04), 0.04), 0, 0.25);
      const phaseDelta = (Math.PI * 2 * frequency) / sampleRate;
      const samples = new Float32Array(frameSize);
      let peak = 0;
      let sumSquares = 0;

      for (let index = 0; index < frameSize; index += 1) {
        const phase = state.phase + index * phaseDelta;
        let sample = 0;
        for (let harmonicIndex = 1; harmonicIndex <= harmonics; harmonicIndex += 1) {
          sample += Math.sin(phase * harmonicIndex) / harmonicIndex;
        }
        sample = (sample / harmonics) * amplitude + (Math.random() * 2 - 1) * noise;
        sample = clamp(sample, -1, 1);
        samples[index] = sample;
        peak = Math.max(peak, Math.abs(sample));
        sumSquares += sample * sample;
      }

      state.phase = (state.phase + frameSize * phaseDelta) % (Math.PI * 2);
      state.frameIndex += 1;
      const rms = Math.sqrt(sumSquares / frameSize);
      const elapsedMs = nowMs() - startedAt;

      node.properties = {
        ...(node.properties || {}),
        sampleRate,
        frameSize,
        frequency,
        harmonics,
        noise,
        amplitude,
        peak,
        rms,
        status: \`GEN \${frequency.toFixed(1)}Hz\`
      };

      api.setOutputData(0, {
        kind: "waveform",
        nodeId: node.id,
        frameIndex: state.frameIndex,
        emittedAt: Date.now(),
        sampleRate,
        frameSize,
        frequency,
        harmonics,
        noise,
        amplitude,
        peak,
        rms,
        generatorElapsedMs: elapsedMs,
        samples
      });
    }
  }
];
`.trim();
}

function createFftAnalyzerAuthorityArtifactSource(): string {
  return `
const fftCacheByNodeId = new Map();

function nowMs() {
  return typeof performance !== "undefined" && performance && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function readWidgetValue(node, name, fallback) {
  const widget = Array.isArray(node.widgets)
    ? node.widgets.find((entry) => entry && entry.name === name)
    : null;
  return widget && widget.value !== undefined ? widget.value : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBinCount(value) {
  const nextValue = Math.round(parseNumber(value, 96));
  return nextValue === 128 ? 128 : 96;
}

function createBitReverseTable(size) {
  const table = new Uint32Array(size);
  const bitCount = Math.round(Math.log2(size));
  for (let index = 0; index < size; index += 1) {
    let reversed = 0;
    let value = index;
    for (let bit = 0; bit < bitCount; bit += 1) {
      reversed = (reversed << 1) | (value & 1);
      value >>= 1;
    }
    table[index] = reversed;
  }
  return table;
}

function createCache(size) {
  const half = size >> 1;
  const cos = new Float32Array(half);
  const sin = new Float32Array(half);
  for (let index = 0; index < half; index += 1) {
    const angle = (-2 * Math.PI * index) / size;
    cos[index] = Math.cos(angle);
    sin[index] = Math.sin(angle);
  }
  return {
    size,
    cos,
    sin,
    bitReverse: createBitReverseTable(size),
    real: new Float32Array(size),
    imag: new Float32Array(size)
  };
}

function ensureCache(nodeId, size) {
  const existing = fftCacheByNodeId.get(nodeId);
  if (existing && existing.size === size) {
    return existing;
  }
  const created = createCache(size);
  fftCacheByNodeId.set(nodeId, created);
  return created;
}

function computeMagnitudes(samples, cache) {
  const size = cache.size;
  const { real, imag, bitReverse, cos, sin } = cache;

  for (let index = 0; index < size; index += 1) {
    real[index] = samples[bitReverse[index]] || 0;
    imag[index] = 0;
  }

  for (let segmentSize = 2; segmentSize <= size; segmentSize <<= 1) {
    const halfSegment = segmentSize >> 1;
    const tableStep = size / segmentSize;
    for (let start = 0; start < size; start += segmentSize) {
      for (let offset = 0; offset < halfSegment; offset += 1) {
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSegment;
        const twiddleIndex = offset * tableStep;
        const treal = real[oddIndex] * cos[twiddleIndex] - imag[oddIndex] * sin[twiddleIndex];
        const timag = real[oddIndex] * sin[twiddleIndex] + imag[oddIndex] * cos[twiddleIndex];
        real[oddIndex] = real[evenIndex] - treal;
        imag[oddIndex] = imag[evenIndex] - timag;
        real[evenIndex] += treal;
        imag[evenIndex] += timag;
      }
    }
  }

  const magnitudes = new Float32Array(size >> 1);
  for (let index = 0; index < magnitudes.length; index += 1) {
    magnitudes[index] = Math.sqrt(real[index] * real[index] + imag[index] * imag[index]) / (size >> 1);
  }
  return magnitudes;
}

function downsampleBins(magnitudes, targetCount) {
  const result = new Array(targetCount).fill(0);
  const segment = magnitudes.length / targetCount;
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor(index * segment);
    const end = Math.max(start + 1, Math.floor((index + 1) * segment));
    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end && sampleIndex < magnitudes.length; sampleIndex += 1) {
      sum += magnitudes[sampleIndex];
      count += 1;
    }
    result[index] = count > 0 ? sum / count : 0;
  }
  return result;
}

export default [
  {
    type: "demo/fft-analyzer",
    title: "FFT Analyzer",
    category: "demo/frequency",
    description: "Authority 侧 radix-2 FFT 频谱分析节点。",
    inputs: [{ name: "frame", type: "event" }],
    outputs: [{ name: "spectrum", type: "event" }],
    properties: [{ name: "binCount", type: "number", default: 96 }],
    widgets: [
      { type: "select", name: "binCount", value: "96", options: { label: "Bin Count", items: ["96", "128"] } }
    ],
    size: [260, 160],
    onAction(node, action, payload, _options, api) {
      if (action !== "frame" || !payload || !(payload.samples instanceof Float32Array)) {
        return;
      }

      const startedAt = nowMs();
      const frameSize = Number(payload.frameSize) || 1024;
      const sampleRate = Number(payload.sampleRate) || 8000;
      const binCount = normalizeBinCount(readWidgetValue(node, "binCount", node.properties?.binCount ?? 96));
      const cache = ensureCache(node.id, frameSize);
      const magnitudes = computeMagnitudes(payload.samples, cache);
      const displayBins = downsampleBins(magnitudes, binCount);
      let dominantIndex = 1;
      let peakMagnitude = 0;
      for (let index = 1; index < magnitudes.length; index += 1) {
        if (magnitudes[index] > peakMagnitude) {
          peakMagnitude = magnitudes[index];
          dominantIndex = index;
        }
      }
      const elapsedMs = nowMs() - startedAt;
      const dominantFrequency = (dominantIndex * sampleRate) / frameSize;

      node.properties = {
        ...(node.properties || {}),
        binCount,
        dominantFrequency,
        peakMagnitude,
        status: \`FFT \${dominantFrequency.toFixed(1)}Hz\`
      };

      api.setOutputData(0, {
        kind: "spectrum",
        nodeId: node.id,
        frameIndex: Number(payload.frameIndex) || 0,
        emittedAt: Date.now(),
        sampleRate,
        frameSize,
        binCount: displayBins.length,
        bins: displayBins,
        dominantFrequency,
        peakMagnitude,
        waveformPeak: Number(payload.peak) || 0,
        waveformRms: Number(payload.rms) || 0,
        generatorElapsedMs: Number(payload.generatorElapsedMs) || 0,
        fftElapsedMs: elapsedMs
      });
    }
  }
];
`.trim();
}


function createScopeViewAuthorityArtifactSource(): string {
  return `
const STREAM_BRIDGE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY
  )};

function getBridge() {
  const bridge = globalThis[STREAM_BRIDGE_KEY];
  return bridge && typeof bridge.publish === "function" ? bridge : null;
}

function downsampleSamples(samples, targetCount) {
  const result = new Array(targetCount).fill(0);
  const segment = samples.length / targetCount;
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor(index * segment);
    const end = Math.max(start + 1, Math.floor((index + 1) * segment));
    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end && sampleIndex < samples.length; sampleIndex += 1) {
      sum += samples[sampleIndex];
      count += 1;
    }
    result[index] = count > 0 ? sum / count : 0;
  }
  return result;
}

function computeMin(samples) {
  let min = Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    min = Math.min(min, samples[index]);
  }
  return Number.isFinite(min) ? min : 0;
}

function computeMax(samples) {
  let max = -Infinity;
  for (let index = 0; index < samples.length; index += 1) {
    max = Math.max(max, samples[index]);
  }
  return Number.isFinite(max) ? max : 0;
}

export default [
  {
    type: "demo/scope-view",
    title: "Scope View",
    category: "demo/frequency",
    description: "订阅 authority 波形流并在节点内实时绘图。",
    inputs: [{ name: "frame", type: "event" }],
    widgets: [{ type: ${JSON.stringify(
      DEMO_FREQUENCY_WIDGET_TYPES.scopePlot
    )}, name: "scope", value: "scope" }],
    size: [380, 264],
    onAction(node, action, payload) {
      if (action !== "frame" || !payload || !(payload.samples instanceof Float32Array)) {
        return;
      }

      const bridge = getBridge();
      if (!bridge) {
        return;
      }

      bridge.publish({
        kind: "scope",
        nodeId: node.id,
        frameIndex: Number(payload.frameIndex) || 0,
        emittedAt: Date.now(),
        sampleRate: Number(payload.sampleRate) || 8000,
        frameSize: Number(payload.frameSize) || payload.samples.length,
        min: computeMin(payload.samples),
        max: computeMax(payload.samples),
        peak: Number(payload.peak) || 0,
        rms: Number(payload.rms) || 0,
        elapsedMs: Number(payload.generatorElapsedMs) || 0,
        points: downsampleSamples(payload.samples, 256)
      });
    }
  }
];
`.trim();
}

function createSpectrumViewAuthorityArtifactSource(): string {
  return `
const STREAM_BRIDGE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY
  )};

function getBridge() {
  const bridge = globalThis[STREAM_BRIDGE_KEY];
  return bridge && typeof bridge.publish === "function" ? bridge : null;
}

export default [
  {
    type: "demo/spectrum-view",
    title: "Spectrum View",
    category: "demo/frequency",
    description: "订阅 authority 频谱流并在节点内实时绘图。",
    inputs: [{ name: "spectrum", type: "event" }],
    widgets: [{ type: ${JSON.stringify(
      DEMO_FREQUENCY_WIDGET_TYPES.spectrumBars
    )}, name: "spectrum", value: "spectrum" }],
    size: [380, 264],
    onAction(node, action, payload) {
      if (action !== "spectrum" || !payload || !Array.isArray(payload.bins)) {
        return;
      }

      const bridge = getBridge();
      if (!bridge) {
        return;
      }

      bridge.publish({
        kind: "spectrum",
        nodeId: node.id,
        frameIndex: Number(payload.frameIndex) || 0,
        emittedAt: Date.now(),
        sampleRate: Number(payload.sampleRate) || 8000,
        frameSize: Number(payload.frameSize) || 1024,
        binCount: Number(payload.binCount) || payload.bins.length,
        dominantFrequency: Number(payload.dominantFrequency) || 0,
        peakMagnitude: Number(payload.peakMagnitude) || 0,
        elapsedMs: Number(payload.fftElapsedMs) || 0,
        bins: payload.bins.map((value) => Number(value) || 0)
      });
    }
  }
];
`.trim();
}

function createPerfMeterAuthorityArtifactSource(): string {
  return `
const STREAM_BRIDGE_KEY = ${JSON.stringify(
    RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY
  )};
const perfStateByNodeId = new Map();
const RATE_WINDOW_MS = 1000;
const HISTORY_LIMIT = 24;

function getBridge() {
  const bridge = globalThis[STREAM_BRIDGE_KEY];
  return bridge && typeof bridge.publish === "function" ? bridge : null;
}

function getState(nodeId) {
  const existing = perfStateByNodeId.get(nodeId);
  if (existing) {
    return existing;
  }

  const created = {
    waveformTimes: [],
    publishTimes: [],
    history: [],
    latestWaveform: {
      frameIndex: 0,
      sampleRate: 8000,
      frameSize: 1024,
      peak: 0,
      rms: 0,
      generatorElapsedMs: 0
    },
    latestSpectrum: {
      frameIndex: 0,
      dominantFrequency: 0,
      fftElapsedMs: 0
    }
  };
  perfStateByNodeId.set(nodeId, created);
  return created;
}

function trimTimestamps(values, now) {
  while (values.length > 0 && now - values[0] > RATE_WINDOW_MS) {
    values.shift();
  }
}

export default [
  {
    type: "demo/perf-meter",
    title: "Perf Meter",
    category: "demo/frequency",
    description: "显示 authority 侧生成和 FFT 耗时、帧率与 sparkline。",
    inputs: [
      { name: "waveform", type: "event" },
      { name: "spectrum", type: "event" }
    ],
    widgets: [{ type: ${JSON.stringify(
      DEMO_FREQUENCY_WIDGET_TYPES.perfReadout
    )}, name: "perf", value: "perf" }],
    size: [336, 220],
    onAction(node, action, payload) {
      if (!payload) {
        return;
      }

      const state = getState(node.id);
      const now = Date.now();

      if (action === "waveform") {
        state.latestWaveform = {
          frameIndex: Number(payload.frameIndex) || 0,
          sampleRate: Number(payload.sampleRate) || 8000,
          frameSize: Number(payload.frameSize) || 1024,
          peak: Number(payload.peak) || 0,
          rms: Number(payload.rms) || 0,
          generatorElapsedMs: Number(payload.generatorElapsedMs) || 0
        };
        state.waveformTimes.push(now);
        trimTimestamps(state.waveformTimes, now);
        return;
      }

      if (action !== "spectrum") {
        return;
      }

      const bridge = getBridge();
      if (!bridge) {
        return;
      }

      state.latestSpectrum = {
        frameIndex: Number(payload.frameIndex) || state.latestWaveform.frameIndex || 0,
        dominantFrequency: Number(payload.dominantFrequency) || 0,
        fftElapsedMs: Number(payload.fftElapsedMs) || 0
      };
      state.publishTimes.push(now);
      trimTimestamps(state.publishTimes, now);
      trimTimestamps(state.waveformTimes, now);

      const totalElapsedMs =
        state.latestWaveform.generatorElapsedMs + state.latestSpectrum.fftElapsedMs;
      state.history.push(totalElapsedMs);
      if (state.history.length > HISTORY_LIMIT) {
        state.history.shift();
      }

      node.properties = {
        ...(node.properties || {}),
        sampleRate: state.latestWaveform.sampleRate,
        frameSize: state.latestWaveform.frameSize,
        dominantFrequency: state.latestSpectrum.dominantFrequency,
        totalElapsedMs,
        status: \`PERF \${totalElapsedMs.toFixed(2)}ms\`
      };

      bridge.publish({
        kind: "perf",
        nodeId: node.id,
        frameIndex: state.latestSpectrum.frameIndex,
        emittedAt: now,
        sampleRate: state.latestWaveform.sampleRate,
        frameSize: state.latestWaveform.frameSize,
        waveformPeak: state.latestWaveform.peak,
        waveformRms: state.latestWaveform.rms,
        dominantFrequency: state.latestSpectrum.dominantFrequency,
        generatorElapsedMs: state.latestWaveform.generatorElapsedMs,
        fftElapsedMs: state.latestSpectrum.fftElapsedMs,
        totalElapsedMs,
        framesPerSecond: state.waveformTimes.length,
        publishedFramesPerSecond: state.publishTimes.length,
        history: state.history.slice()
      });
    }
  }
];
`.trim();
}
