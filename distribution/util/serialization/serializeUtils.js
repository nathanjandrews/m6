/**
 * @typedef {import('./serialize.js').SerializableNode<any>} SerializableNode */

/**
 * Checks if a value is a terminal
 * @param {any} value some value
 * @return {boolean} true if value is a terminal, and false otherwise
 */
function isTerminal(value) {
  if (value === null) {
    return true;
  }

  if ((typeof value !== 'object') && (typeof value !== 'function')) {
    return true;
  }

  if (value instanceof Date) {
    return true;
  }

  if (value instanceof Error) {
    return true;
  }

  return false;
}

/**
 * Serializes a terminal value
 * @param {any} terminal
 * @return {SerializableNode}
 */
function serializeTerminal(terminal) {
  if (terminal === null) {
    return {
      type: 'null',
    };
  }

  if (terminal instanceof Date) {
    return {
      type: 'date',
      value: terminal.toISOString(),
    };
  }

  if (terminal instanceof Error) {
    return {
      type: 'error',
      value: terminal.message,
    };
  }

  switch (typeof terminal) {
    case 'string':
      return {
        type: 'string',
        value: terminal,
      };
    case 'number':
      return {
        type: 'number',
        value: terminal,
      };
    case 'bigint':
      return {
        type: 'bigint',
        value: terminal.toString(),
      };
    case 'boolean':
      return {
        type: 'boolean',
        value: terminal,
      };
    case 'symbol':
      return {
        type: 'symbol',
        value: terminal.toString(),
      };
    case 'undefined':
      return {
        type: 'undefined',
      };
  }

  throw new Error(
      'expected terminal value, instead got a value with type ' +
      `"${typeof terminal}": ${terminal}`,
  );
}

module.exports = {
  isTerminal,
  serializeTerminal,
};
