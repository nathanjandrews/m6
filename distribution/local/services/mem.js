// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

const {id} = require('../../util/');

const mem = {};

/** @type {Map<string | null, Map<any, any>>} */
const memServiceStore = new Map([[null, new Map()]]);

/**
 * Mem PUT method
 * @param {any} value
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
mem.put = function(value, nullableKey, callback) {
  const cb = callback || function() {};

  let groupKey = null;
  let itemKey;
  if (nullableKey === null) {
    itemKey = id.getID(value);
  } else if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  const groupStore = memServiceStore.get(groupKey);
  if (!groupStore) {
    memServiceStore.set(groupKey, new Map([[itemKey, value]]));
    cb(null, value);
    return;
  }

  groupStore.set(itemKey, value);
  cb(null, value);
};

/**
 * Mem GET method
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
mem.get = function(nullableKey, callback) {
  const cb = callback || function() {};
  if (nullableKey === null) {
    const localEntries = memServiceStore.get(null) || new Map();
    cb(null, [...localEntries.keys()]);
    return;
  }

  let groupKey = null;
  let itemKey;
  if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  const groupStore = memServiceStore.get(groupKey);
  if (!groupStore) {
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not have a
      memory store for group "${groupKey}"`));
    return;
  }

  if (itemKey === null) {
    cb(null, [...groupStore.keys()]);
    return;
  }

  if (!groupStore.has(itemKey)) {
    const groupStr = `(group "${groupKey}")`;
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not have a key
        ${JSON.stringify(itemKey)}
        ${groupKey !== null ? groupStr : ''}`));
    return;
  }

  cb(null, groupStore.get(itemKey));
};

/**
 * Mem DEL method
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
mem.del = function(nullableKey, callback) {
  const cb = callback || function() {};

  let groupKey = null;
  let itemKey;
  if (nullableKey === null) {
    itemKey = null;
  } else if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  const groupStore = memServiceStore.get(groupKey);
  if (!groupStore) {
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not have a
      memory store for group "${groupKey}"`));
    return;
  }

  if (itemKey === null) {
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not support
        null item keys in the local.mem.del method`));
    return;
  }

  if (!groupStore.has(itemKey)) {
    const groupStr = `(group "${groupKey}")`;
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not have a key
        ${JSON.stringify(itemKey)}
        ${groupKey !== null ? groupStr : ''}`));
    return;
  }

  const value = groupStore.get(itemKey);
  groupStore.delete(itemKey);
  cb(null, value);
};

global.memServiceStore = memServiceStore;

module.exports = mem;
