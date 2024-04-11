const {serialize, deserialize} = require('./serialization');
const id = require('./id');

global.rpc = {};

/**
 * create a RPC stub on this node for other nodes to call
 * @param {Function} func
 * @return {Function}
 */
function createRPC(func) {
  // the function passed to createRPC should be called on the current node

  // create and return an RPC stub.
  // The RPC stub contains placeholders __NODE_INFO__ and __METHOD_ID__.
  //
  // This stub will be serialized and sent to a node which will call the RPC.
  //
  // In the node's SERIALIZED FORM, the placeholders will be replaced with the
  // proper remote values AS STRINGS. This means that when the node is
  // deserialized, the deserialized value will contain a proper NodeConfig as
  // well as a proper method name.
  const fp = id.getRID();
  const stub = function(...args) {
    const remote = {
      node: '__NODE_INFO__',
      service: 'rpc',
      method: '__METHOD_ID__',
    };

    const callback = args.pop() || function() {};

    // @ts-ignore
    global.distribution.local.comm.send(args, remote, callback);
  };

  const nodeConfigLiteral = JSON.stringify(global.nodeConfig)
      .replace(/\"/g, '\'');

  const serializedStub = serialize(stub)
      .replace('\'__NODE_INFO__\'', nodeConfigLiteral)
      .replace('\'__METHOD_ID__\'', `'${fp}'`);

  // add the function to some service that can be called by remote nodes
  global.rpc[fp] = func;

  // return the deserialized function with the proper values
  return deserialize(serializedStub);
}

/*
    The toAsync function converts a synchronous function that returns a value
    to one that takes a callback as its last argument and returns the value
    to the callback.
*/
function toAsync(func) {
  return function(...args) {
    const callback = args.pop() || function() {};
    try {
      const result = func(...args);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  };
}

module.exports = {
  createRPC: createRPC,
  toAsync: toAsync,
};
