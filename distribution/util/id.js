const assert = require('assert');
var crypto = require('crypto');
const {serialize} = require('./serialization');

// Random sequence of 20 bytes
function getRID() {
  return crypto.randomBytes(20).toString('hex');
};

// The ID is the SHA256 hash of the JSON representation of the object
function getID(obj) {
  const hash = crypto.createHash('sha256');
  hash.update(serialize(obj));
  return hash.digest('hex');
}

// The NID is the SHA256 hash of the JSON representation of the node
function getNID(node) {
  const hash = crypto.createHash('sha256');
  hash.update(serialize({ip: node.ip, port: node.port}));
  return hash.digest('hex');
}

// The SID is the first 5 characters of the NID
function getSID(node) {
  return getNID(node).substring(0, 5);
}


function idToNum(id) {
  let n = parseInt(id, 16);
  if (isNaN(n)) {
    n = parseInt(global.distribution.util.id.getID(id), 16);
  }
  assert(!isNaN(n), 'idToNum: id is not in KID form!');
  return n;
}

/**
 * Picks a node based on the consistent hashing scheme
 * @param {string} kid
 * @param {string[]} nids
 * @return {string}
 */
function naiveHash(kid, nids) {
  const idToNum = global.distribution.util.id.idToNum;
  nids.sort();
  return nids[idToNum(kid) % nids.length];
}

/**
 * Picks a node based on the consistent hashing scheme
 * @param {string} kid
 * @param {string[]} nids
 * @return {string}
 */
function consistentHash(kid, nids) {
  const idToNum = global.distribution.util.id.idToNum;
  const numKid = idToNum(kid);

  const list = [
    {original: kid, n: numKid},
    ...nids.map((nid) => ({original: nid, n: idToNum(nid)}))];
  list.sort((a, b) => a.n - b.n);
  const o = list.find((o) => o.original === kid) || list[0];
  const index = list.indexOf(o);

  if (index === list.length - 1) {
    return list[0].original;
  } else {
    return list[index + 1].original;
  }
}

/**
 * Picks a node based on the rendezvous hashing scheme
 * @param {string} kid
 * @param {string[]} nids
 * @return {string}
 */
function rendezvousHash(kid, nids) {
  const idToNum = global.distribution.util.id.idToNum;
  const list = nids.map((nid) => ({
    original: nid,
    n: idToNum(getID(kid + nid)),
  }));
  list.sort((a, b) => a.n - b.n);
  return list[list.length - 1].original;
}

module.exports = {
  getRID: getRID,
  getNID: getNID,
  getSID: getSID,
  getID: getID,
  idToNum: idToNum,
  naiveHash: naiveHash,
  consistentHash: consistentHash,
  rendezvousHash: rendezvousHash,
};
