const fs = require('fs');
const path = require('path');
const args = require('yargs').argv;
const {performance} = require('perf_hooks');

global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');

const nodesPath = args.env === 'dev' ? '../ec2-nodes.json' : '../nodes.json';
const nodes = require(nodesPath);

const urlsCnt = args.urls || 1000;
const datasetsUrl = `datasets-${urlsCnt}.txt`;
const urlPath = path.join(__dirname, datasetsUrl);
const data = fs.readFileSync(urlPath, 'utf8');
const dataset = data.split('\n');

const crawlerGroup = {};
for (const node of nodes) {
  crawlerGroup[id.getSID(node)] = node;
}

const groupConfig = {gid: 'crawler', hash: id.consistentHash};
groups(groupConfig).put(groupConfig, crawlerGroup, (e, v) => {
  loadUrls();
});

const loadUrls = () => {
  let cntr = 0;
  const startTime = performance.now();
  dataset.forEach((url) => {
    distribution.crawler.store.put(url, url, (e, v) => {
      cntr++;
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
