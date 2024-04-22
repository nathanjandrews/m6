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

const gid = 'scraper';
const scraperGroup = {};
for (const node of nodes) {
  scraperGroup[id.getSID(node)] = node;
}

const groupConfig = { gid: gid, hash: id.consistentHash };
groups(groupConfig).put(groupConfig, scraperGroup, (e, v) => {
  let cnt = 0;
  for (const node of nodes) {
    distribution.scraper.groups.add(gid, node, (e, v) => {
      cnt++;
      if (cnt === nodes.length) {
        doIndex();
      }
    });
  }
});

const doIndex = () => {
  const m1 = (key, value) => {
    console.log('[indexer]: ', value);
    const words = value.split(' ');
    const index = {};
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (index[word]) {
        index[word].push(i);
      } else {
        index[word] = [i];
      }
    }
    return index;
  };

  const r1 = (key, value) => {
    for (const word in value) {
      if (key[word]) {
        key[word] = key[word].concat(value[word]);
      } else {
        key[word] = value[word];
      }
    }
    return key;
  };


  const doMapReduce = (cb) => {
    distribution.scraper.store.get(null, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        storeGid: 'indexer',
        compact: false,  // split the content
      };
      distribution.scraper.mr.exec(config, (e, v) => {
        try {
          // console.log('[scraper]:', v);
          graceShutDown();
        } catch (e) {
          console.error('[scraper error]:', e);
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
