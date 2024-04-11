/*

Service  Description                                Methods
status   Status and control of the current node     get, spawn, stop
comm     A message communication interface          send
groups   A mapping from group names to nodes        get, put, add, rem, del
gossip   The receiver part of the gossip protocol   recv
routes   A mapping from names to functions          get, put
mem      An ephemeral (in memory) store             get, put, del
store    A persistent store                         get, put, del

*/

/* Status Service */

const status = require('./services/status');

/* Groups Service */

const groups = require('./services/groups');

/* Routes Service */

const routes = require('./services/routes');

/* Comm Service */

const comm = require('./services/comm');

/* Gossip Service */

const gossip = require('./services/gossip');

/* Mem Service */

const mem = require('./services/mem');

/* Store Service */

const store = require('./services/store');

module.exports = {
  status,
  routes,
  comm,
  groups,
  gossip,
  mem,
  store,
};
