global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');
const TYPES = require('../distribution/util/types.js');
const { performance } = require('perf_hooks');

const args = require('yargs').argv;
const nodesPath = args.env === 'dev' ? './ec2-nodes.json' : './nodes.json';
const nodes = require(nodesPath);

/** @type {string} */
const query = args.query;

const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const crawlerConfig = { gid: 'crawler', hash: id.consistentHash };
const scraperConfig = { gid: 'scraper', hash: id.consistentHash };
const groupConfig = { gid: 'indexer', hash: id.consistentHash };
groups(crawlerConfig).put(crawlerConfig, indexerGroup, (e, v) => {
  groups(scraperConfig).put(scraperConfig, indexerGroup, (e, v) => {
    groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
    //   crawlerWorkflow();
    });
  });
});

const crawlerWorkflow = () => {
  const startTime = performance.now();
  const words = query.split(' ');
  const queryResult = [];
  let cnt = 0;
  words.map((word) => {
    distribution.indexer.store.get(word, (e, v) => {
      cnt++;
      if (e) {
        if (e.message.includes('no such file')) {
          console.log('[query result]:', []);
        }
      } else if (v) {
        queryResult.push(v);
        if (cnt === words.length) {
          const map = new Map();
          queryResult.map((res) => {
            const strs = res.split(' ');
            for (let i = 0; i < strs.length; i += 2) {
              const url = strs[i];
              const count = parseInt(strs[i + 1]);
              if (map.has(url)) {
                map.set(url, map.get(url) + count);
              } else {
                map.set(url, count);
              }
            }
          });
          const sorted = Array.from(map).sort((a, b) => b[1] - a[1]);
          console.log('[query result]:', sorted);

          distribution.scraper.store.get(sorted[0][0], (e, v) => {
            console.log('[scraper] result', e, v);
            const endTime = performance.now();
            const procedureTime = endTime - startTime;
            console.log(
              '[query] \ncount of nodes:',
              Object.keys(indexerGroup).length,
              '\nprocedure time:',
              procedureTime.toFixed(4),
              'milliseconds',
            );
          });
        }
      }
    });
  });
};
