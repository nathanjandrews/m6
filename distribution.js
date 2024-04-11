#!/usr/bin/env node

const util = require('./distribution/util/index.js');
const args = require('yargs').argv;

// Default configuration
global.nodeConfig = global.nodeConfig || {
  ip: '127.0.0.1',
  port: 8080,
  onStart: () => {
    console.log('Node started!');
  },
};

/*
    As a debugging tool, you can pass ip and port arguments directly.
    This is just to allow for you to easily startup nodes from the terminal.

    Usage:
    ./distribution.js --ip '127.0.0.1' --port 1234
  */
if (args.ip) {
  global.nodeConfig.ip = args.ip;
}

if (args.port) {
  // @ts-ignore
  global.nodeConfig.port = parseInt(args.port);
}

if (args.config) {
  // @ts-ignore
  const parsedConfig = util.deserialize(args.config);

  global.nodeConfig.ip = parsedConfig.ip ?
    parsedConfig.ip : global.nodeConfig.ip;
  global.nodeConfig.port = parsedConfig.port ?
    parsedConfig.port : global.nodeConfig.port;
  global.nodeConfig.onStart = parsedConfig.onStart ?
    parsedConfig.onStart : global.nodeConfig.onStart;
}

const distribution = {
  util: require('./distribution/util'),
  local: require('./distribution/local/index.js'),
  node: require('./distribution/local/node.js'),
};

global.distribution = distribution;
global.https = require('https'); // added https package to global object for m5

// registering the "all" group
const groupsTemplate = require('./distribution/templates/services/groups.js');
const allGroup = {};
allGroup[util.id.getSID(global.nodeConfig)] = global.nodeConfig;
groupsTemplate({gid: 'all'}).put('all', allGroup);

module.exports = distribution;

/* The following code is run when distribution.js is run directly */
if (require.main === module) {
  distribution.node.start(global.nodeConfig.onStart);
}
