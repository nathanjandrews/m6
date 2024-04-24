const benchmarkConfig = require('./benchmarkConfig');

/**
 * generates node configs for testing
 * @param {number} numNodes the number of node configs to generate
 * @return {{ip: string, port: number}[]}
 */
function generateNodeConfigs(numNodes) {
  let port = 7110;
  const nodes = [];
  for (let i = 0; i < numNodes; i++) {
    nodes.push({ip: '127.0.0.1', port});
    port++;
  }

  return nodes;
}

module.exports = () => generateNodeConfigs(benchmarkConfig.numNodes);
