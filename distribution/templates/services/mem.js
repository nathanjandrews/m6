// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */
/** @typedef {TYPES.ServiceCallback<object, any>} ServiceCallback */

const {id} = require('../../util');

/**
 * Mem Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const mem = (config) => {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || id.naiveHash,
  };

  return {
    /**
     * Mem PUT method template
     * @param {any} value
     * @param {string | null} nullableKey
     * @param {ServiceCallback} [callback]
     */
    put: (value, nullableKey, callback) => {
      const cb = callback || function() {};

      const nodes = global.groupsServiceMapping.get(context.gid);
      if (!nodes) {
        cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not have a
          memory store for group "${context.gid}"`));
        return;
      }

      const realKey = nullableKey === null ? id.getID(value) : nullableKey;

      const nids = Object.values(nodes).map((n) => id.getNID(n));
      const kid = id.getID(realKey);

      const selectedNid = context.hash(kid, nids);
      const node = nodes[selectedNid.substring(0, 5)];

      const message = [value, {gid: context.gid, key: realKey}];
      const remote = {node, service: 'mem', method: 'put'};

      global.distribution.local.comm.send(message, remote, cb);
    },

    /**
     * Mem GET method template
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
          const remote = {service: 'mem', method: 'get'};
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
        const remote = {node, service: 'mem', method: 'get'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Mem DEL method
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
        const remote = {node, service: 'mem', method: 'del'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Mem RECONF method
     * @param {Object} group - old group and its nodes
     * @param {Object} group.sid
     * @param {string} group.sid.ip
     * @param {number} group.sid.port
     * @param {ServiceCallback} callback
     */
    reconf: (group, callback) => {
      let prevCnt = 0;
      let diffCnt = 0;
      const prevKeys = [];
      Object.values(group).map((node) => {
        const getRemote = {
          service: 'mem',
          method: 'get',
          node: node,
        };
        global.distribution.local.comm.send(
            [{key: null, gid: context.gid}],
            getRemote,
            (e, keys) => {
              prevCnt++;
              prevKeys.push(...keys);
              if (prevCnt == Object.keys(group).length) {
                const prevKids = prevKeys.map((k) => id.getID(k));
                const prevNids = Object.values(group).map((n) => id.getNID(n));
                const prevIdxs = prevKids.map((k) => context.hash(k, prevNids));

                global.distribution.local.groups.get(context.gid, (e, node) => {
                  const currNids = Object.values(node).map((n) => id.getNID(n));
                  const currIdxs = prevKids.map((k) => context.hash(k, currNids));
                  const diffCnts = currIdxs.filter((idx, i) => idx != prevIdxs[i]).length;

                  currIdxs.filter((idx, i) => {
                    if (idx != prevIdxs[i]) {
                      const prevNode = group[prevIdxs[i].substring(0, 5)];
                      const currNode = node[idx.substring(0, 5)];
                      const message = [{gid: context.gid, key: prevKeys[i]}];
                      const delRemote = {node: prevNode, service: 'mem', method: 'del'};
                      const putRemote = {node: currNode, service: 'mem', method: 'put'};
                      global.distribution.local.comm.send(message, delRemote, (e, v) => {
                        global.distribution.local.comm.send([v, message[0]], putRemote, (e, v) => {
                          diffCnt++;
                          if (diffCnt == diffCnts) {
                            callback();
                          }
                        });
                      });
                    }
                  });
                });
              }
            },
        );
      });
    },
  };
};

module.exports = mem;
