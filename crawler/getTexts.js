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

const crawlerConfig = { gid: 'crawler', hash: id.consistentHash };
const groupConfig = { gid: 'scraper', hash: id.consistentHash };
groups(crawlerConfig).put(crawlerConfig, crawlerGroup, (e, v) => {
  groups(groupConfig).put(groupConfig, crawlerGroup, (e, v) => {
    crawlerWorkflow();
  });
});

const crawlerWorkflow = () => {
  const m1 = (key, value) => {
    const https = global.require('https');
    const hostname = new URL(value).hostname;
    const path = new URL(value).pathname;
    console.log('visiting:', value);
    return new Promise((resolve, reject) => {
      https.get(
        {
          hostname: hostname,
          path: path,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'text/html',
          },
          rejectUnauthorized: false,
        },
        (response) => {
          // const links = [];

          let data = '';
          response.on('data', (chunk) => {
            /**
             const chunkString = chunk.toString(); // Convert chunk to string
             const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g; // Regex to extract URLs from anchor elements
             let match;
             while ((match = regex.exec(chunkString)) !== null) {
               const url = match[2];
               if (url.startsWith('https://')) {
                 links.push(url);
                } else if (url.startsWith('/')) {
                  links.push('https://' + hostname + url);
                }
              }
            */
            data += chunk;
          });
          response.on('error', (error) => {
            console.error(`Error: ${error.message}`);
            reject(error);
          });
          response.on('end', () => {
            // console.log('crwaler.workflow.test.js: m1: data:', data);
            const newKey = value;
            const text = data;
            const obj = {};
            obj[newKey] = text;
            resolve(obj);
          });
        },
      );
    });
  };

  const r1 = (key, values) => {
    return values;
  };

  const doMapReduce = (cb) => {
    distribution.crawler.store.get(null, (e, v) => {
      distribution.scraper.mr.exec(
        {
          keys: v,
          map: m1,
          reduce: r1,
          cleanup: false,
          promise: true,
          // compress: 'gzip',
        },
        (e, v) => {
          try {
            console.log('[crawler]:', v);
            graceShutDown();
          } catch (e) {
            console.error('[crawler error]:', e);
          }
        },
      );
    });
  };

  doMapReduce();
};

const graceShutDown = () => {
  process.exit(0);
};
