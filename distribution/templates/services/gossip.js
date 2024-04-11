// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.ServiceCallback<object, object>} ServiceCallback */

const {id} = require('../../util');

/**
 * default subset config parameter
 * @param {any[]} list
 * @return {number} the number of nodes to send via gossip.send
 */
const defaultSubset = (list) => {
  if (list.length <= 1) {
    return list.length;
  }

  return Math.floor(Math.log2(list.length));
};

/**
 * Comm Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const gossip = (config) => {
  const context = {
    gid: config.gid,
    subset: config.subset || defaultSubset,
  };

  /**
   * stupid hack to get around JSDoc errors...
   * @typedef {() => void} VoidFunctionNoArgs */

  return {
    /**
     * Gossip AT method template
     * @param {number} ms
     * @param {VoidFunctionNoArgs} func
     * @param {ServiceCallback} [callback]
     */
    at: (ms, func, callback) => {
      const cb = callback || function() {};
      const intervalId = setInterval(() => {
        func();
        cb(null, intervalId);
      }, ms);
    },

    /**
     * Gossip DEL method template
     * @param {number} intervalId
     * @param {ServiceCallback} callback
     */
    del: (intervalId, callback) => {
      const cb = callback || function() {};
      clearInterval(intervalId);
      cb(null);
    },

    /**
     * Gossip SEND method template
     * @param {any[]} message a list of arguments to the service defined in
     * remote
     * @param {{service: string, method: string}} remote
     * @param {ServiceCallback} [callback]
     */
    send: (message, remote, callback) => {
      const cb = callback || function() {};
      global.distribution.local.groups.get(context.gid, async (e, v) => {
        if (e) {
          cb(e);
          return;
        }

        const group = {...v} || {};
        if (global.senderNode) {
          delete group[id.getNID(global.senderNode)];
        }

        // Determine the number of nodes to send to (n) and select
        // n random nodes by randomizing the nodes in and selecting
        // the first n of the randomized nodes
        const entries = Object.entries(group);
        const numToSend = context.subset(entries);
        const nodes =
          entries.sort(() => 0.5 - Math.random()).slice(0, numToSend);

        const promises = nodes.map(([sid, node]) =>
          new Promise((resolve) => {
            const nodeRemote = {
              node,
              method: 'recv',
              service: 'gossip',
            };
            const remoteMessage = [
              context.gid,
              {ip: global.nodeConfig.ip, port: global.nodeConfig.port},
              message,
              {method: remote.method, service: remote.service},
            ];
            global.distribution.local.comm.send(remoteMessage, nodeRemote,
                (e, v) => {
                  if (e) {
                    resolve({sid, success: false, error: e});
                  } else {
                    resolve({sid, success: true, value: v});
                  }
                });
          }));

        const awaited = await Promise.allSettled(promises);
        const nodesToErrors = {};
        const nodesToValues = {};
        for (const result of awaited) {
          if (result.status === 'rejected') {
            throw new Error(
                `invalid state, the promises in await should not reject:
                ${result.reason}`);
          }
          if (result.value.success) {
            nodesToValues[result.value.sid] = result.value.value;
          } else {
            nodesToErrors[result.value.sid] = result.value.error;
          }
        }

        cb(nodesToErrors, nodesToValues);
      });
    },
  };
};

module.exports = gossip;
