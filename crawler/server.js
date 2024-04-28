global.nodeConfig = { ip: "127.0.0.1", port: 8080 };
const distribution = require("../distribution");
const id = distribution.util.id;
const groups = require("../distribution/all/groups");
const { performance } = require("perf_hooks");
const http = require("http");
const args = require("yargs").argv;
const port = args.port || 9999;
const nodesPath = args.env === "dev" ? "./ec2-nodes.json" : "./nodes.json";
const nodes = require(nodesPath);

const indexerGroup = {};
for (const node of nodes) {
  indexerGroup[id.getSID(node)] = node;
}

const crawlerConfig = { gid: "crawler", hash: id.consistentHash };
const scraperConfig = { gid: "scraper", hash: id.consistentHash };
const groupConfig = { gid: "indexer", hash: id.consistentHash };
groups(crawlerConfig).put(crawlerConfig, indexerGroup, (e, v) => {
  groups(scraperConfig).put(scraperConfig, indexerGroup, (e, v) => {
    groups(groupConfig).put(groupConfig, indexerGroup, (e, v) => {
      const startServer = () => {
        const server = http.createServer((req, res) => {
          const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
            "Access-Control-Allow-Headers":
              "Content-Type, Origin, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Access-Control-Allow-Origin",
            "Access-Control-Max-Age": 2592000, // 30 days
            "Content-Type": "application/json",
          };
          if (req.method === "OPTIONS") {
            res.writeHead(204, headers);
            res.end();
            return;
          }

          if (req.method === "POST" && req.url === "/query") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              const queryString = JSON.parse(body);
              console.log("Received query:", queryString);
              res.writeHead(200, headers);
              handleQuery(queryString, (x) => {
                res.end(JSON.stringify(x));
              });
            });
          } else {
            res.statusCode = 404;
            res.end("Not Found");
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

const handleQuery = (query, callback) => {
  const startTime = performance.now();
  const words = query.split(" ");
  const queryResult = [];
  let cnt = 0;
  let step = 0;
  words.map((word) => {
    word = word.toLowerCase();
    distribution.indexer.store.get(word, (e, v) => {
      cnt++;
      if (e) {
        if (e.message.includes("no such file")) {
          // console.log("[query result]:", []);
        } else {
          // callback([]);
          console.log(e.message);
        }
      } else if (v) {
        queryResult.push(v);
        if (cnt === words.length) {
          const map = new Map();
          queryResult.map((res) => {
            const strs = res.split(" ");
            for (let i = 0; i < strs.length; i += 2) {
              const url = strs[i];
              const count = parseInt(strs[i + 1]);
              if (map.has(url)) {
                map.set(url, map.get(url) + count);
              } else {
                map.set(url, count);
              }
            }
          });
          const sorted = Array.from(map).sort((a, b) => b[1] - a[1]);
          const results = [];
          sorted.map((item) => {
            distribution.scraper.store.get(item[0], (e, v) => {
              step++;
              const meta = Object.values(v)[0];
              const obj = {};
              obj.title = meta.title || "unknown";
              obj.author = meta.author || "unknown";
              obj.cover = meta.cover || "unknown";
              obj.date = meta.date || "unknown";
              obj.language = meta.language || "unknown";
              results.push([item[0], obj]);
              if (step === sorted.length) {
                const endTime = performance.now();
                const procedureTime = endTime - startTime;
                console.log(
                  "[query] \ncount of nodes:",
                  Object.keys(indexerGroup).length,
                  "\nprocedure time:",
                  procedureTime.toFixed(4),
                  "milliseconds"
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
