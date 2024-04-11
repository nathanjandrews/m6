// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {Map<string, Record<string, NodeConfig>>} GroupsToNodeMapping */
/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

/**
 * Comm Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const routes = (config) => {
  const context = {
    gid: config.gid || 'all',
  };

  return {
    /**
     * Routes PUT method template
     * @param {object} service
     * @param {string} serviceName
     * @param {ServiceCallback} [callback]
     */
    put: (service, serviceName, callback) => {
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send(
              [service, serviceName],
              {service: 'routes', method: 'put'},
              callback);
    },

    /**
     * Routes DEL method template
     * @param {string} serviceName the name of the service to delete
     * @param {ServiceCallback} [callback]
     */
    del: (serviceName, callback) => {
      const groupServices = global.distribution[context.gid];
      groupServices.comm
          .send(
              [serviceName],
              {service: 'routes', method: 'del'},
              callback);
    },
  };
};

module.exports = routes;
