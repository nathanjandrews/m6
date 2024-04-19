const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * The maximum number of URLs to crawl.
 * You can set this value by passing a command line argument when running the script.
 * For example, to set MAX_URLS to 2000, run: `node getUrls.js 2000`
 * If no command line argument is provided, the default value is 100k.
 */
const MAX_URLS = process.argv[2] || 100 * 1000;
const startingUrl = 'https://atlas.cs.brown.edu/data/gutenberg/';
const visitedUrls = new Set();
const urlPath = path.join(__dirname, 'datasets.txt');

const agent = new https.Agent({
  rejectUnauthorized: false,
});
async function crawl(url) {
  if (visitedUrls.size >= MAX_URLS) {
    return;
  }

  try {
    const response = await axios.get(url, {httpsAgent: agent});
    const $ = cheerio.load(response.data);
    const curUrls = [];
    visitedUrls.add(url);
    $('a').each((index, element) => {
      const href = $(element).attr('href');
      if (href) {
        const resolvedUrl = new URL(href, url).href.split('?')[0];
        const cleanUrl = resolvedUrl.split('#')[0];
        if (
          cleanUrl &&
          cleanUrl.includes('gutenberg') &&
          cleanUrl.includes('brown') &&
          !visitedUrls.has(cleanUrl)
        ) {
          curUrls.push(cleanUrl);
        }
      }
    });
    for (const curUrl of curUrls) {
      await crawl(curUrl);
    }
  } catch (error) {
    console.error(`Error crawling ${url}: ${error.message}`);
  }
}

crawl(startingUrl).then(() => {
  console.log(`Found ${visitedUrls.size} unique URLs:`);

  fs.writeFile(
    urlPath,
    Array.from(visitedUrls)
      .filter((url) => url.endsWith('.txt'))
      .join('\n'),
    (err) => {
      if (err) {
        console.error('Error writing to file:', err);
      } else {
        console.log('Visited URLs written to datasets.txt');
      }
    },
  );
});
