const { DiffEngine } = require('./dist/index.js');

const engine = new DiffEngine();

const document = {
  documentId: 'test-doc',
  revision: 1,
  nodes: [],
  links: []
};

try {
  const result = engine.applyDiff(document, null);
  console.log('Result:', result);
} catch (error) {
  console.log('Error:', error.message);
}
