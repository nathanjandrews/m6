const axios = require('axios');
const jsdom = require('jsdom');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * The maximum number of URLs to crawl.
 * You can set this value by passing a command line argument when running the script.
 * For example, to set MAX_URLS to 2000, run: `node getUrls.js 2000`
 * If no command line argument is provided, the default value is 100k.
 */
const MAX_URLS = process.argv[2] || 200 * 1000;
const startingUrl = 'https://atlas.cs.brown.edu/data/gutenberg/';
const visitedUrls = new Set();
const datasetsUrl = `datasets-${MAX_URLS / 2}.txt`;
const urlPath = path.join(__dirname, datasetsUrl);

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function crawl(url) {
  if (visitedUrls.size >= MAX_URLS) {
    return;
  }

  try {
    const response = await axios.get(url, {httpsAgent: agent});
    const dom = new jsdom.JSDOM(response.data);
    console.log(`Crawling ${url}`, response.status);
    const curUrls = [];
    visitedUrls.add(url);
    dom.window.document.querySelectorAll('a').forEach((element) => {
      const href = element.getAttribute('href');
      if (href) {
        const resolvedUrl = new URL(href, url).href.split('?')[0];
        const cleanUrl = resolvedUrl.split('#')[0];
        console.log(cleanUrl);
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

if (fs.existsSync(urlPath)) {
  const data = fs.readFileSync(urlPath, 'utf8');
  const urls = data.split('\n');
  urls.forEach((url) => {
    visitedUrls.add(url);
  });
  crawl(urls.at(-1)).then(() => {
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
            console.log('Visited URLs written to ' + urlPath);
          }
        },
    );
  });
} else {
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
            console.log('Visited URLs written to ' + urlPath);
          }
        },
    );
  });
}
