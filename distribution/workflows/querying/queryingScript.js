const readline = require('node:readline');
const id = distribution.util.id;
const groups = require('../distribution/all/groups');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
// Begins CLI query interface.
// Current assumption. All nodes in this network are part of all
// so group does not matter to me atm.
// if this is proven to be untrue, then
const spawnTermQuestioner = () => {
  rl.question(`Search Term: `, (term) => {
    if (term == 'kill') {
      console.log('Thank You For Searching');
      rl.close();
    } else {
      // Assumption #2. Currently, all data in the "index" group is indexing data only
      // Will run this by groupmates later.
      // currently assumes value will be formatted as:
      // const expected = [
      //     'project gutenberg | https://atlas.cs.brown.edu/data/gutenberg/0/1/1-0.txt 2 https://atlas.cs.brown.edu/data/gutenberg/0/2/2.txt 3',
      //     'etext | https://atlas.cs.brown.edu/data/gutenberg/0/1/1-0.txt 1 https://atlas.cs.brown.edu/data/gutenberg/0/2/2.txt 4',
      //     'signifi renew chang | https://atlas.cs.brown.edu/data/gutenberg/0/3/3-0.txt 1',
      //     'solemn oath forbear | https://atlas.cs.brown.edu/data/gutenberg/0/3/3-0.txt 1',
      //   ];
      const map = (key, value, queryTerm, limit) => {
        // This code assumes an argument can be passed into map.
        // Which is functionality we've planned.
        // also planned rework to indexing output. Store indexes in format {item: [{url: url..., score: score...}, ....]}
        // Find the n matching substring terms by whatever indexing uses for these scores..
        let ret = [];
        let term = queryTerm;
        let rem = limit;
        while (ret.length < limit) {
          if (term.length == 0) {
            return ret;
          }
          if (value[term] != undefined) {
            let tS = value[term].sort((a, b) => {
              return a.score > b.score;
            });
            ret = ret.push({term: term, pages: tS.slice(0, min(rem, tS.length))});
            rem -= min(rem, tS.length);
          }
        }
        let obj = {};
        obj[value] = ret;
        return obj;
      };
      const reduce = (key, value, limit = 10) => {
        // All of this will end up on a single node since the reduction is the same, and option comparison is required.
        // This could be done on client side, it dosent really matter tbh.
        let items = value[key];
        // items = {term: term component. pages: relevant pages:}
        let sortedItems = items.sort((a, b) => {
          a.term.length > b.term.length;
        });
        // Now loop until limit is capped. sortedItems will always have num_nodes * limit entries unless its severely underpopulated.
        // Which would be, well kind of impossible, but whatever.
        // items
        let ret = [];
        let itind = 0;
        while (ret.length < limit) {
          ret = ret.concat(sortedItems[itind].pages);
        }
        return ret.slice(0, limit);
      };
      const config = {
        map: map,
        reduce: reduce,
        storeGid: 'indexer',
        compact: false, // split the content
        MapBonusargs: [term, 10],
        ReduceBonusargs: [10],
      };
      distribution.indexer.mr.exec(config, (e, v) => {
        // Will clean up later but for now this is fine.
        console.log(v);
      });
      spawnTermQuestioner();
    }
  });
};
spawnTermQuestioner();
