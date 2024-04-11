// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */
/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

/**
 * Comm Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const groups = (config) => {
  const context = {
    gid: config.gid || 'all',
  };

  return {
    /**
       * Groups PUT method
       * @param {string | {gid: string}} gid the group id
       * @param {Record<string, NodeConfig>} nodes
       * @param {ServiceCallback} [callback] a callback
       */
    put: (gid, nodes, callback) => {
      const cb = callback || function() {};
      const realGid = unpackGID(gid);
      if (!realGid) {
        cb(new Error(`invalid input: expected object with "gid" field,
              instead got ${JSON.stringify(gid)}`));
        return;
      }
      global.distribution.local.groups.put(realGid, nodes);
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([realGid, nodes], {service: 'groups', method: 'put'}, callback);
    },

    /**
       * Groups GET method
       * @param {string} gid the group id
       * @param {ServiceCallback} [callback] a callback
       */
    get: (gid, callback) => {
      const cb = callback || function() {};
      const realGid = unpackGID(gid);
      if (!realGid) {
        cb(new Error(`invalid input: expected object with "gid" field,
              instead got ${JSON.stringify(gid)}`));
        return;
      }
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([realGid], {service: 'groups', method: 'get'}, callback);
    },

    /**
       * Groups DEL method template
       * @param {string} gid the group id
       * @param {ServiceCallback} [callback] a callback
       */
    del: (gid, callback) => {
      const cb = callback || function() {};
      const realGid = unpackGID(gid);
      if (!realGid) {
        cb(new Error(`invalid input: expected object with "gid" field,
              instead got ${JSON.stringify(gid)}`));
        return;
      }
      global.distribution.local.groups.del(realGid);
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([realGid], {service: 'groups', method: 'del'}, callback);
    },

    /**
       * Groups ADD method template
       * @param {string} gid the group id
       * @param {NodeConfig} config a node config to add to the group
       * @param {ServiceCallback} [callback] a callback
       */
    add: (gid, config, callback) => {
      const cb = callback || function() {};
      const realGid = unpackGID(gid);
      if (!realGid) {
        cb(new Error(`invalid input: expected object with "gid" field,
              instead got ${JSON.stringify(gid)}`));
        return;
      }
      global.distribution.local.groups.add(gid, config);
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([gid, config], {service: 'groups', method: 'add'}, callback);
    },

    /**
       * Groups REM method template
       * @param {string} gid the group id
       * @param {string} nodeSID an SID for the node to remove
       * @param {ServiceCallback} [callback] a callback
       */
    rem: (gid, nodeSID, callback) => {
      const cb = callback || function() {};
      const realGid = unpackGID(gid);
      if (!realGid) {
        cb(new Error(`invalid input: expected object with "gid" field,
              instead got ${JSON.stringify(gid)}`));
        return;
      }
      global.distribution.local.groups.rem(gid, nodeSID);
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([gid, nodeSID], {service: 'groups', method: 'rem'}, callback);
    },
  };
};

module.exports = groups;

/**
 * return the gid as a string from either a string, or an object containing a
 * "gid" field
 * @param {string | {gid: string}} gid the group id
 * @return {string | undefined}
 */
function unpackGID(gid) {
  if (typeof gid === 'string') {
    return gid;
  }

  if (gid.gid) {
    return gid.gid;
  }
}
