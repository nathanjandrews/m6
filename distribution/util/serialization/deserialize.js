/**
 * @template T
 * @typedef {import('.').SerializableNode<T>} SerializableNode<T> */

/** @typedef {import('.').Wrappers<any>} Wrappers */

const {
  isTerminalNode,
  deserializeTerminalNode,
} = require('./deserializeUtils');

/**
 *
 * @param {SerializableNode<any>} node
 * @param {Wrappers} wrappers
 * @return {any}
 */
function deserialize(node, wrappers) {
  if (isTerminalNode(node)) {
    return deserializeTerminalNode(node);
  }

  if (node.type === 'array') {
    return deserializeArray(node, wrappers);
  }

  if (node.type === 'object') {
    return deserializeObject(node, wrappers);
  }

  if (node.type === 'reference') {
    // if the node is a reference, check if the reference is wraps the current
    // node (or is equal to the current node). If so, return the wrapper
    const wrapper = wrappers.get(node.id);
    if (wrapper) {
      return wrapper;
    }

    // since references are only created in the case of self-loops, all
    // reference nodes should have a wrapper. If a reference node does not
    // have a wrapper, then there is an error
    throw new Error(`reference node does not have wrapping value: ${node}`);
  }

  throw new Error(`received node with unknown type "${node.type}": ${node}`);
}

/**
 * Deserializes an array node
 * @param {SerializableNode<SerializableNode<any>[]>} arrNode
 * @param {Wrappers} wrappers
 * @return {any}
 */
function deserializeArray(arrNode, wrappers) {
  const dArr = [];
  wrappers.set(arrNode.id, dArr);
  const sArr = arrNode.value || [];
  for (const sItem of sArr) {
    if (sItem.type === 'reference' && sItem.id === arrNode.id) {
      // if the item is a self reference, push the array into itself
      dArr.push(dArr);
    } else {
      dArr.push(deserialize(sItem, wrappers));
    }
  }
  wrappers.delete(arrNode.id);
  return dArr;
}

/**
 * @param {SerializableNode<Record<string, SerializableNode<any>>>} objNode
 * @param {Wrappers} wrappers
 * @return {object}
 */
function deserializeObject(objNode, wrappers) {
  const dObj = {};
  wrappers.set(objNode.id, dObj);
  const sObj = objNode.value || {};
  for (const propertyName of Object.getOwnPropertyNames(sObj)) {
    const sValue = sObj[propertyName];
    if (sValue.type === 'reference' && sValue.id === objNode.id) {
      dObj[propertyName] = dObj;
    } else {
      dObj[propertyName] = deserialize(sValue, wrappers);
    }
  }
  wrappers.delete(objNode.id);
  return dObj;
}

module.exports = {
  deserialize,
};
