// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/**
 * @template T
 * @typedef {TYPES.ServiceCallback<Error, T>} ServiceCallback<T> */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */

const id = require('../../util/id');
const templates = require('../../templates');

const groups = {};

/** @type {GroupsToNodeMapping} */
const groupsToNodes = new Map();

/**
 * Groups PUT method
 * @param {string} gid the group id
 * @param {Record<string, NodeConfig>} nodes
 * @param {ServiceCallback<Record<string, NodeConfig>>} [callback] a callback
 */
groups.put = function(gid, nodes, callback) {
  const cb = callback || function() {};
  groupsToNodes.set(gid, nodes);
  global.distribution[gid] = {};
  for (const [serviceName, template] of Object.entries(templates)) {
    global.distribution[gid][serviceName] = template({gid});
  }
  cb(null, nodes);
};

/**
 * Groups GET method
 * @param {string} gid the group id
 * @param {ServiceCallback<Record<string, NodeConfig>>} [callback] a callback
 */
groups.get = function(gid, callback) {
  const cb = callback || function() {};
  const group = groupsToNodes.get(gid);
  if (!group) {
    cb(new Error(`group "${gid}" does not exist`));
    return;
  }
  cb(null, group);
};

/**
 * Groups DEL method
 * @param {string} gid the group id
 * @param {ServiceCallback<Record<string, NodeConfig>>} [callback] a callback
 */
groups.del = function(gid, callback) {
  const cb = callback || function() {};
  const group = groupsToNodes.get(gid);
  if (!group) {
    cb(new Error(`group "${gid}" does not exist`));
    return;
  }

  groupsToNodes.delete(gid);
  delete global.distribution[gid];

  cb(null, group);
};

/**
 * Groups ADD method
 * @param {string} gid the group id
 * @param {NodeConfig} config a node config to add to the group
 * @param {ServiceCallback<string>} [callback] a callback
 */
groups.add = function(gid, config, callback) {
  const cb = callback || function() {};
  const group = groupsToNodes.get(gid);
  if (!group) {
    cb(new Error(`group "${gid} does not exist"`));
    return;
  }

  const sid = id.getSID(config);
  group[sid] = config;

  cb(null, sid);
};

/**
 * Groups REM method
 * @param {string} gid the group id
 * @param {string} nodeSID an SID for the node to remove
 * @param {ServiceCallback<NodeConfig>} [callback] a callback
 */
groups.rem = function(gid, nodeSID, callback) {
  const cb = callback || function() {};
  const group = groupsToNodes.get(gid);
  if (!group) {
    cb(new Error(`group "${gid}" does not exist`));
    return;
  }

  if (!Reflect.has(group, nodeSID)) {
    cb(new Error(`node ${nodeSID} does not exist in group ${gid}`));
    return;
  }

  const node = group[nodeSID];
  delete group[nodeSID];

  cb(null, node);
};

// enable the local mapping to be available globally
global.groupsServiceMapping = groupsToNodes;

module.exports = groups;
