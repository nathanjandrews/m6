global.nodeConfig = { ip: "127.0.0.1", port: 8080 };
const distribution = require("../distribution");
const id = distribution.util.id;
const groups = require("../distribution/all/groups");
const TYPES = require("../distribution/util/types.js");
const { performance } = require("perf_hooks");

const args = require("yargs").argv;
const nodesPath = args.env === "dev" ? "./ec2-nodes.json" : "./nodes.json";
const meta = args.meta === "true" ? true : false;

const nodes = require(nodesPath);

const crawlerGroup = {};
for (const node of nodes) {
  crawlerGroup[id.getSID(node)] = node;
}

const crawlerConfig = { gid: "crawler", hash: id.consistentHash };
const groupConfig = { gid: "scraper", hash: id.consistentHash };
groups(crawlerConfig).put(crawlerConfig, crawlerGroup, (e, v) => {
  groups(groupConfig).put(groupConfig, crawlerGroup, (e, v) => {
    crawlerWorkflow();
  });
});

const m1 = (key, value) => {
  const fetch = global.require("sync-fetch");
  const JSDOM = global.require("jsdom").JSDOM;
  global.process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  console.log("[key]", key, value);
  const res = fetch(value, {
    headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "text/html" },
  });
  const obj = {};
  obj[value] = {};

  const ids = value.split("/");
  const ebookId = isNaN(parseInt(ids.at(-2))) ? ids.at(-3) : ids.at(-2);
  const baseUrl = "https://www.gutenberg.org/ebooks";
  console.log("URL:", `${baseUrl}/${ebookId}`);
  const metadata = fetch(`${baseUrl}/${ebookId}`, {
    headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "text/html" },
  });
  const dom = new JSDOM(metadata.text());
  const titleElement = dom.window.document.querySelector('h1[itemprop="name"]');
  const authorElement = dom.window.document.querySelector(
    'a[itemprop="creator"]'
  );
  const coverElement = dom.window.document.querySelector(
    'img[itemprop="image"]'
  );
  const dateElement = dom.window.document.querySelector(
    'td[itemprop="datePublished"]'
  );
  const languageElement = dom.window.document.querySelector(
    'tr[itemprop="inLanguage"] td'
  );
  const title = titleElement ? titleElement.textContent.trim() : "";
  const author = authorElement ? authorElement.textContent.trim() : "";
  const cover = coverElement ? coverElement.src : "";
  const date = dateElement ? dateElement.textContent.trim() : "";
  const language = languageElement ? languageElement.textContent.trim() : "";
  obj[value] = {
    html: res.text(),
    title: title,
    author: author,
    cover: cover,
    date: date,
    language: language,
  };
  return obj;
};

const r1 = (key, values) => {
  return values;
};

const crawlerWorkflow = () => {
  const doMapReduce = (cb) => {
    const startTime = performance.now();
    distribution.crawler.store.get(null, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration<object>}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        loadGid: "crawler",
        storeGid: "scraper",
        compact: false, // split the content
        noShuffle: true,
      };
      distribution.crawler.mr.exec(config, (e, v) => {
        try {
          const endTime = performance.now();
          const procedureTime = endTime - startTime;
          console.log(
            "[scraper] \ncount of nodes:",
            Object.keys(crawlerGroup).length,
            "\ncount of urls:",
            config.keys.length,
            "\nprocedure time:",
            procedureTime.toFixed(4),
            "milliseconds"
          );
          graceShutDown();
        } catch (e) {
          console.error("[crawler error]:", e);
        }
      });
    });
  };

  doMapReduce();
};

const graceShutDown = () => {
  process.exit(0);
};
