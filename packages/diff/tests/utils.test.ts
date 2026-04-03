import { describe, it, expect } from 'bun:test';
import { deepClone, generateId, deepEqual, findNodeById, findLinkById, validateDocument, mergeDocuments } from '../src/utils/helpers';
import { validateDiff, validateOperation, validateFieldChange } from '../src/utils/validators';
import type { GraphDocument, GraphDocumentDiff, GraphDocumentFieldChange } from '../src/types';

describe('Utils', () => {
  describe('helpers', () => {
    it('deepClone should create a deep copy of an object', () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4] }
      };
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });
    
    it('generateId should create a unique ID with optional prefix', () => {
      const id1 = generateId();
      const id2 = generateId('test');
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id2).toStartWith('test-');
    });
    
    it('deepEqual should return true for identical objects', () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { a: 1, b: { c: 2 } };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
    });
    
    it('deepEqual should return false for different objects', () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { a: 1, b: { c: 3 } };
      
      expect(deepEqual(obj1, obj2)).toBe(false);
    });
    
    it('deepEqual should handle arrays correctly', () => {
      const arr1 = [1, 2, { a: 3 }];
      const arr2 = [1, 2, { a: 3 }];
      const arr3 = [1, 2, { a: 4 }];
      
      expect(deepEqual(arr1, arr2)).toBe(true);
      expect(deepEqual(arr1, arr3)).toBe(false);
    });
    
    it('findNodeById should find a node by its ID', () => {
      const document: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } },
          { id: 'node2', type: 'basic', title: 'Node 2', layout: { x: 300, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      const node = findNodeById(document, 'node1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('node1');
    });
    
    it('findNodeById should return undefined for non-existent node', () => {
      const document: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      const node = findNodeById(document, 'node2');
      expect(node).toBeUndefined();
    });
    
    it('findLinkById should find a link by its ID', () => {
      const document: GraphDocument = {
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
      
      const link = findLinkById(document, 'link1');
      expect(link).toBeDefined();
      expect(link?.id).toBe('link1');
    });
    
    it('findLinkById should return undefined for non-existent link', () => {
      const document: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      const link = findLinkById(document, 'link1');
      expect(link).toBeUndefined();
    });
    
    it('validateDocument should return true for valid document', () => {
      const document: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      expect(validateDocument(document)).toBe(true);
    });
    
    it('validateDocument should return false for invalid document', () => {
      // Missing documentId
      const invalidDoc1 = {
        revision: 1,
        nodes: [],
        links: []
      };
      
      // Invalid revision type
      const invalidDoc2: any = {
        documentId: 'test-doc',
        revision: '1',
        nodes: [],
        links: []
      };
      
      // Duplicate node IDs
      const invalidDoc3: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } },
          { id: 'node1', type: 'basic', title: 'Node 2', layout: { x: 300, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      expect(validateDocument(invalidDoc1 as GraphDocument)).toBe(false);
      expect(validateDocument(invalidDoc2)).toBe(false);
      expect(validateDocument(invalidDoc3)).toBe(false);
    });
    
    it('mergeDocuments should merge two documents and deduplicate nodes and links', () => {
      const base: GraphDocument = {
        documentId: 'test-doc',
        revision: 1,
        nodes: [
          { id: 'node1', type: 'basic', title: 'Node 1', layout: { x: 100, y: 100, width: 200, height: 100 } }
        ],
        links: []
      };
      
      const update: GraphDocument = {
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
      
      const merged = mergeDocuments(base, update);
      
      expect(merged.nodes).toHaveLength(2);
      expect(merged.links).toHaveLength(1);
      expect(merged.nodes[0].title).toBe('Updated Node 1');
      expect(merged.revision).toBe(2);
    });
  });
  
  describe('validators', () => {
    it('validateDiff should return true for valid diff', () => {
      const validDiff: GraphDocumentDiff = {
        documentId: 'test-doc',
        baseRevision: 1,
        revision: 2,
        emittedAt: Date.now(),
        operations: [],
        fieldChanges: []
      };
      
      expect(validateDiff(validDiff)).toBe(true);
    });
    
    it('validateDiff should return false for invalid diff', () => {
      // Missing documentId
      const invalidDiff1: any = {
        baseRevision: 1,
        revision: 2,
        emittedAt: Date.now(),
        operations: [],
        fieldChanges: []
      };
      
      expect(validateDiff(invalidDiff1)).toBe(false);
    });
    
    it('validateOperation should return true for valid operation', () => {
      const validOperation = {
        operationId: 'op1',
        timestamp: Date.now(),
        source: 'test',
        type: 'document.update'
      };
      
      expect(validateOperation(validOperation)).toBe(true);
    });
    
    it('validateOperation should return false for invalid operation', () => {
      // Missing operationId
      const invalidOperation = {
        timestamp: Date.now(),
        source: 'test',
        type: 'document.update'
      };
      
      expect(validateOperation(invalidOperation)).toBe(false);
    });
    
    it('validateFieldChange should return true for valid field change', () => {
      const validFieldChange: GraphDocumentFieldChange = {
        type: 'node.title.set',
        nodeId: 'node1',
        value: 'Updated Title'
      };
      
      expect(validateFieldChange(validFieldChange)).toBe(true);
    });
    
    it('validateFieldChange should return false for invalid field change', () => {
      // Missing nodeId
      const invalidFieldChange: any = {
        type: 'node.title.set',
        value: 'Updated Title'
      };
      
      expect(validateFieldChange(invalidFieldChange)).toBe(false);
    });
  });
});
