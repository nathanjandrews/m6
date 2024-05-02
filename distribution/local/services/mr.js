// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.HashFn} HashFn */
/** @typedef {TYPES.ServiceCallback<any, any>} ServiceCallback */
/** @typedef {TYPES.MapReduceMapFn<any>} MapReduceMapFn */
/** @typedef {TYPES.MapReduceReduceFn<any>} MapReduceReduceFn */
/** @typedef {TYPES.LocalMapReduceContext} LocalMapReduceContext */

/**
 * This local Map-Reduce service SHOULD NOT be instantiated with the node.
 * This mr service should be instantiated during the setup phase of the
 * distributed Map-Reduce service in the exec() method
 */
const mr = {};

/**
 * This function maps over all the objects given by keys (skipping ones that do
 * not exist on this node) with the given mapFn. The resulting array is returned
 * to the caller via the callback parameter
 * @param {LocalMapReduceContext} context
 * @param {string[]} keys
 * @param {MapReduceMapFn} mapFn
 * @param {ServiceCallback} [callback]
 */
mr.map = async (context, keys, mapFn, callback) => {
  const cb = callback || function() {};
  const memStore = global.distribution.local[context.memory ? 'mem' : 'store'];

  const storeKeys = [];
  // each promise in this array will
  const mapPromises = keys.map(
      (key) =>
        new Promise((resolve, reject) => {
          memStore.get({gid: context.loadGid, key}, (e, v) => {
            if (e) {
              reject(e);
            } else {
              storeKeys.push(key);
              const res = mapFn(key, v);
              resolve({[key]: res});
            }
          });
        }),
  );
  const settledMapPromises = await Promise.allSettled(mapPromises);
  const mapResults = [];
  for (const settledPromise of settledMapPromises) {
    if (settledPromise.status === 'fulfilled') {
      mapResults.push(settledPromise.value);
    } else {
      if (!settledPromise.reason.message.includes('no such file')) {
        console.log('[map error]:', settledPromise.reason);
      }
    }
  }

  console.log('[mapper tasks count]: ', mapResults.length);
  if (mapResults.length === 0) {
    cb(null, true);
    return;
  }
  const mr = global.routesServiceStore[context.serviceName];
  if (context.compact) {
    mr.storageKey = keys.map((k) => k.slice(0, 2)).join('~');
    // mr.storageKey = 'mr-compact';
    memStore.put(
        mapResults.map((res) => Object.values(res)[0]).flat(),
        {gid: context.storeGid, key: mr.storageKey},
        () => cb(null, true),
    );
  } else {
    mr.storageKey = storeKeys;
    let cnt = 0;
    mapResults.map((res) => {
      memStore.put(
          Object.values(res)[0],
          {gid: context.storeGid, key: Object.keys(res)[0]},
          (e, v) => {
            cnt++;
            if (cnt === storeKeys.length) {
              cb(null, true);
            }
          },
      );
    });
  }
};

/**
 * This function groups and shuffles the mapped result (stored locally), and
 * sends the grouped/shuffled result to the proper node for the reduce phase
 * @param {LocalMapReduceContext} context
 * @param {string[]} keys
 * @param {HashFn} hash
 * @param {ServiceCallback} [callback]
 */
mr.shuffle = async (context, keys, hash, callback) => {
  const cb = callback || function() {};
  const memStore = global.distribution.local[context.memory ? 'mem' : 'store'];

  // TODO: handle non-compat data retrieval in the shuffle phase
  if (context.noShuffle) {
    cb(new Error('compact not yet supported in shuffle phase'));
    return;
  }

  const key = global.routesServiceStore[context.serviceName].storageKey;
  if (key === undefined) {
    callback(null, true);
    return;
  }
  /**
   * These are the results of calling the map function on data sent to this
   * node during the map phase
   * @type {any[]} */
  const mapResults = await new Promise((resolve, reject) => {
    if (Array.isArray(key)) {
      key.map((k) => {
        memStore.get({gid: context.storeGid, key: k}, (e, v) => {
          if (e) {
            reject(e);
          } else {
            resolve(v);
          }
        });
      });
    } else {
      memStore.get({gid: context.storeGid, key}, (e, v) => {
        if (e) {
          reject(e);
        } else {
          resolve(v);
        }
      });
    }
  });

  // we transform the mapped data into key value pairs, each of which can be
  // sent to a different node for grouping
  const objectsToShuffle = [];
  for (const value of mapResults) {
    for (const [k, v] of Object.entries(value)) {
      objectsToShuffle.push({key: k, value: v});
    }
  }

  // we now want to get all of the nodes that could be receivers of data for
  // the group phase
  const nodes = global.groupsServiceMapping.get(context.gid);
  if (!nodes) {
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not
          have a memory store for group "${context.gid}"`));
    return;
  }
  const nids = Object.values(nodes).map((n) =>
    (global.distribution.util.id.getNID(n)));

  // now we combine all of the data that is meant to be sent to each node to
  // reduce the number of HTTP messages sent over the network. This change was
  // made in attempt to stop ECONNRESET error which are hypothesized to occur
  // due to heavy network traffic
  const nodesReceivers = new Map();
  for (const {key, value} of objectsToShuffle) {
    const selectedSid = hash(key, nids).substring(0, 5);
    const node = nodes[selectedSid];
    const receiver = nodesReceivers.get(selectedSid);
    if (receiver) {
      receiver.kvPairs.push({key, value});
    } else {
      nodesReceivers.set(selectedSid, {
        node,
        kvPairs: [{key, value}],
      });
    }
  }

  // each of this promises will "shuffle" its data. This means that each node
  // will select a "grouping" node to send values with identical keys. The
  // grouping node will then send a response once it has successfully ran
  // its group() service on the received data.
  const groupPhasePromises =
      [...nodesReceivers.values()].map(({node, kvPairs}) => new Promise((resolve, reject) => {
        const remote = {
          node,
          service: context.serviceName,
          method: 'group',
        };
        const message = [
          context,
          kvPairs,
        ];
        global.distribution.local.comm.send(message, remote, (e, v) => {
          if (e) {
            reject(e);
          } else {
            resolve(v);
          }
        });
      }));

  try {
    await Promise.all(groupPhasePromises);
    cb(null, true);
  } catch (e) {
    cb(new Error(e));
  }
};

/**
 * This function receives values with identical keys from shuffle() and groups
 * those values for the reduce phase.
 * @param {LocalMapReduceContext} context
 * @param {{key: string, value: any}[]} kvPairs
 * @param {ServiceCallback} [callback]
 */
mr.group = (context, kvPairs, callback) => {
  const cb = callback || function() {};
  const mr = global.routesServiceStore[context.serviceName];

  mr.reduceState = mr.reduceState || {};
  mr.reduceState.values = mr.reduceState.values || {};

  for (const {key, value} of kvPairs) {
    mr.reduceState.values[key] = mr.reduceState.values[key] || [];
    mr.reduceState.values[key].push(value);
  }

  cb(null, true);
};

/**
 * This function reduces the values received from group()
 * @param {LocalMapReduceContext} context
 * @param {MapReduceReduceFn} reduceFn
 * @param {ServiceCallback} [callback]
 */
mr.reduce = (context, reduceFn, callback) => {
  const cb = callback || function() {};
  const mr = global.routesServiceStore[context.serviceName];
  const reductions = [];

  if (!mr.reduceState) {
    cb(null, []);
    return;
  }

  if (!mr.reduceState.values) {
    cb(null, []);
    return;
  }

  for (const [key, valuesToReduce] of Object.entries(mr.reduceState.values)) {
    reductions.push(reduceFn(key, valuesToReduce));
  }
  if (context.reduceStore) {
    let cnt = 0;
    for (const reduction of reductions) {
      global.distribution[context.storeGid].store.merge(
          Object.values(reduction)[0],
          Object.keys(reduction)[0],
          (e, v) => {
            cnt++;
            if (cnt === reductions.length) {
              cb(null, reductions);
            }
          },
      );
    }
  } else {
    cb(null, reductions);
  }
};

/**
 * This function cleans up and deletes this dynamic mr service from the
 * distribution object
 * @param {LocalMapReduceContext} context
 * @param {ServiceCallback} [callback]
 */
mr.cleanup = (context, callback) => {
  const cb = callback || function() {};
  const memStore = global.distribution.local[context.memory ? 'mem' : 'store'];

  if (mr.storageKey) {
    memStore.del(mr.storageKey, () => {
      global.distribution.local.routes.del(
          context.serviceName,
          () => cb(null, true));
    });
  } else {
    global.distribution.local.routes.del(
        context.serviceName,
        () => cb(null, true));
  }
};

module.exports = mr;
