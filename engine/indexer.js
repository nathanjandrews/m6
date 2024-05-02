global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution.js');
const id = distribution.util.id;
const groups = require('../distribution/all/groups.js');
const TYPES = require('../distribution/util/types.js');
const {performance} = require('perf_hooks');

const args = require('yargs').argv;
const nodesPath = args.env === 'dev' ? '../ec2-nodes.json' : '../nodes.json';
const nodes = require(nodesPath);
const bigram = args.bigram ? true : false;

const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const crawlerConfig = {gid: 'crawler', hash: id.consistentHash};
const groupConfig = {gid: 'indexer', hash: id.consistentHash};
groups(crawlerConfig).put(crawlerConfig, indexerGroup, (e, v) => {
  groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
    crawlerWorkflow();
  });
});

// 1gram indexing
const m1 = (key, value) => {
  const natural = global.require('natural');
  const stopwords = global.require('stopword');
  const content = Object.values(value)[0].html.toLowerCase();

  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(content);
  const filteredTokens = stopwords.removeStopwords(tokens);

  const {TfIdf} = natural;
  const tfidf = new TfIdf();
  tfidf.addDocument(filteredTokens);
  // const tfidfScores = [];
  const index = new Map();
  tfidf.listTerms(0).forEach((term) => {
    // tfidfScores.push({ term: term.term, score: term.tfidf });
    index[term.term] = term.tf;
  });

  const indexArray = Object.entries(index).map(([k, v]) => ({[k]: `${key} ${v}`}));
  return indexArray;
};

// 1gram + bigram indexing
const m2 = (key, value) => {
  const natural = global.require('natural');
  const stopwords = global.require('stopword');
  const content = Object.values(value)[0].html.toLowerCase();

  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(content);
  const filteredTokens = stopwords.removeStopwords(tokens);

  const {TfIdf} = natural;
  const tfidf = new TfIdf();
  tfidf.addDocument(filteredTokens);
  // const tfidfScores = [];
  const index = new Map();
  tfidf.listTerms(0).forEach((term) => {
    // tfidfScores.push({ term: term.term, score: term.tfidf });
    index[term] = term.tf;
  });

  const {NGrams} = natural;
  const bigrams = NGrams.bigrams(filteredTokens);
  bigrams.map((bigram) => {
    const token = bigram.join(' ');
    index[token] = index[token] ? index[token] + 1 : 1;
  });

  const indexArray = Object.entries(index).map(([k, v]) => ({[k]: `${key} ${v}`}));
  return indexArray;
};

const r1 = (key, values) => {
  const unique = new Map();
  values.forEach((value) => {
    const [url, cnt] = value.split(' ');
    if (unique[url]) {
      unique[url] += parseInt(cnt);
    } else {
      unique[url] = parseInt(cnt);
    }
  });
  // .sort((a, b) => {return a[1] === b[1] ? a[0].localeCompare(b[0]) : b[1] - a[1];})
  const out = Object.entries(unique).map(([k, v]) => `${k} ${v}`);
  return {[key]: out.join(' ')};
};

const crawlerWorkflow = () => {
  const doMapReduce = () => {
    const startTime = performance.now();
    distribution.crawler.store.get(null, (e, v) => {
      /** @type {TYPES.MapReduceConfiguration< [x: number]: string>} */
      const config = {
        keys: v,
        map: bigram ? m2 : m1,
        reduce: r1,
        loadGid: 'scraper',
        storeGid: 'indexer',
        compact: true,
        reduceStore: true,
      };
      distribution.indexer.mr.exec(config, (e, v) => {
        try {
          const endTime = performance.now();
          const procedureTime = endTime - startTime;
          console.log(
              '[indexer] \ncount of nodes:',
              Object.keys(indexerGroup).length,
              '\ncount of urls:',
              config.keys.length,
              '\nprocedure time:',
              procedureTime.toFixed(4),
              'milliseconds',
          );
          graceShutDown();
        } catch (e) {
          // console.error('[crawler error]:', e);
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
