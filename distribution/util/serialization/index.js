const {serialize: verboseSerialize} = require('./serialize');
const {deserialize: verboseDeserialize} = require('./deserialize');
const {setIdSeed} = require('./id.js');

/**
 * @template T
 * @typedef {{type: string, value?: T, id?: string}} SerializableNode<T> */

/**
 * A map of objects that contain the current object being serialized. This map
 * is used to serialize self-references object loops at arbitrary depths within
 * an object
 * @template TE
 * @typedef {Map<any, TE>} Wrappers<TE>
 */

/**
 * Serializes some value
 * @param {any} data
 * @return {string}
 */
function serialize(data) {
  setIdSeed(0);

  const {sNode: serializedValue} = verboseSerialize(data, new Map());
  if (serializedValue === null) {
    throw new Error(`malformed data input: ${data}`);
  }

  return JSON.stringify(serializedValue);
}

/**
 * Deserializes some serialized value
 * @param {string} serializedData
 * @return {any}
 */
function deserialize(serializedData) {
  const s = JSON.parse(serializedData);
  return verboseDeserialize(s, new Map());
}


module.exports = {
  serialize,
  deserialize,
};
