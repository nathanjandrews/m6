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
  const fileName = Buffer.from(itemKey).toString('base64');
  if (groupKey === null) {
    filePath = path.join(LOCAL_DIR_PATH, fileName);
  } else {
    const dirPath = path.join(GROUPS_DIR_PATH, groupKey);
    filePath = path.join(dirPath, fileName);
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
      const keys = fileNames
          .map((k) => Buffer.from(k, 'base64').toString());
      cb(null, keys);
    } catch (error) {
      cb(error);
    }
    return;
  }

  const fileName = Buffer.from(itemKey).toString('base64');
  const filePath = path.join(dirPath, fileName);
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
  const fileName = Buffer.from(itemKey).toString('base64');
  if (groupKey === null) {
    filePath = path.join(LOCAL_DIR_PATH, fileName);
  } else {
    filePath =
      path.join(GROUPS_DIR_PATH, groupKey, fileName);
  }

  try {
    const value = deserialize((await fs.readFile(filePath)).toString());
    await fs.rm(filePath);
    cb(null, value);
  } catch (error) {
    cb(new Error(error));
  }
};

/**
 * Store MERGE method - merge two files only for MapReduce
 * @param {string} value
 * @param {{key: string, gid: string}} nullableKey
 * @param {ServiceCallback} [callback]
 */
store.merge = async function(value, nullableKey, callback) {
  await setupDirectories();
  const cb = callback || function() {};
  const {key, gid} = nullableKey;
  const fileName = Buffer.from(key).toString('base64');
  const filePath = path.join(GROUPS_DIR_PATH, gid, fileName);

  const parseToMap = (str) => {
    const map = new Map();
    const parts = str.split(' ');
    for (let i = 0; i < parts.length; i += 2) {
      map.set(parts[i], parts[i + 1]);
    }
    return map;
  };

  try {
    const existingValue = (await fs.readFile(filePath)).toString();
    const existingMap = parseToMap(existingValue);
    const currentMap = parseToMap(value);
    for (const [url, count] of currentMap) {
      const existingCount = existingMap.get(url) || 0;
      existingMap.set(url, existingCount + count);
    }
    const merged = [];
    for (const [url, count] of existingMap) {
      merged.push(`${url} ${count}`);
    }
    await fs.writeFile(filePath, serialize(merged.join(' ')));
    cb(null, merged.join(' '));
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(path.join(GROUPS_DIR_PATH, gid), {recursive: true});
      await fs.writeFile(filePath, serialize(value));
      cb(null, value);
    } else {
      cb(new Error(error));
    }
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
