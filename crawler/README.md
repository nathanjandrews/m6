# Crawler Workflow

1. retrieve URLs using the `getUrls.js` script and stores the results in the `datasets.txt` file.
2. use the `loadUrls.js` script to load the URLs into nodes using consistent hashing and sharding.

## Usage

1. Run the `getUrls.js` script to retrieve the URLs:

   ```bash
   node getUrls.js 1000
   ```

   This will populate the `datasets.txt` file with the retrieved URLs.

   If no command line argument is provided, the default value is 100k.

2. Start the EC2 instance or local node by running the following command in the terminal:
   You can run `./local_crawl_test.sh` to create these child process locally,
   Or you can run `./ec2_crawl_test.sh` to get all the ec2 instances from your aws cli

   Update the configuration settings to match the IP address and port of the running node in `./nodes.json`. For example:

   Replace `127.0.0.1` with the IP address of the EC2 instance or local node, and `7090` with the port number specified when starting the node.

   Run the `node ./loadUrls.js` script to load the URLs into nodes using consistent hashing and sharding:

   This will distribute the URLs across the nodes based on the configured node's IP address and port.

   ```bash
   node ./loadUrls.js --env local --urls 100
   ```

3. Use the `getTexts.js` script to scrape the HTML text from the URLs and store the pages in `storeGid` group:

   ```bash
   node ./getTexts.js --env local
   ```

   This script will retrieve the HTML content from each URL in the `datasets.txt` file and store the pages in the `storeGid` group directory.

   Note: Make sure that the `datasets.txt` file contains the URLs you want to scrape before running this script.


