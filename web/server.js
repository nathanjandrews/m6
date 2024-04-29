global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');
const {performance} = require('perf_hooks');
const http = require('http');
const args = require('yargs').argv;
const port = args.port || 9999;
const nodesPath = args.env === 'dev' ? '../ec2-nodes.json' : '../nodes.json';
const nodes = require(nodesPath);

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
        const N = v.length;

        const startServer = () => {
          const server = http.createServer((req, res) => {
            const headers = {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
              'Access-Control-Allow-Headers':
                'Content-Type, Origin, Access-Control-Allow-Headers, ' +
                'Access-Control-Allow-Methods, Access-Control-Allow-Origin',
              'Access-Control-Max-Age': 2592000, // 30 days
              'Content-Type': 'application/json',
            };
            if (req.method === 'OPTIONS') {
              res.writeHead(204, headers);
              res.end();
              return;
            }

            if (req.method === 'POST' && req.url === '/query') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', () => {
                const queryString = JSON.parse(body);
                console.log('Received query:', queryString);
                res.writeHead(200, headers);
                handleQuery(queryString, N, (x) => {
                  res.end(JSON.stringify(x));
                });
              });
            } else {
              res.statusCode = 404;
              res.end('Not Found');
            }
          });

          server.listen(port, global.nodeConfig.ip, () => {
            console.log(`Server listening on ${global.nodeConfig.ip}:${port}`);
          });
        };

        startServer();
      });
    });
  });
});

/**
 *
 * @param {string} query
 * @param {number} N - the total number of documents
 * @param {Function} callback
 */
const handleQuery = (query, N, callback) => {
  const startTime = performance.now();
  const words = query.toLowerCase().split(' ');
  const queryResult = new Map();
  let cnt = 0;
  let step = 0;
  let errCnt = 0;

  distribution.indexer.store.get(query.toLowerCase(), (e, v) => {
    if (e) {
      if (e.message.includes('no such file')) {
        if (words.length > 1) {
          splitQuery(words);
        } else {
          callback([]);
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
      const results = [];
      sorted.map((item) => {
        distribution.scraper.store.get(item[0], (e, v) => {
          step++;
          const meta = Object.values(v)[0];
          const obj = {};
          obj.title = meta.title || 'unknown';
          obj.author = meta.author || 'Anonymous';
          obj.cover = meta.cover || '';
          obj.date = meta.date || 'unknown';
          obj.language = meta.language || 'unknown';
          obj.originUrl = meta.originUrl || item[0];
          obj.subject = meta.subject || 'unknown';
          results.push([item[0], obj]);

          if (step === sorted.length) {
            const endTime = performance.now();
            const procedureTime = endTime - startTime;
            console.log(
                '[query] \ncount of nodes:',
                Object.keys(indexerGroup).length,
                '\nprocedure time:',
                procedureTime.toFixed(4),
                'milliseconds',
            );
            callback(results);
          }
        });
      });
    }
  });
  const splitQuery = (words) => {
    words.map((word) => {
      word = word.toLowerCase();
      distribution.indexer.store.get(word, (e, v) => {
        cnt++;
        if (e) {
          if (e.message.includes('no such file')) {
            // console.log('[not found]:', word, e.message);
          }
          errCnt++;
          if (errCnt === words.length) {
            callback([]);
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
            const results = [];
            sorted.map((item) => {
              distribution.scraper.store.get(item[0], (e, v) => {
                step++;
                const meta = Object.values(v)[0];
                const obj = {};
                obj.title = meta.title || 'unknown';
                obj.author = meta.author || 'Anonymous';
                obj.cover = meta.cover || '';
                obj.date = meta.date || 'unknown';
                obj.language = meta.language || 'unknown';
                obj.originUrl = meta.originUrl || item[0];
                obj.subject = meta.subject || 'unknown';
                results.push([item[0], obj]);

                if (step === sorted.length) {
                  const endTime = performance.now();
                  const procedureTime = endTime - startTime;
                  console.log(
                      '[query] \ncount of nodes:',
                      Object.keys(indexerGroup).length,
                      '\nprocedure time:',
                      procedureTime.toFixed(4),
                      'milliseconds',
                  );
                  callback(results);
                }
              });
            });
          }
        }
      });
    });
  };
};
