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
      const groupServices = global.distribution.local;
      groupServices.groups.get(context.gid, (e, v) => {
        if (e) {
          cb(e);
          return;
        }

        const realKey = nullableKey === null ? id.getID(value) : nullableKey;
        const nids = Object.values(v).map(n => id.getNID(n));
        const kid = id.getID(realKey);

        const selectedNid = context.hash(kid, nids);
        const node = v[selectedNid.substring(0, 5)];

        const message = [value, {gid: context.gid, key: realKey}];
        const remote = {node, service: 'store', method: 'put'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Store GET method template
     * @param {string | Object | null} nullableKey
     * @param {nullableKey.gid} nullableKey.gid
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

        // ! only for Search Engine
        if (typeof nullableKey === 'object') {
          if ('gid' in nullableKey) {
            const message = [{gid: nullableKey.gid, key: null}];
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

    /**
     * Merge method, only for MR search engine
     * @param {any} value
     * @param {string} nullableKey
     * @param {ServiceCallback} callback
     */
    merge: (value, nullableKey, callback) => {
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
        const remote = {node, service: 'store', method: 'merge'};

        global.distribution.local.comm.send(message, remote, cb);
      });
    },

    /**
     * Store RECONF method
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
          service: 'store',
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

                global.distribution.local.groups.get(context.gid, (e, nodes) => {
                  const currNids = Object.values(nodes).map((n) => id.getNID(n));
                  const currIdxs = prevKids.map((k) => context.hash(k, currNids));
                  const diffCnts = currIdxs.filter((idx, i) => idx != prevIdxs[i]).length;

                  currIdxs.filter((idx, i) => {
                    if (idx != prevIdxs[i]) {
                      const prevNode = group[prevIdxs[i].substring(0, 5)];
                      const currNode = nodes[idx.substring(0, 5)];
                      const message = [{gid: context.gid, key: prevKeys[i]}];
                      const delRemote = {node: prevNode, service: 'store', method: 'del'};
                      const putRemote = {node: currNode, service: 'store', method: 'put'};
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

module.exports = store;
