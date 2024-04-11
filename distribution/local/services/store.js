// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.ServiceCallback<Error, any>} ServiceCallback */

//  ________________________________________
// / NOTE: You should use absolute paths to \
// | make sure they are agnostic to where   |
// | your code is running from! Use the     |
// \ `path` module for that purpose.        /
//  ----------------------------------------
//         \   ^__^
//          \  (oo)\_______
//             (__)\       )\/\
//                 ||----w |
//                 ||     ||

const fs = require('fs/promises');
const path = require('node:path');
const {id, serialize, deserialize} = require('../../util');

const NODE_ID = id.getSID(global.nodeConfig);
const LOCAL_DIR_PATH =
  path.join(__dirname, '../../../store/', NODE_ID, '/local/');
const GROUPS_DIR_PATH =
  path.join(__dirname, '../../../store/', NODE_ID, '/groups/');

const store = {};
/**
 * Store PUT method
 * @param {any} value
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
store.put = async function(value, nullableKey, callback) {
  await setupDirectories();
  const cb = callback || function() {};

  let groupKey = null;
  let itemKey;
  if (nullableKey === null) {
    itemKey = id.getID(value);
  } else if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  let filePath;
  if (groupKey === null) {
    filePath = path.join(LOCAL_DIR_PATH, itemKey);
  } else {
    const dirPath = path.join(GROUPS_DIR_PATH, groupKey);
    filePath = path.join(dirPath, itemKey);
    await createDirectory(dirPath);
  }

  try {
    await fs.writeFile(filePath, serialize(value));
    cb(null, value);
  } catch (error) {
    cb(error);
  }
};

/**
 * Store GET method
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
store.get = async function(nullableKey, callback) {
  await setupDirectories();
  const cb = callback || function() {};

  let groupKey = null;
  let itemKey;
  if (nullableKey === null) {
    itemKey = null;
  } else if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  let dirPath;
  if (groupKey === null) {
    dirPath = LOCAL_DIR_PATH;
  } else {
    dirPath = path.join(GROUPS_DIR_PATH, groupKey);
  }

  if (itemKey === null) {
    try {
      const fileNames = await fs.readdir(dirPath);
      cb(null, fileNames);
    } catch (error) {
      cb(error);
    }
    return;
  }

  const filePath = path.join(dirPath, itemKey);
  try {
    const serializedValue = (await fs.readFile(filePath)).toString();
    cb(null, deserialize(serializedValue));
  } catch (error) {
    cb(new Error(error));
  }
};

/**
 * Store DEL method
 * @param {{key: string, gid: string} | string | null} nullableKey
 * @param {ServiceCallback} [callback]
 */
store.del = async function(nullableKey, callback) {
  await setupDirectories();
  const cb = callback || function() {};
  if (nullableKey === null) {
    cb(new Error('null key on local.store.del not supported'));
    return;
  }

  let groupKey = null;
  let itemKey;
  if (nullableKey === null) {
    itemKey = null;
  } else if (typeof nullableKey === 'string') {
    itemKey = nullableKey;
  } else {
    itemKey = nullableKey.key;
    groupKey = nullableKey.gid;
  }

  if (itemKey === null) {
    cb(new Error(`node ${JSON.stringify(global.nodeConfig)} does not support
        null item keys in the local.mem.del method`));
    return;
  }

  let filePath;
  if (groupKey === null) {
    filePath = path.join(LOCAL_DIR_PATH, itemKey);
  } else {
    filePath =
      path.join(GROUPS_DIR_PATH, groupKey, itemKey);
  }

  try {
    const value = deserialize((await fs.readFile(filePath)).toString());
    await fs.rm(filePath);
    cb(null, value);
  } catch (error) {
    cb(new Error(error));
  }
};

module.exports = store;

// setting up local and group subdirectories in the store directory;
async function setupDirectories() {
  const storePath = path.join(__dirname, '../../../store/', NODE_ID);
  await fs.mkdir(path.join(storePath, 'local'), {recursive: true});
  await fs.mkdir(path.join(storePath, 'groups'), {recursive: true});
}

/**
 * creates a dir
 * @param {string} dirPath
 */
async function createDirectory(dirPath) {
  await fs.mkdir(dirPath, {recursive: true});
}
