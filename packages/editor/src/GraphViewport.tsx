import { useEffect, useRef } from "preact/hooks";

import { createLeaferGraph, type LeaferGraphNodeData } from "leafergraph";

interface GraphViewportProps {
  nodes: LeaferGraphNodeData[];
}

export function GraphViewport({ nodes }: GraphViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const graph = createLeaferGraph(host, { nodes });

    return () => {
      graph.destroy();
    };
  }, [nodes]);

  return <div ref={hostRef} class="graph-root" />;
}
