#!/bin/bash

num_nodes=1
num_urls=$1

# Check if num_urls is empty
if [ -z "$num_urls" ]; then
    echo "Number of nodes not provided."
    exit 1
fi

SCRIPT_DIRECTORY="$(dirname $(realpath "$1"))"
# Run node "$SCRIPT_DIRECTORY/engine/scraper.js" and collect the result
node "$SCRIPT_DIRECTORY/urls/loadUrls.js" --urls $num_urls >> "$SCRIPT_DIRECTORY/benchmark/$num_nodes.txt"

node "$SCRIPT_DIRECTORY/engine/scraper.js" >> "$SCRIPT_DIRECTORY/benchmark/$num_nodes.txt"


# node "$SCRIPT_DIRECTORY/engine/scraper.js"
# # Run node ../urls/loadUrls.js with the argument
# node ../urls/loadUrls.js --urls $num_urls

# # Run node ../engine/scraper.js
# node ../engine/scraper.js

# # When it's done, run node ../engine/indexer.js
# node ../engine/indexer.js