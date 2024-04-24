global.nodeConfig = {ip: '127.0.0.1', port: 7070};
const {mapReduce, run} = require('./benchmark-utils');
const {indexingMap, indexingReduce} = require('../distribution/workflows/indexing/indexing');
const generateNodeConfigs = require('./benchmark-utils/nodes');

/*
   This hack is necessary since we can not
   gracefully stop the local listening node.
   The process that node is
   running in is the actual jest process
*/
let localServer = null;

// ! NOTE: The local node will be the orchestrator.

const nodes = generateNodeConfigs();

async function benchmark(keys) {
  return await mapReduce({
    keys,
    map: indexingMap,
    reduce: indexingReduce,
    memory: false, // memory MUST be false for these benchmarks
    compact: true, // compact MUST be true for these benchmarks
  });
}

run('benchmark 100 urls', benchmark, {
  numUrls: 100,
  localServer,
  nodes,
});
