// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

const {id} = require('../../util');

const gossip = {};

global.gossipReceivedMessageHashes = new Set();

function hashInput(node, message, remote) {
  return id.getID([node, message, remote]);
}


/**
 * Gossip RECV method
 * @param {string} gid the target group ID received from the sending node
 * @param {NodeConfig} node the node configuration of the sending node
 * @param {any[]} message the arguments to the service specified in remote
 * @param {{service: string, method: string}} remote
 * @param {ServiceCallback} [callback] a callback
 */
gossip.recv = function(gid, node, message, remote, callback) {
  const cb = callback || function() {};
  global.senderNode = node;


  const hash = hashInput(node, message, remote);
  if (global.gossipReceivedMessageHashes.has(hash)) {
    // if the hash is already contained in the set, meaning that the message
    // was already received, then do nothing
    return;
  }

  // at this point we know the input is new, so add the hash to the set
  global.gossipReceivedMessageHashes.add(hash);

  global.distribution.local.comm
      .send(message, {node: global.nodeConfig, ...remote}, cb);

  const groupServices = global.distribution[gid];
  if (!groupServices) {
    // if this node has no services for the provided group, then do nothing
    cb(new Error(`current node ${JSON.stringify(global.nodeConfig)} does not
        have group "${gid}"`));
    return;
  }

  groupServices.gossip.send(message, remote);
};

module.exports = gossip;
