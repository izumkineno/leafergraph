import type { DevNodeMeta } from "@leafergraph/authoring";
import type { NodeDefinition } from "@leafergraph/node";
import {
  WEB_CRAWLER_ARRAY_LIST_TYPE,
  WEB_CRAWLER_CRAWLER_TYPE,
  WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT,
  WEB_CRAWLER_NODES_DEFAULT_WIDTH,
  WEB_CRAWLER_PARSER_TYPE
} from "../developer/shared";

export const WEB_CRAWLER_CRAWLER_DEFAULT_URL = "https://httpbin.org/html";
export const WEB_CRAWLER_PARSER_DEFAULT_SELECTOR = "a";

export const WEB_CRAWLER_CRAWLER_META = {
  type: WEB_CRAWLER_CRAWLER_TYPE,
  title: "Crawler",
  category: "Web Crawler",
  description: "Fetch HTML content from given URL",
  shell: {
    longTask: true
  },
  inputs: [{ name: "start", type: "event", optional: true }],
  outputs: [{ name: "dom", type: "string" }],
  properties: [
    {
      name: "url",
      type: "string",
      default: WEB_CRAWLER_CRAWLER_DEFAULT_URL
    }
  ],
  widgets: [
    {
      type: "input",
      name: "url",
      value: WEB_CRAWLER_CRAWLER_DEFAULT_URL,
      options: {
        label: "URL",
        placeholder: "Enter URL to crawl"
      }
    },
    {
      type: "textarea",
      name: "status",
      value: "Idle",
      options: {
        label: "Status",
        rows: 3,
        readonly: true
      }
    }
  ],
  size: [
    WEB_CRAWLER_NODES_DEFAULT_WIDTH,
    WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT
  ] as [number, number],
  resize: {
    minWidth: WEB_CRAWLER_NODES_DEFAULT_WIDTH,
    minHeight: WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT
  }
} satisfies DevNodeMeta;

export const WEB_CRAWLER_PARSER_META = {
  type: WEB_CRAWLER_PARSER_TYPE,
  title: "DOM Parser",
  category: "Web Crawler",
  description: "Parse DOM with CSS selector and extract matched elements",
  inputs: [{ name: "dom", type: "string", optional: false }],
  outputs: [{ name: "result", type: "any" }],
  properties: [
    {
      name: "selector",
      type: "string",
      default: WEB_CRAWLER_PARSER_DEFAULT_SELECTOR
    }
  ],
  widgets: [
    {
      type: "input",
      name: "selector",
      value: WEB_CRAWLER_PARSER_DEFAULT_SELECTOR,
      options: {
        label: "Selector",
        placeholder: "CSS selector (e.g. a, .class, #id)"
      }
    },
    {
      type: "textarea",
      name: "status",
      value: "",
      options: {
        label: "Status",
        rows: 3,
        readonly: true
      }
    }
  ],
  size: [
    WEB_CRAWLER_NODES_DEFAULT_WIDTH,
    WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 10
  ] as [number, number],
  resize: {
    minWidth: WEB_CRAWLER_NODES_DEFAULT_WIDTH,
    minHeight: WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT
  }
} satisfies DevNodeMeta;

export const WEB_CRAWLER_ARRAY_LIST_META = {
  type: WEB_CRAWLER_ARRAY_LIST_TYPE,
  title: "Array List",
  category: "Web Crawler",
  description: "Display array as list on node",
  inputs: [{ name: "input", type: "any", optional: false }],
  outputs: [],
  widgets: [
    {
      type: "textarea",
      name: "content",
      value: "No data",
      options: {
        label: "Content",
        rows: 8,
        readonly: true
      }
    }
  ],
  size: [
    WEB_CRAWLER_NODES_DEFAULT_WIDTH + 40,
    WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 60
  ] as [number, number],
  resize: {
    minWidth: WEB_CRAWLER_NODES_DEFAULT_WIDTH,
    minHeight: WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 30
  }
} satisfies DevNodeMeta;

export const WEB_CRAWLER_BROWSER_NODE_DEFINITIONS = [
  cloneBrowserDefinition(WEB_CRAWLER_CRAWLER_META),
  cloneBrowserDefinition(WEB_CRAWLER_PARSER_META),
  cloneBrowserDefinition(WEB_CRAWLER_ARRAY_LIST_META)
] as NodeDefinition[];

function cloneBrowserDefinition(meta: DevNodeMeta): NodeDefinition {
  return cloneStructuredValue(meta as NodeDefinition);
}

function cloneStructuredValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
