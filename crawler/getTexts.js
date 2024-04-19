global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');
const TYPES = require('../distribution/util/types.js');

// TODO: find a way to auto config the ip from ec2
const nodes = require('./nodes.json');

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
    obj[value] = res.text();
    return obj;
  };

  const r1 = (key, values) => {
    return values;
  };

  const doMapReduce = (cb) => {
    distribution.crawler.store.get(null, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        storeGid: 'scraper',
        compact: false,  // split the content
      };
      distribution.crawler.mr.exec(config, (e, v) => {
        try {
          // console.log('[crawler]:', v);
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
