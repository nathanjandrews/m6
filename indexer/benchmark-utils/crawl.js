const fs = require('fs');
const path = require('path');
const {faker} = require('@faker-js/faker');
const {convert} = require('html-to-text');
faker.seed(123);

/**
 * @param {1 | 10 | 100 | 1000 | 10000 | 100000} numUrls
 * @return {object}
 */
function getUrlPages(numUrls) {
  const datasetPath = path.join(__dirname, `../data/datasets-${numUrls}.txt`);
  const data = fs.readFileSync(datasetPath, 'utf-8').split('\n');
  if (data.length < numUrls) {
    throw new Error(`too few URLs. expected at least ${numUrls} URLs but got ${data.length}`);
  }

  const urls = data.slice(0, numUrls);
  const fetch = require('sync-fetch');
  global.process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

  const output = [];

  for (const url of urls) {
    const obj = {};
    const res = fetch(url, {headers: {'Content-Type': 'text/html'}});
    obj[url] = convert(res.text()).trim();
    output.push({key: faker.string.alphanumeric({length: 5, casing: 'upper'}), value: obj});
  }

  return output;
}

module.exports = {
  getUrlPages,
};
