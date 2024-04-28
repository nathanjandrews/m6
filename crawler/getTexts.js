global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');
const TYPES = require('../distribution/util/types.js');
const { performance } = require('perf_hooks');

const args = require('yargs').argv;
const nodesPath = args.env === 'dev' ? './ec2-nodes.json' : './nodes.json';
const nodes = require(nodesPath);

const crawlerGroup = {};
for (const node of nodes) {
  crawlerGroup[id.getSID(node)] = node;
}

const crawlerConfig = { gid: 'crawler', hash: id.consistentHash };
const groupConfig = { gid: 'scraper', hash: id.consistentHash };
groups(crawlerConfig).put(crawlerConfig, crawlerGroup, (e, v) => {
  groups(groupConfig).put(groupConfig, crawlerGroup, (e, v) => {
    crawlerWorkflow();
  });
});

const crawlerWorkflow = () => {
  const m1 = (key, value) => {
    const fetch = global.require('sync-fetch');
    global.process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    const res = fetch(value, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'text/html' },
    });
    const obj = {};
    // obj[value] = res.text();
    obj[value] = "apple banana";
    return obj;
  };

  const r1 = (key, values) => {
    return values;
  };

  const doMapReduce = (cb) => {
    const startTime = performance.now();
    distribution.crawler.store.get(null, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        storeGid: 'scraper',
        compact: false, // split the content
        noShuffle: true,
      };
      distribution.crawler.mr.exec(config, (e, v) => {
        try {
          const endTime = performance.now();
          const procedureTime = endTime - startTime;
          console.log(
            '[scraper] \ncount of nodes:',
            Object.keys(crawlerGroup).length,
            '\ncount of urls:',
            config.keys.length,
            '\nprocedure time:',
            procedureTime.toFixed(4),
            'milliseconds',
          );
          graceShutDown();
        } catch (e) {
          console.error('[crawler error]:', e);
        }
      });
    });
  };

  doMapReduce();
};

const graceShutDown = () => {
  process.exit(0);
};
