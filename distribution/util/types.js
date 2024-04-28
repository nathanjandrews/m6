/** @typedef {{ip: string, port: number, onStart?: (server: any) => void}}
 * NodeConfig */

/** @typedef {(arg?: any) => number} SubsetFn */

/** @typedef {(kid: string, nids: string[]) => string} HashFn */

/** @typedef {{ gid: string, subset?: SubsetFn, hash?: HashFn }} GroupConfig */

/**
 * @template E
 * @template T
 * @typedef {(error: E | null, value?: T) => void} ServiceCallback
 */

/** @typedef {Map<string, Record<string, NodeConfig>>} GroupsToNodeMapping */

/**
 * @template T
 * @typedef {(key: string, value: any) => {[key: string]: T}} MapReduceMapFn
 * */

/**
 * @template T
 * @typedef {(key: string, values: T[]) => {[key: string]: T}}
 *  MapReduceReduceFn
 */

/**
 * @template T
 * @typedef {{
 *  keys: string[]
 *  map: MapReduceMapFn<T>
 *  reduce: MapReduceReduceFn<T>
 *  memory?: boolean
 *  loadGid?: string
 *  storeGid?: string
 *  compact?: boolean
 *  cleanup?: boolean
 *  noShuffle?: boolean
 *  reduceStore?: boolean
 * }} MapReduceConfiguration
 */

/**
 * @typedef {{
 *  gid: string,
 *  serviceName: string,
 *  memory: boolean
 *  loadGid?: string
 *  storeGid?: string
 *  compact?: boolean
 *  cleanup?: boolean
 *  noShuffle?: boolean
 *  reduceStore?: boolean
 * }} LocalMapReduceContext
 */

module.exports = {};
