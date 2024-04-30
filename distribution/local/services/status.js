// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */
/** @typedef {TYPES.NodeConfig} NodeConfig */

const {wire, serialize, id} = require('../../util');
const {spawn} = require('node:child_process');
const path = require('node:path');
const status = {};

global.statusServiceState = {
  sid: id.getSID(global.nodeConfig),
  nid: id.getNID(global.nodeConfig),
  counts: 0,
};

/**
 * Status GET method
 * @param {any} key the name of the value to retrieve
 * @param {ServiceCallback} [callback] a callback
 */
status.get = function(key, callback) {
  const cb = callback || function() {};

  if (key in global.nodeConfig) {
    cb(null, global.nodeConfig[key]);
  } else if (key in global.statusServiceState) {
    cb(null, global.statusServiceState[key]);
  } else if (key === 'heapTotal') {
    cb(null, process.memoryUsage().heapTotal);
  } else if (key === 'heapUsed') {
    cb(null, process.memoryUsage().heapUsed);
  } else {
    cb(new Error('Status key not found'));
  }
};

/**
 * Status STOP method
 * @param {ServiceCallback} [callback] a callback
 */
status.stop = function(callback) {
  const timeout = 10;
  const cb = callback || function() {};
  if (!(global.server.close && typeof global.server.close === 'function')) {
    cb(new Error('unable to close server, forcing server shutdown...'));
    setTimeout(() => process.exit(1), timeout);
    return;
  }

  setTimeout(() => {
    cb(null, {ip: global.nodeConfig.ip, port: global.nodeConfig.port});
    global.server.close();
    process.exit(0);
  }, timeout);
};

/**
 * Status SPAWN method
 * @param {NodeConfig} config
 * @param {ServiceCallback} [callback]
 */
status.spawn = function(config, callback) {
  if (!config.onStart) {
    const cb = callback || function() {};
    // @ts-ignore
    config.onStart = wire.createRPC(cb);
  } else {
    const functionBodyString =
      `
      const onStart = ${config.onStart.toString()};
      const callbackRPC = ${wire.createRPC(wire.toAsync(callback)).toString()};
      onStart();
      callbackRPC(null, global.nodeConfig, () => {});
      `;
    // @ts-ignore
    config.onStart = new Function(functionBodyString);
  }

  spawn('node', [
    path.join(__dirname, '../../../distribution.js'),
    '--config',
    serialize(config),
  ]);
};


module.exports = status;
