

function indexNativeFunctions() {
  const rootObjects = [
    {name: 'globalThis', value: globalThis},
  ];

  /** @type {Map<any, string>} */
  const nFunctionsForward = new Map();
  const nFunctionsReverse = new Map();
  const nObjects = new Set([globalThis]);

  for (const {name, value} of rootObjects) {
    if (typeof value === 'function') {
      nFunctionsForward.set(value, name);
      nFunctionsReverse.set(name, value);
    }

    if (typeof value === 'object' && value !== null) {
      for (const key of Object.getOwnPropertyNames(value)) {
        const childValue = value[key];
        if (!nFunctionsForward.has(childValue) && !nObjects.has(childValue)) {
          rootObjects.push({name: name + '.' + key, value: childValue});
        }
        nObjects.add(childValue);
      }
    }
  }


  return {nFunctionsForward, nFunctionsReverse};
}

const {nFunctionsForward, nFunctionsReverse} = indexNativeFunctions();

module.exports = {
  NATIVE_FORWARD_MAPPING: nFunctionsForward,
  NATIVE_REVERSE_MAPPING: nFunctionsReverse,
};
