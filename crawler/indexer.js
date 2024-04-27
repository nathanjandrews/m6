global.nodeConfig = { ip: "127.0.0.1", port: 8080 };
const distribution = require("../distribution.js");
const id = distribution.util.id;
const groups = require("../distribution/all/groups.js");
const TYPES = require("../distribution/util/types.js");
const { performance } = require("perf_hooks");

const args = require("yargs").argv;
const nodesPath = args.env === "dev" ? "./ec2-nodes.json" : "./nodes.json";
const nodes = require(nodesPath);

const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const groupConfig = { gid: "scraper", hash: id.consistentHash };
const indexerConfig = { gid: "indexer", hash: id.consistentHash };
groups(indexerConfig).put(indexerConfig, indexerGroup, (e, v) => {
  groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
    indexerWorkflow();
  });
});

const indexerWorkflow = () => {
  const m1 = (key, value) => {
    console.log("key:", key, "value:", value);
    return { [key]: value };
  };

  const r1 = (key, values) => {
    return values;
  };

  const doMapReduce = (cb) => {
    const startTime = performance.now();
    distribution.scraper.store.get(null, (e, v) => {
      /**
       * @type {TYPES.MapReduceConfiguration}
       */
      const config = {
        keys: v,
        map: m1,
        reduce: r1,
        loadGid: "scraper", // load content from this gid
        storeGid: "indexer", // store terms in this gid
        compact: true, // split the content
      };
      distribution.indexer.mr.exec(config, (e, v) => {
        try {
          const endTime = performance.now();
          const procedureTime = endTime - startTime;
          console.log(
            "[scraper] \ncount of nodes:",
            Object.keys(indexerGroup).length,
            "\ncount of urls:",
            config.keys.length,
            "\nprocedure time:",
            procedureTime.toFixed(4),
            "milliseconds"
          );
          graceShutDown();
        } catch (e) {
          console.error("[indexer error]:", e);
        }
      });
    });
  };

  doMapReduce();
};

const graceShutDown = () => {
  process.exit(0);
};
