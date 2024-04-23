const fs = require('fs');
const path = require('path');
const urlPath = path.join(__dirname, 'datasets.txt');
const { performance } = require('perf_hooks');

const data = fs.readFileSync(urlPath, 'utf8');
const dataset = data.split('\n');

global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');

const args = process.argv.slice(2);
const nodesPath = args.includes('dev') ? './ec2-nodes.json' : './nodes.json';
const nodes = require(nodesPath);

const crawlerGroup = {};
for (const node of nodes) {
  crawlerGroup[id.getSID(node)] = node;
}

const groupConfig = { gid: 'crawler', hash: id.consistentHash };
groups(groupConfig).put(groupConfig, crawlerGroup, (e, v) => {
  let cnt = 0;
  for (const node of nodes) {
    distribution.crawler.groups.add('crawler', node, (e, v) => {
      cnt++;
      if (cnt === nodes.length) {
        loadUrls();
      }
    });
  }
});

const loadUrls = () => {
  let cntr = 0;
  const startTime = performance.now();
  // We send the dataset to the cluster
  dataset.forEach((url) => {
    distribution.crawler.store.put(url, url, (e, v) => {
      cntr++;
      // Once we are done, run the map reduce
      if (cntr === dataset.length) {
        const endTime = performance.now();
        const procedureTime = endTime - startTime;
        console.log(
          '[loader] \ncount of nodes:',
          Object.keys(crawlerGroup).length,
          '\ncount of urls:',
          dataset.length,
          '\nprocedure time:',
          procedureTime.toFixed(4),
          'milliseconds',
        );
        graceShutDown();
      }
    });
  });
};

const graceShutDown = () => {
  process.exit(0);
};
