// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */
/** @typedef {TYPES.ServiceCallback<object, any>} ServiceCallback */

const {id} = require('../../util');

/**
 * Store Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const store = (config) => {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || id.naiveHash,
  };

  return {
    /**
     * Store PUT method template
     * @param {any} value
     * @param {string | null} nullableKey
     * @param {ServiceCallback} [callback]
     */
    put: (value, nullableKey, callback) => {
      const cb = callback || function() {};
      const groupServices = global.distribution[context.gid];
      groupServices.groups.get(context.gid, (e, v) => {
        if (e && Object.keys(e).length > 0) {
          cb(e);
          return;
        }

        const realKey = nullableKey === null ? id.getID(value) : nullableKey;

        const nids = Object.keys(v);
        const kid = id.getID(realKey);

        const selectedNid = context.hash(kid, nids);
        const node = v[selectedNid][selectedNid];

        const message = [value, {gid: context.gid, key: realKey}];
        const remote = {node, service: 'store', method: 'put'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Store GET method template
     * @param {string | null} nullableKey
     * @param {ServiceCallback} [callback]
     */
    get: (nullableKey, callback) => {
      const cb = callback || function() {};
      const groupServices = global.distribution[context.gid];
      groupServices.groups.get(context.gid, (e, v) => {
        if (e && Object.keys(e).length > 0) {
          cb(e);
          return;
        }

        if (nullableKey === null) {
          const message = [{gid: context.gid, key: null}];
          const remote = {service: 'store', method: 'get'};
          groupServices.comm.send(message, remote, (e, v) => {
            const accKeys = [];
            for (const keys of Object.values(v)) {
              accKeys.push(...keys);
            }
            cb({}, accKeys);
          });
          return;
        }

        const nids = Object.keys(v);
        const kid = id.getID(nullableKey);

        const selectedNid = context.hash(kid, nids);
        const node = v[selectedNid][selectedNid];

        const message = [{gid: context.gid, key: nullableKey}];
        const remote = {node, service: 'store', method: 'get'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Mem DEL method template
     * @param {string | null} nullableKey
     * @param {ServiceCallback} [callback]
     */
    del: (nullableKey, callback) => {
      const cb = callback || function() {};
      const groupServices = global.distribution[context.gid];
      groupServices.groups.get(context.gid, (e, v) => {
        if (e && Object.keys(e).length > 0) {
          cb(e);
          return;
        }

        const nids = Object.keys(v);
        const kid = id.getID(nullableKey);

        const selectedNid = context.hash(kid, nids);
        const node = v[selectedNid][selectedNid];

        const message = [{gid: context.gid, key: nullableKey}];
        const remote = {node, service: 'store', method: 'del'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },
  };
};

module.exports = store;
