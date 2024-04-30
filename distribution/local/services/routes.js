// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

const routes = {};

/**
 * Routes GET method
 * @param {string} serviceName
 * @param {ServiceCallback} [callback]
 */
routes.get = function(serviceName, callback) {
  const cb = callback || function() {};
  const service = global.routesServiceStore[serviceName];
  if (service) {
    cb(null, service);
    return;
  }

  if (serviceName === 'rpc') {
    cb(null, global.rpc);
    return;
  }

  cb(new Error(`unknown service "${serviceName}"`));
};

/**
 * Routes PUT method
 * @param {object} service
 * @param {string} serviceName
 * @param {ServiceCallback} [callback]
 */
routes.put = function(service, serviceName, callback) {
  const cb = callback || function() {};
  global.routesServiceStore[serviceName] = service;
  cb(null, true);
};

/**
 * Routes DEL methods
 * @param {string} serviceName
 * @param {ServiceCallback} [callback]
 */
routes.del = function(serviceName, callback) {
  const cb = callback || function() {};
  if (global.routeServiceStore[serviceName]) {
    // ! This enables the deletion of provided services (comm, gossip, etc)
    // ! May need to add a guard around these provided services
    delete global.routeServiceStore[serviceName];
    cb(null, true);
  } else {
    cb(null, false);
  }
};

global.routesServiceStore = {
  status: require('./status'),
  comm: require('./comm'),
  groups: require('./groups'),
  gossip: require('./gossip'),
  mem: require('./mem'),
  store: require('./store'),
  routes,
};

module.exports = routes;
