import { describe, it, expect, beforeEach } from 'bun:test';
import { DiffEngine, FindUpdater, DiffProjector } from '../src';
import type { GraphDocument, GraphDocumentDiff } from '../src/types';

describe('Edge Cases and Error Handling', () => {
  describe('DiffEngine', () => {
    let engine: DiffEngine;
    
    beforeEach(() => {
      engine = new DiffEngine();
    });
    
    it('should handle empty documents', () => {
      const emptyDocument: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [],
        links: []
      };
      
      const diff = engine.computeDiff(emptyDocument, emptyDocument);
      
      expect(diff.operations).toHaveLength(0);
      expect(diff.fieldChanges).toHaveLength(0);
    });
    
    it('should handle document with only nodes', () => {
      const documentWithNodes: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      const diff = engine.computeDiff(documentWithNodes, documentWithNodes);
      
      expect(diff.operations).toHaveLength(0);
      expect(diff.fieldChanges).toHaveLength(0);
    });
    
    it('should handle document with only links', () => {
      const documentWithLinks: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } },
          { id: 'node2', type: 'basic', title: 'Node 2', layout: { x: 300, y: 100, width: 200, height: 100 } }
        ],
        links: [
          { id: 'link1', source: { nodeId: 'node1', portId: 'output' }, target: { nodeId: 'node2', portId: 'input' } }
        ]
      };
      
      const diff = engine.computeDiff(documentWithLinks, documentWithLinks);
      
      expect(diff.operations).toHaveLength(0);
      expect(diff.fieldChanges).toHaveLength(0);
    });
    
    it('should handle large number of nodes and links', () => {
      // Create a document with 100 nodes and 50 links
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        id: `node${i}`,
        type: 'basic',
        title: `Node ${i}`,
        layout: { x: 100 + i * 50, y: 100, width: 200, height: 100 }
      }));
      
      const links = Array.from({ length: 50 }, (_, i) => ({
        id: `link${i}`,
        source: { nodeId: `node${i}`, portId: 'output' },
        target: { nodeId: `node${i + 1}`, portId: 'input' }
      }));
      
      const largeDocument: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes,
        links
      };
      
      const diff = engine.computeDiff(largeDocument, largeDocument);
      
      expect(diff.operations).toHaveLength(0);
      expect(diff.fieldChanges).toHaveLength(0);
    });
    
    it('should handle node with complex properties', () => {
      const documentWithComplexProps: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          {
            id: 'node1',
            type: 'basic',
            title: 'Node 1',
            layout: { x: 100, y: 100, width: 200, height: 100 },
            properties: {
              nested: {
                array: [1, 2, 3],
                object: { a: 1, b: 2 }
              },
              boolean: true,
              number: 42,
              string: 'test'
            }
          }
        ],
        links: []
      };
      
      const diff = engine.computeDiff(documentWithComplexProps, documentWithComplexProps);
      
      expect(diff.operations).toHaveLength(0);
      expect(diff.fieldChanges).toHaveLength(0);
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
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      updater = new FindUpdater(document);
    });
    
    it('should handle findById with non-existent node', () => {
      const node = updater.findById('non-existent');
      expect(node).toBeUndefined();
    });
    
    it('should handle updateById with non-existent node', () => {
      const success = updater.updateById('non-existent', { title: 'Updated' });
      expect(success).toBe(false);
    });
    
    it('should handle setNodeProperty with non-existent node', () => {
      const success = updater.setNodeProperty('non-existent', 'key', 'value');
      expect(success).toBe(false);
    });
    
    it('should handle setNodeData with non-existent node', () => {
      const success = updater.setNodeData('non-existent', 'key', 'value');
      expect(success).toBe(false);
    });
    
    it('should handle setNodeFlag with non-existent node', () => {
      const success = updater.setNodeFlag('non-existent', 'key', true);
      expect(success).toBe(false);
    });
    
    it('should handle setNodeWidgetValue with non-existent node', () => {
      const success = updater.setNodeWidgetValue('non-existent', 0, 'value');
      expect(success).toBe(false);
    });
    
    it('should handle setNodeWidgetValue with invalid widget index', () => {
      const success = updater.setNodeWidgetValue('node1', 999, 'value');
      expect(success).toBe(false);
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
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      projector = new DiffProjector();
    });
    

    
    it('should handle project with invalid field change', () => {
      const invalidDiff: GraphDocumentDiff = {
        documentId: 'test-doc',
        baseRevision: 1,
        revision: 2,
        emittedAt: Date.now(),
        operations: [],
        fieldChanges: [
          { type: 'node.title.set', nodeId: 'non-existent', value: 'Updated' } as any
        ]
      };
      
      const result = projector.project(document, invalidDiff);
      
      expect(result.success).toBe(false);
      expect(result.requiresFullReplace).toBe(true);
    });
  });
});
