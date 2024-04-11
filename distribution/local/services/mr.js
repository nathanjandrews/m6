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

  // each promise in this array will
  const mapPromises = keys.map((key) => new Promise((resolve, reject) => {
    memStore.get({gid: context.gid, key}, (e, v) => {
      if (e) {
        reject(e);
      } else {
        resolve(mapFn(key, v));
      }
    });
  }));

  const settledMapPromises = await Promise.allSettled(mapPromises);
  const mapResults = [];
  for (const settledPromise of settledMapPromises) {
    if (settledPromise.status === 'fulfilled') {
      mapResults.push(settledPromise.value);
    }
  }

  const mr = global.routesServiceStore[context.serviceName];
  mr.storageKey = keys.join('~');
  memStore.put(
      mapResults.flat(),
      {gid: context.gid, key: mr.storageKey},
      () => cb(null, true));
};

/**
 * This function groups and shuffles the mapped result (stored locally), and
 * sends the grouped/shuffled result to the proper node for the reduce phase
 * @param {LocalMapReduceContext} context
 * @param {HashFn} hash
 * @param {ServiceCallback} [callback]
 */
mr.shuffle = (context, hash, callback) => {
  const cb = callback || function() {};
  const memStore = global.distribution.local[context.memory ? 'mem' : 'store'];

  const key = global.routesServiceStore[context.serviceName].storageKey;
  memStore.get({gid: context.gid, key}, async (e, v) => {
    /** @type {any[]} */
    const mappedValues = v;

    // checking to make sure ALL mapped values have the correct shape
    for (const value of mappedValues) {
      if (Object.entries(value).length !== 1) {
        cb(new Error(`expected objects with one entry but instead got an object
          with ${Object.entries(value).length} entries:
          ${global.distribution.util.serialize(value)}`));
        return;
      }
    }

    // each of this promises will "shuffle" its data. This means that each node
    // will select a "grouping" node to send values with identical keys. The
    // grouping node will then send a response once it has successfully ran
    // its group() service on the received data.
    const groupPhasePromises =
      mappedValues.map((mappedValue) => new Promise((resolve, reject) => {
        const key = Object.keys(mappedValue)[0];
        const value = Object.values(mappedValue)[0];

        const nodes = global.groupsServiceMapping.get(context.gid);
        if (!nodes) {
          reject(new Error(`node ${JSON.stringify(global.nodeConfig)} does not
          have a memory store for group "${context.gid}"`));
          return;
        }

        // determine the grouping node via hashing
        const nids = Object.values(nodes).map((n) =>
          (global.distribution.util.id.getNID(n)));
        const selectedNid = hash(key, nids);
        const node = nodes[selectedNid.substring(0, 5)];

        const message = [context, key, value];
        const remote = {
          node,
          service: context.serviceName,
          method: 'group',
        };

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
  });
};

/**
 * This function receives values with identical keys from shuffle() and groups
 * those values for the reduce phase.
 * @param {LocalMapReduceContext} context
 * @param {string} key
 * @param {any} value
 * @param {ServiceCallback} [callback]
 */
mr.group = (context, key, value, callback) => {
  const cb = callback || function() {};
  const mr = global.routesServiceStore[context.serviceName];

  if (!mr.reduceState) {
    mr.reduceState = {};
    mr.reduceState.values = {};
  }

  if (!mr.reduceState.values[key]) {
    mr.reduceState.values[key] = [];
  }

  const valuesToReduce = mr.reduceState.values[key];
  valuesToReduce.push(value);

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
  cb(null, reductions);
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
