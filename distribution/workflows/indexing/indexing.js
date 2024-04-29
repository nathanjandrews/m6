// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {TYPES.MapReduceMapFn<any>} MapReduceMapFn */

/**
 * Runs a shell command with async/await and returns stdout from running the
 * command
 * @param {string} command
 * @param {string[]} args
 * @return {{error: Error?, output: string}} stdout from running command
 */
function exec(command, args) {
  const cp = global.child_process || require('child_process');
  const res = cp.spawnSync(command, args, {shell: '/bin/bash'});
  if (res.error) {
    return {error: res.error, output: res.output.toString()};
  } else {
    return {error: null, output: res.stdout.toString()};
  }
}

function process(content) {
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  const iconvLines = lines.map((line) => {
    const res = exec('iconv', ['-sct', 'ascii', `<(echo ${line})`]);
    return res.output.trim();
  });

  const trLines = iconvLines.map((line) => {
    const res = exec('tr', ['-cs', 'A-Za-z', '\\\\n', '<<<', `"${line}"`]);
    return res.output.toLowerCase().trim().split('\n');
  }).flat();

  const stopwordsPath = 'distribution/workflows/indexing/stopwords.txt';
  const grepLines = trLines.map((line) => {
    const res = exec('grep', ['-vwf', stopwordsPath, `<(echo ${line})`]);
    return res.output;
  });

  const filteredLines = grepLines
      .filter((line) => line.trim() != '')
      .map((line) => line.trim());

  return filteredLines.join('\n');
}

function stem(content) {
  const natural = global.natural || require('natural');
  const lines = content.split('\n');
  const stemmedLines = lines.map((line) => line.split(/\s+/)
      .map((word) => natural.PorterStemmer.stem(word))
      .join(' '));
  return stemmedLines
      .filter((line) => line.trim() !== '')
      .join('\n');
}

function formNGrams(content) {
  const lines = content.split('\n');
  const window = [];
  const output = [];
  for (const line of lines) {
    window.push(line);
    if (window.length === 3) {
      output.push(window[0]);
      output.push(`${window[0]} ${window[1]}`);
      output.push(`${window[0]} ${window[1]} ${window[2]}`);
      window.shift();
    }
  }

  if (window.length === 2) {
    output.push(window[0]);
    output.push(`${window[0]} ${window[1]}`);
    output.push(window[1]);
  } else if (window.length == 1) {
    output.push(window[0]);
  }

  return output.join('\n').trim();
}

function invert(content) {
  const sorted = exec('sort', [`<(echo "${content}")`]).output.trimEnd();
  const uniq = exec('uniq', ['--count', `<(echo "${sorted}")`]).output.trimEnd();
  const formatted = uniq.split('\n').map((line) => {
    const trimmedLine = line.trim();
    const spaceIndex = trimmedLine.indexOf(' ');
    const number = trimmedLine.substring(0, spaceIndex).trim();
    const nGram = trimmedLine.substring(spaceIndex + 1).trim();
    return {nGram, number};
  });
  return formatted;
}

function index(content) {
  const p = process(content);
  const s = stem(p);
  const n = formNGrams(s);
  const i = invert(n);
  return i;
}

/**
 * Map Function for indexing Map-Reduce workflow
 * @param {string} key
 * @param {object} value
 * @return {object}
 */
function indexingMap(key, value) {
  const url = Object.keys(value)[0];
  const content = Object.values(value)[0];
  const out = {};
  const nGrams = index(content);
  for (const {nGram, number} of nGrams) {
    out[nGram] = {number, url};
  }
  // @ts-ignore
  return out;
}

/**
 * Reduce function for indexing Map-Reduce workflow
 * @param {string} key
 * @param {{number: string, url: string}[]} values
 * @return {object}
 */
function indexingReduce(key, values) {
  const urlFrequencies = values
      .map((value) => `${value.url} ${value.number}`)
      .join(' ');
  const index = `${key} | ${urlFrequencies}`;
  return index;
}

/**
 * @param {MapReduceMapFn} mapFunction
 * @param {Function[]} dependencyFns
 * @return {Function}
 */
function buildMappingFunction(mapFunction, dependencyFns) {
  const mapFnLines = mapFunction.toString().split('\n');
  const mapFnHeader = mapFnLines[0];
  const mapFnBody = mapFnLines.slice(1);

  for (const fn of dependencyFns) {
    mapFnBody.unshift(fn.toString());
  }

  mapFnBody.unshift('return ' + mapFnHeader);
  const fn = new Function(mapFnBody.join('\n'));
  return fn;
}

module.exports = {
  indexingMap: buildMappingFunction(indexingMap, [
    exec,
    process,
    stem,
    formNGrams,
    invert,
    index])(),
  indexingReduce,
};
