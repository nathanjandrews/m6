const fs = require('fs');
const path = require('path');
const urlPath = path.join(__dirname, 'datasets.txt');

const data = fs.readFileSync(urlPath, 'utf8');
const dataset = data.split('\n');

global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');

// TODO: find a way to auto config the ip from ec2
const nodes = require('./nodes.json');

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


  // We send the dataset to the cluster
  dataset.forEach((url) => {
    distribution.crawler.store.put(url, url, (e, v) => {
      cntr++;
      // Once we are done, run the map reduce
      if (cntr === dataset.length) {
        graceShutDown();
      }
    });
  });
};

const graceShutDown = () => {
  process.exit(0);
};
