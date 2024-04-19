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
   This will start the node and make it available for URL distribution.

   ```bash
   node ./distribution.js --port 7090
   ```

   You can run `./local_crawl_test.sh` to create these child process

   Open the loadUrls.js script and locate the configuration section.

   ```javascript
   const node1 = {
     ip: '127.0.0.1',
     port: 7090,
   };
   ```

   Update the configuration settings to match the IP address and port of the running node. For example:

   Replace '127.0.0.1' with the IP address of the EC2 instance or local node, and 7090 with the port number specified when starting the node.

   Save the changes to the loadUrls.js script.

   Run the loadUrls.js script to load the URLs into nodes using consistent hashing and sharding:

   This will distribute the URLs across the nodes based on the configured node's IP address and port.

   ```bash
   node loadUrls.js
   ```

   This will distribute the URLs across the nodes based on consistent hashing and sharding algorithms.
