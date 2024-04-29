// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.ServiceCallback<object, object>} ServiceCallback */

/**
 * Comm Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const comm = (config) => {
  const context = {
    gid: config.gid || 'all',
  };

  return {
    /**
       * Comm SEND method template
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

        /** @type {Record<string, NodeConfig>} */
        const group = v;
        const promises = Object.entries(group).map(([sid, node]) =>
          new Promise((resolve) => {
            const nodeRemote = {
              node,
              method: remote.method,
              service: remote.service,
            };
            global.distribution.local.comm.send(message, nodeRemote, (e, v) => {
              if (e) {
                resolve({sid, success: false, error: e});
              } else {
                resolve({sid, success: true, value: v});
              }
            });
          }),
        );

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

module.exports = comm;
