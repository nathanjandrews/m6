global.nodeConfig = { ip: '127.0.0.1', port: 8080 };
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');

const nodes = require('../crawler/nodes.json');

const { indexingMap, indexingReduce } = require('../distribution/workflows/indexing/indexing');

const gid = 'indexer';
const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const groupConfig = { gid: gid, hash: id.consistentHash };
groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
  let cnt = 0;
  for (const node of nodes) {
    distribution.indexer.groups.add(gid, node, (e, v) => {
      cnt++;
      if (cnt === nodes.length) {
        doIndex();
      }
    });
  }
});

const doIndex = () => {
  const m1 = (key, value) => {
    const words = Object.values(value)[0].split(' '); 
    const index = {};
    words.map((word) => {
      const w = word.toLowerCase();
      if (index[w]) {
        index[w].push(key); 
      } else {
        index[w] = [key]; 
      }
    });
    console.log('[indexer]:', index);
    return index;
  };

  const r1 = (key, value) => {
    return value;
  };

  const doMapReduce = (cb) => {
    distribution.indexer.store.get({ gid: 'scraper' }, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        loadGid: 'scraper',
        storeGid: 'indexer',
        compact: true,
      };
      distribution.indexer.mr.exec(config, (e, v) => {
        try {
          console.log('[indexer]:', e, v);
          graceShutDown();
        } catch (e) {
          // console.error('[indexer error]:', e);
        }
      });
    });
  };
  doMapReduce();
};

const graceShutDown = () => {
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};
