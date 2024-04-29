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
const status = (config) => {
  const context = {
    gid: config.gid || 'all',
  };

  return {
    /**
       * Status GET method template
       * @param {any} key the name of the value to retrieve
       * @param {ServiceCallback} [callback] a callback
       */
    get: (key, callback) => {
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([key], {service: 'status', method: 'get'}, callback);
    },

    /**
       * Status STOP method template
       * @param {ServiceCallback} [callback] a callback
       */
    stop: (callback) => {
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send([], {service: 'status', method: 'stop'}, callback);
    },

    /** Status SPAWN method template
       * @param {NodeConfig} config
       * @param {ServiceCallback} [callback]
      */
    spawn: (config, callback) => {
      const cb = callback || function() {};
      const groupServices = global.distribution[context.gid];
      groupServices.groups.add(context.gid, config);
      global.distribution.local.status
          .spawn(config, () => cb(null, config));
    },
  };
};

module.exports = status;
