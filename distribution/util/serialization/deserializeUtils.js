/** @typedef {import('.').SerializableNode<any>} SerializableNode */

const {NATIVE_REVERSE_MAPPING} = require('./native');

/**
 * Checks if the node represents a terminal value
 * @param {SerializableNode} node
 * @return {boolean} true if the node represents a terminal, and false otherwise
 */
function isTerminalNode(node) {
  return ![
    'object',
    'array',
    'reference',
  ].includes(node.type);
}

/**
 * Deserializes a terminal node and returns its value
 * @param {SerializableNode} node
 * @return {any}
 */
function deserializeTerminalNode(node) {
  switch (node.type) {
    case 'null':
      return null;
    case 'string':
      return node.value;
    case 'number':
      return node.value;
    case 'bigint':
      return BigInt(node.value);
    case 'boolean':
      return node.value;
    case 'symbol':
      return Symbol(node.value);
    case 'undefined':
      return undefined;
    case 'date':
      return new Date(node.value);
    case 'error':
      return new Error(node.value);
    case 'function':
      const fnWrapper = new Function('return ' + node.value);
      return fnWrapper();
    case 'native':
      const nativeFn = NATIVE_REVERSE_MAPPING.get(node.id);
      if (!nativeFn) {
        throw new Error(`deserialized unknown native function "${node.id}"`);
      }
      return nativeFn;
    default:
      throw new Error(
          'expected terminal node, instead got a node with type ' +
          `"${node.type}": ${node}`,
      );
  }
}

module.exports = {
  isTerminalNode,
  deserializeTerminalNode,
};
