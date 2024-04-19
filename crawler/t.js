const https = require('https');
const url = 'https://atlas.cs.brown.edu/data/gutenberg/1/0/0/8/10084/10084.txt';

const hostname = new URL(url).hostname;
const path = new URL(url).pathname;

https.get(
  {
    hostname: hostname,
    path: path,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'text/html',
    },
    rejectUnauthorized: false,
  },
  (response) => {
    // const links = [];

    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('error', (error) => {
      console.error(`Error: ${error.message}`);
    });
    response.on('end', () => {
      console.log('data:', data);
    });
  },
);

const nodes = require('./nodes.json');
console.log(nodes);
