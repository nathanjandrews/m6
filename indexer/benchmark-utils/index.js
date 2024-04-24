// eslint-disable-next-line no-unused-vars
const TYPES = require('../../distribution/util/types');

const distribution = require('../../distribution');
const {id} = require('../../distribution/util');
const groupsTemplate = require('../../distribution/all/groups');

const {performance} = require('perf_hooks');
const {getUrlPages} = require('./crawl');

/**
 * Node Configurations
 * @param {TYPES.NodeConfig[]} nodes a list of nodes to spawn and add to the
 * group
 * @return {Promise<object>} an object that contains the group of nodes and
 * the local server
 */
async function setupBenchmark(nodes) {
  const group = {};
  // async function for starting nodes
  const startNodes = async (callback) => {
    const cb = callback || function() {};
    const spawnPromises = nodes.map((node) => new Promise((resolve) => {
      distribution.local.status.spawn(node, () => resolve(null));
    }) );
    await Promise.allSettled(spawnPromises);
    cb();
  };

  for (const node of nodes) {
    group[id.getSID(node)] = node;
  }

  const localServer = await new Promise((resolve) => {
    distribution.node.start((server) => resolve(server));
  });

  await startNodes();

  const groupConfig = {gid: 'benchmarkGroup'};
  groupsTemplate(groupConfig).put(groupConfig, group, () => {});

  return localServer;
}

/**
 *
 * @param {object} localServer the local server
 * @param {TYPES.NodeConfig[]} nodes the nodes in the group
 */
async function teardownBenchmark(localServer, nodes) {
  const stopPromises = nodes.map((node) => new Promise((resolve) => {
    distribution.local.comm.send(
        [],
        {service: 'status', method: 'stop', node},
        () => resolve(null),
    );
  }));
  await Promise.allSettled(stopPromises);
  localServer.close();
}

/**
 * Array of data to store in a distributed fashion
 * @param {{key: string, value: any}[]} data
 */
async function storeData(data) {
  const putPromises = data.map((datum) => new Promise((resolve, reject) => {
    distribution.benchmarkGroup.store.put(datum.value, datum.key, (e) => {
      if (e && Object.keys(e).length > 0) {
        reject(e);
      } else {
        resolve(true);
      }
    });
  }));

  await Promise.allSettled(putPromises);
}

/**
 * gets the keys of the data store in the group
 * @return {Promise<string[]>}
 */
async function getDatasetKeys() {
  return await new Promise((resolve, reject) => {
    distribution.benchmarkGroup.store.get(null, (e, v) => {
      if (Object.keys(e).length > 0) {
        reject(e);
      } else {
        resolve(v);
      }
    });
  });
}

async function mapReduce(config) {
  return await new Promise((resolve, reject) => {
    distribution.benchmarkGroup.mr.exec(config, (e, v) => {
      if (e && Object.keys(e).length > 0) {
        reject(e);
      } else {
        resolve(v);
      }
    });
  });
}

// eslint-disable-next-line valid-jsdoc
/**
 * Runs the benchmark and prints the time taken to standard output
 * @param {string} benchmarkName
 * @param {function(string[]): Promise<any[]>} benchmarkFn
 * @param {{
 *  localServer: object,
 *  nodes: TYPES.NodeConfig[],
 *  numUrls: 1 | 10 | 100 | 1000 | 10000 | 100000,
 * }} runConfig
 */
async function run(benchmarkName, benchmarkFn, runConfig) {
  let teardown = false;
  try {
    const localServer = await setupBenchmark(runConfig.nodes);
    runConfig.localServer = localServer;
    const dataset = getUrlPages(runConfig.numUrls);
    await storeData(dataset);
    const keys = await getDatasetKeys();
    if (keys.length !== runConfig.numUrls) {
      throw new Error(`unable to store all keys. Expected
        ${runConfig.numUrls} keys but instead got ${keys.length} keys`);
    }
    const start = performance.now();
    const reductions = await benchmarkFn(keys);
    const end = performance.now();
    await teardownBenchmark(runConfig.localServer, runConfig.nodes);
    teardown = true;
    console.log(`${benchmarkName} - reductions:`, reductions);
    console.log(`${benchmarkName} - time: ${end - start}`);
  } catch (e) {
    console.error(`${benchmarkName} - ERROR:`, e);
    if (!teardown) {
      await teardownBenchmark(runConfig.localServer, runConfig.nodes);
    }
  }
}

module.exports = {
  setupBenchmark,
  teardownBenchmark,
  storeData,
  getDatasetKeys,
  mapReduce,
  run,
};

