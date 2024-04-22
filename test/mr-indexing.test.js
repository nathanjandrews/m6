global.nodeConfig = {ip: '127.0.0.1', port: 7070};
const distribution = require('../distribution');
const id = distribution.util.id;

const groupsTemplate = require('../distribution/all/groups');
const {indexingMap, indexingReduce} = require('../distribution/workflows/indexing/indexing');

const group = {};

/*
   This hack is necessary since we can not
   gracefully stop the local listening node.
   The process that node is
   running in is the actual jest process
*/
let localServer = null;

/*
    The local node will be the orchestrator.
*/

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

beforeAll((done) => {
  /* Stop the nodes if they are running */

  group[id.getSID(n1)] = n1;
  group[id.getSID(n2)] = n2;
  group[id.getSID(n3)] = n3;

  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          cb();
        });
      });
    });
  };

  distribution.node.start((server) => {
    localServer = server;

    const groupConfig = {gid: 'group'};
    startNodes(() => {
      groupsTemplate(groupConfig).put(groupConfig, group, (e, v) => {
        done();
      });
    });
  });
});

afterAll((done) => {
  let remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        localServer.close();
        done();
      });
    });
  });
});

// ---all.mr---

test('testing indexing workflow', (done) => {
  const map = indexingMap;
  const reduce = indexingReduce;


  let dataset = [
    {'000': {'https://atlas.cs.brown.edu/data/gutenberg/0/1/1-0.txt':
    `Below you will find the first nine Project Gutenberg Etexts, in
    one file, with one header for the entire file.  This is to keep
    the overhead down, and in response to requests from Gopher site
    keeper to eliminate as much of the headers as possible.
    
    However, for legal and financial reasons, we must request these
    headers be left at the beginning of each file that is posted in
    any general user areas, as Project Gutenberg is run mostly by a
    donation from people like you.`}},
    {'106': {'https://atlas.cs.brown.edu/data/gutenberg/0/2/2.txt':
    `We apologize for the fact that the legal small print is longer,
    and more complicated, than the Etext itself, our legal beagles,
    of whom there are now a half dozen or so, insist this must be a
    part of any Project Gutenberg Etext we post, for our protection
    from the rest of the legal beagles out there.  The US has twice
    as many lawyers as the rest of the world combined!
    
    You are free to delete the headers and just keep the Etexts, we
    are not free not to post it this way.  Again my apologies.  The
    normal Project Gutenberg blurb has been deleted, you can get it
    in this location in most Project Gutenberg Etexts.  Thanks,  mh`}},
    {'212': {'https://atlas.cs.brown.edu/data/gutenberg/0/3/3-0.txt':
    `We observe today not a victory of party but a celebration of freedom. . .
    symbolizing an end as well as a beginning. . .signifying renewal
    as well as change for I have sworn before you and Almighty God
    the same solemn oath our forbears prescribed nearly a century
    and three-quarters ago.
    
    The world is very different now, for man holds in his mortal hands
    the power to abolish all forms of human poverty and all forms of human life.
    And yet the same revolutionary beliefs for which our forbears fought
    are still at issue around the globe. . .the belief that the rights of man
    come not from the generosity of the state but from the hand of God.
    We dare not forget today that we are the heirs of that first revolution.`}},
  ];

  const expected = [
    'project gutenberg | https://atlas.cs.brown.edu/data/gutenberg/0/1/1-0.txt 2 https://atlas.cs.brown.edu/data/gutenberg/0/2/2.txt 3',
    'etext | https://atlas.cs.brown.edu/data/gutenberg/0/1/1-0.txt 1 https://atlas.cs.brown.edu/data/gutenberg/0/2/2.txt 4',
    'signifi renew chang | https://atlas.cs.brown.edu/data/gutenberg/0/3/3-0.txt 1',
    'solemn oath forbear | https://atlas.cs.brown.edu/data/gutenberg/0/3/3-0.txt 1',
  ];

  /* Sanity check: map and reduce locally */
  // sanityCheck(m1, r1, dataset, expected, done);

  /* Now we do the same thing but on the cluster */
  const doMapReduce = (cb) => {
    distribution.group.store.get(null, (e, v) => {
      try {
        expect(v.length).toBe(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.group.mr.exec({keys: v, map, reduce, compact: true}, (e, v) => {
        try {
          expect(e).toBe(null);
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // We send the dataset to the cluster
  dataset.forEach((o) => {
    let key = Object.keys(o)[0];
    let value = o[key];
    distribution.group.store.put(value, key, (e, v) => {
      cntr++;
      // Once we are done, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});
