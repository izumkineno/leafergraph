import { describe, it, expect } from 'bun:test';
import { DiffEngine, FindUpdater, DiffProjector, deepClone } from '../src';
import type { GraphDocument } from '@leafergraph/node';

describe('Integration Tests', () => {
  it('should integrate DiffEngine and DiffProjector', () => {
    const engine = new DiffEngine();
    const projector = new DiffProjector();
    
    // Create initial document
    const initialDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
      ],
      links: []
    };
    
    // Create updated document
    const updatedDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        { id: 'node1', type: 'basic', title: 'Updated Node 1', layout: { x: 150, y: 150, width: 200, height: 100 } },
        { id: 'node2', type: 'basic', title: 'Node 2', layout: { x: 300, y: 100, width: 200, height: 100 } }
      ],
      links: [
        { id: 'link1', source: { nodeId: 'node1', portId: 'output' }, target: { nodeId: 'node2', portId: 'input' } }
      ]
    };
    
    // Compute diff
    const diff = engine.computeDiff(initialDocument, updatedDocument);
    
    // Project diff to document
    const result = projector.project(initialDocument, diff);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.document.nodes).toHaveLength(2);
    expect(result.document.links).toHaveLength(1);
    expect(result.document.nodes[0].title).toBe('Updated Node 1');
    expect(result.affectedNodeIds).toContain('node1');
    expect(result.affectedNodeIds).toContain('node2');
    expect(result.affectedLinkIds).toContain('link1');
  });
  
  it('should integrate DiffEngine and FindUpdater', () => {
    const engine = new DiffEngine();
    
    // Create initial document
    const initialDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
      ],
      links: []
    };
    
    // Create updated document
    const updatedDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        { id: 'node1', type: 'basic', title: 'Updated Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
      ],
      links: []
    };
    
    // Compute diff
    const diff = engine.computeDiff(initialDocument, updatedDocument);
    
    // Verify the diff
    expect(diff.fieldChanges).toHaveLength(1);
    expect(diff.fieldChanges[0].type).toBe('node.title.set');
    expect(diff.fieldChanges[0].nodeId).toBe('node1');
    expect(diff.fieldChanges[0].value).toBe('Updated Node 1');
  });
  
  it('should integrate multiple modules for a complete workflow', () => {
    // Step 1: Create initial document
    const initialDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 1,
      nodes: [
        { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
      ],
      links: []
    };
    
    // Step 2: Use FindUpdater to modify the document
    const updater = new FindUpdater(deepClone(initialDocument));
    updater.updateById('node1', { title: 'Updated Node 1' });
    updater.setNodeProperty('node1', 'test', 'value');
    
    // Step 3: Create updated document
    const updatedDocument: GraphDocument = {
      documentId: 'test-doc',
      revision: 2,
      nodes: [
        {
          id: 'node1',
          type: 'basic',
          title: 'Updated Node 1',
          layout: { x: 100, y: 100, width: 200, height: 100 },
          properties: { test: 'value' }
        }
      ],
      links: []
    };
    
    // Step 4: Use DiffEngine to compute diff
    const engine = new DiffEngine();
    const diff = engine.computeDiff(initialDocument, updatedDocument);
    
    // Step 5: Use DiffProjector to apply diff
    const projector = new DiffProjector();
    const result = projector.project(initialDocument, diff);
    
    // Step 6: Verify the final result
    expect(result.success).toBe(true);
    expect(result.document.nodes[0].title).toBe('Updated Node 1');
    expect(result.document.nodes[0].properties?.test).toBe('value');
  });
});
