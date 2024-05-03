global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');
const {performance} = require('perf_hooks');

const args = require('yargs').argv;
const nodesPath = args.env === 'dev' ? '../ec2-nodes.json' : '../nodes.json';
const nodes = require(nodesPath);

/** @type {string} */
const query = args.query.trim();

const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const crawlerConfig = {gid: 'crawler', hash: id.consistentHash};
const scraperConfig = {gid: 'scraper', hash: id.consistentHash};
const groupConfig = {gid: 'indexer', hash: id.consistentHash};
groups(crawlerConfig).put(crawlerConfig, indexerGroup, (e, v) => {
  groups(scraperConfig).put(scraperConfig, indexerGroup, (e, v) => {
    groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
      distribution.crawler.store.get(null, (e, v) => {
        queryWorkflow(v.length);
      });
    });
  });
});

/**
 *
 * @param {number} N - the total number of documents
 */
const queryWorkflow = (N) => {
  const startTime = performance.now();
  const words = query.split(' ');
  const queryResult = new Map(); // term: [{url, TFIDF}, ...]

  distribution.indexer.store.get(
      query.toLowerCase(),
      /**
     * @param {Error} e
     * @param {string} v
     */
      (e, v) => {
      // console.log('[query result]:', e, v);
        if (e) {
          if (e.message.includes('no such file')) {
            if (words.length > 1) {
              splitQuery(words);
            } else {
              console.log('[query result]:', []);
              const endTime = performance.now();
              const procedureTime = endTime - startTime;
              console.log(
                  '[query] \ncount of nodes:',
                  Object.keys(indexerGroup).length,
                  '\nprocedure time:',
                  procedureTime.toFixed(4),
                  'milliseconds',
              );
            }
          } else {
            console.error(e);
          }
        } else {
          const urls = v.split(' ');
          const nt = urls.length / 2;
          const IDF = 1 + Math.log(N / (1 + nt));
          for (let i = 0; i < urls.length; i += 2) {
            const url = urls[i];
            const TF = urls[i + 1];
            const TFIDF = TF * IDF;
            if (queryResult.has(query)) {
              queryResult.get(query).push({url, TFIDF});
            } else {
              queryResult.set(query, [{url, TFIDF}]);
            }
          }
          const map = new Map();
          queryResult.forEach((tfidfs, word) => {
            tfidfs.map((tfidf) => {
              const url = tfidf.url;
              const TFIDF = tfidf.TFIDF;
              if (map.has(url)) {
                map.set(url, map.get(url) + TFIDF);
              } else {
                map.set(url, TFIDF);
              }
            });
          });
          const sorted = Array.from(map).sort((a, b) => b[1] - a[1]);
          console.log('[query result]:', sorted);
          const endTime = performance.now();
          const procedureTime = endTime - startTime;
          console.log(
              '[query] \ncount of nodes:',
              Object.keys(indexerGroup).length,
              '\nprocedure time:',
              procedureTime.toFixed(4),
              'milliseconds',
          );
        }
      },
  );

  const splitQuery = (words) => {
    let cnt = 0;
    words.map((word) => {
      word = word.toLowerCase();
      distribution.indexer.store.get(word, (e, v) => {
        if (e) {
          if (e.message.includes('no such file')) {
            // console.log('[query result]:', []);
          }
        } else if (v) {
          const urls = v.split(' '); // url1 tf1 url2 tf2 ...
          const nt = urls.length / 2; // the number of documents where term appears
          const IDF = 1 + Math.log(N / (1 + nt)); // Inverse Document Frequency
          for (let i = 0; i < urls.length; i += 2) {
            const url = urls[i];
            const TF = urls[i + 1];
            const TFIDF = TF * IDF;
            if (queryResult.has(word)) {
              queryResult.get(word).push({url, TFIDF});
            } else {
              queryResult.set(word, [{url, TFIDF}]);
            }
          }
        }
        cnt++;
        if (cnt === words.length) {
          const map = new Map();
          queryResult.forEach((value, key) => {
            value.map((res) => {
              const url = res.url;
              const TFIDF = res.TFIDF;
              if (map.has(url)) {
                map.set(url, map.get(url) + TFIDF);
              } else {
                map.set(url, TFIDF);
              }
            });
          });
          const sorted = Array.from(map).sort((a, b) => b[1] - a[1]);
          console.log('[query result]:', sorted);
          if (sorted.length > 0) {
            distribution.scraper.store.get(sorted[0][0], (e, v) => {
              // console.log('[scraper] result', e, v);
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
};
