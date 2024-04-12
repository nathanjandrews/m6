// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.NodeConfig} NodeConfig */
/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

const http = require('http');
const {serialize, deserialize} = require('../../util/serialization');

const comm = {};

/**
 * Comm SEND method
 * @param {any[]} message a list of arguments to the service defined in remote
 * @param {{node: NodeConfig, service: string, method: string}} remote
 * @param {ServiceCallback} [callback]
 */
comm.send = function(message, remote, callback) {
  const cb = callback || function() {};

  const url = new URL(
      `http://${remote.node.ip}:${remote.node.port}/${remote.service}/${remote.method}`,
  );
  const request = http.request(url, {method: 'PUT'}, (response) => {
    let responseBody = '';
    response.on('data', (chunk) => {
      responseBody += chunk;
    });

    response.on('end', () => {
      const [error, value] = deserialize(responseBody);
      cb(error, value);
    });
  }).on('error', (error) => {
    cb(new Error(error.message));
  });

  request.write(serialize(message));
  request.end();
};

module.exports = comm;
