const {isTerminal, serializeTerminal} = require('./serializeUtils');
const {generateId} = require('./id');
const {NATIVE_FORWARD_MAPPING} = require('./native');

/**
 * @template T
 * @typedef {import('.').SerializableNode<T>} SerializableNode<T> */
/** @typedef {import('.').Wrappers<string>} Wrappers */

/**
 * Serializes some value
 * @param {any} data
 * @param {Wrappers} wrappers
 * @return {{
 *  wrapper: {}, sNode: null
 * } | {
 *  wrapper: null, sNode: SerializableNode<any>
 * }}
 */
function serialize(data, wrappers) {
  if (wrappers.has(data)) {
    return {wrapper: data, sNode: null};
  }

  if (isTerminal(data)) {
    return {wrapper: null, sNode: serializeTerminal(data)};
  }

  if (typeof data === 'function') {
    return {wrapper: null, sNode: serializeFunction(data)};
  }

  if (typeof data === 'object') {
    return {wrapper: null, sNode: serializeObject(data, wrappers)};
  }

  throw new Error(
      'should not reach here! received object with type ' +
      `${typeof data}: ${data}`,
  );
}

/**
 * Serializes an object value
 * @param {object} object
 * @param {Wrappers} wrappers
 * @return {SerializableNode<object>}
 */
function serializeObject(object, wrappers) {
  if (Array.isArray(object)) {
    return serializeArray(object, wrappers);
  }

  const objectId = generateId();
  wrappers.set(object, objectId);

  /** @type {Record<string, SerializableNode<any>>} */
  const sObject = {};

  for (const propertyName of Object.getOwnPropertyNames(object)) {
    const value = object[propertyName];

    if (isTerminal(value)) {
      sObject[propertyName] = serializeTerminal(value);
      continue;
    }

    const {wrapper, sNode} = serialize(value, wrappers);

    if (wrapper !== null) {
      // the current value in the object is contained
      // in a loop (or wrapper would be null)
      sObject[propertyName] = {
        type: 'reference',
        id: wrappers.get(wrapper),
      };
      continue;
    }

    sObject[propertyName] = sNode;
  }

  /** @type {SerializableNode<object>} */
  const sObjectNode = {
    type: 'object',
    id: objectId,
    value: sObject,
  };

  wrappers.delete(object);

  return sObjectNode;
}

/**
 * Serializes an array object
 * @param {any[]} arr
 * @param {Wrappers} wrappers
 * @return {SerializableNode<any[]>}
*/
function serializeArray(arr, wrappers) {
  const arrId = generateId();
  wrappers.set(arr, arrId);
  const sArr = [];
  for (const item of arr) {
    if (isTerminal(item)) {
      sArr.push(serializeTerminal(item));
      continue;
    }

    const {wrapper, sNode} = serialize(item, wrappers);

    if (wrapper !== null) {
      // the current array value is contained
      // in a loop (or wrapper would be null)
      sArr.push({
        type: 'reference',
        id: wrappers.get(wrapper),
      });
      continue;
    }

    sArr.push(sNode);
  }

  /** @type {SerializableNode<SerializableNode<any>[]>} */
  const sArrNode = {
    type: 'array',
    id: arrId,
    value: sArr,
  };

  wrappers.delete(arr);
  return sArrNode;
}

/**
 * Serializes a function. This function WILL NOT
 * properly serialize stateful functions
 * @param {Function} fn
 * @return {SerializableNode<string>}
 */
function serializeFunction(fn) {
  const nativeId = NATIVE_FORWARD_MAPPING.get(fn);
  if (nativeId) {
    return {
      type: 'native',
      id: nativeId,
    };
  }

  return {
    type: 'function',
    value: fn.toString(),
  };
}

module.exports = {
  serialize,
};

