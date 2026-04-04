import { describe, it, expect, beforeEach } from 'bun:test';
import { DiffEngine, FindUpdater, DiffProjector } from '../src';
import type { GraphDocument } from '@leafergraph/node';

describe('DiffEngine', () => {
  let oldDocument: GraphDocument;
  let newDocument: GraphDocument;
  let engine: DiffEngine;
  
  beforeEach(() => {
    engine = new DiffEngine();
    
    oldDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 }
        }
      ],
      links: []
    };
    
    newDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Updated Node 1',
          layout: { x: 150, y: 150, width: 200, height: 100 }
        },
        {
          id: 'node2',
          type: 'basic',
          title: 'Node 2',
          layout: { x: 300, y: 100, width: 200, height: 100 }
        }
      ],
      links: [
        {
          id: 'link1',
          source: { nodeId: 'node1', portId: 'output' },
          target: { nodeId: 'node2', portId: 'input' }
        }
      ]
    };
  });
  
  it('should compute diff between two documents', () => {
    const diff = engine.computeDiff(oldDocument, newDocument);
    
    expect(diff.documentId).toBe('test-doc');
    expect(diff.baseRevision).toBe(1);
    expect(diff.revision).toBe(2);
    expect(diff.operations).toHaveLength(3); // node.create, node.move, and link.create
    expect(diff.fieldChanges).toHaveLength(1); // node.title.set
  });
  
  it('should apply diff to document', () => {
    const diff = engine.computeDiff(oldDocument, newDocument);
    const result = engine.applyDiff(oldDocument, diff);
    
    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.document.nodes).toHaveLength(2);
    expect(result.document.links).toHaveLength(1);
    expect(result.affectedNodeIds).toContain('node1');
    expect(result.affectedNodeIds).toContain('node2');
    expect(result.affectedLinkIds).toContain('link1');
  });
  
  it('should handle node property changes', () => {
    const documentWithProps: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          properties: { test: 'value' }
        }
      ],
      links: []
    };
    
    const updatedDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          properties: { test: 'updated value' }
        }
      ],
      links: []
    };
    
    const diff = engine.computeDiff(documentWithProps, updatedDocument);
    const result = engine.applyDiff(documentWithProps, diff);
    
    expect(result.success).toBe(true);
    expect(result.document.nodes[0].properties?.test).toBe('updated value');
  });
  
  it('should handle node data changes', () => {
    const documentWithData: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          data: { test: 'value' }
        }
      ],
      links: []
    };
    
    const updatedDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          data: { test: 'updated value' }
        }
      ],
      links: []
    };
    
    const diff = engine.computeDiff(documentWithData, updatedDocument);
    const result = engine.applyDiff(documentWithData, diff);
    
    expect(result.success).toBe(true);
    expect(result.document.nodes[0].data?.test).toBe('updated value');
  });
  
  it('should handle document ID mismatch', () => {
    const diff = engine.computeDiff(oldDocument, {
      ...newDocument,
      documentId: 'different-doc'
    });
    
    const result = engine.applyDiff(oldDocument, diff);
    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
  });
  
  it('should handle revision mismatch', () => {
    const diff = engine.computeDiff(oldDocument, newDocument);
    const result = engine.applyDiff({
      ...oldDocument,
      revision: 3
    }, diff);
    
    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
  });

  it('should generate node.collapse operation when collapsed flag changes', () => {
    const before: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          flags: { collapsed: false }
        }
      ],
      links: []
    };
    const after: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          flags: { collapsed: true }
        }
      ],
      links: []
    };

    const diff = engine.computeDiff(before, after);
    const collapseOperation = diff.operations.find(
      (operation) => operation.type === 'node.collapse'
    );

    expect(collapseOperation).toBeDefined();
    expect(collapseOperation).toMatchObject({
      type: 'node.collapse',
      nodeId: 'node1',
      collapsed: true
    });
    expect(
      diff.fieldChanges.some(
        (change) =>
          change.type === 'node.flag.set' &&
          (change as { key?: string }).key === 'collapsed'
      )
    ).toBe(false);
  });

  it('should generate node.widget.value.set operation for value-only widget changes', () => {
    const before: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          widgets: [{ type: 'number', name: 'value', value: 1 }]
        }
      ],
      links: []
    };
    const after: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          widgets: [{ type: 'number', name: 'value', value: 2 }]
        }
      ],
      links: []
    };

    const diff = engine.computeDiff(before, after);

    expect(
      diff.operations.some(
        (operation) =>
          operation.type === 'node.widget.value.set' &&
          operation.nodeId === 'node1' &&
          operation.widgetIndex === 0 &&
          operation.value === 2
      )
    ).toBe(true);
    expect(diff.fieldChanges.some((change) => change.type === 'node.widget.value.set')).toBe(
      false
    );
    expect(diff.fieldChanges.some((change) => change.type === 'node.widget.replace')).toBe(
      false
    );
  });
});

describe('FindUpdater', () => {
    let document: GraphDocument;
    let updater: FindUpdater;
    
    beforeEach(() => {
      document = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          {
            id: 'node1',
            type: 'basic',
            title: 'Node 1',
            layout: { x: 100, y: 100, width: 200, height: 100 },
            data: { existing: 'value' },
            flags: { active: true }
          }
        ],
        links: []
      };
      
      updater = new FindUpdater(document);
    });
    
    it('should find node by ID', () => {
      const node = updater.findById('node1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('node1');
    });
    
    it('should update node by ID', () => {
      const success = updater.updateById('node1', {
        title: 'Updated Node 1'
      });
      
      expect(success).toBe(true);
      expect(document.nodes[0].title).toBe('Updated Node 1');
    });
    
    it('should set node property', () => {
      const success = updater.setNodeProperty('node1', 'test', 'value');
      
      expect(success).toBe(true);
      expect(document.nodes[0].properties?.test).toBe('value');
    });
    
    it('should set node data', () => {
      const success = updater.setNodeData('node1', 'newKey', 'newValue');
      
      expect(success).toBe(true);
      expect(document.nodes[0].data?.newKey).toBe('newValue');
    });
    
    it('should set node flag', () => {
      const success = updater.setNodeFlag('node1', 'newFlag', true);
      
      expect(success).toBe(true);
      expect((document.nodes[0].flags as any)?.newFlag).toBe(true);
    });
  });

describe('DiffProjector', () => {
  let document: GraphDocument;
  let projector: DiffProjector;
  
  beforeEach(() => {
    document = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 }
        }
      ],
      links: []
    };
    
    projector = new DiffProjector();
  });
  
  it('should project diff to document', () => {
    const diff = {
      documentId: 'test-doc',
      baseRevision: 1,
      revision: 2,
      emittedAt: Date.now(),
      operations: [],
      fieldChanges: [
        {
          type: 'node.title.set',
          nodeId: 'node1',
          value: 'Updated Node 1'
        }
      ]
    };
    
    const result = projector.project(document, diff);
    
    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.document.nodes[0].title).toBe('Updated Node 1');
    expect(result.affectedNodeIds).toContain('node1');
  });
});
