#!/bin/bash

# rm -rf ./store/*

node_configs=()
for ((i = 0; i < 10; i++)); do
    node ./distribution.js --port $((7090 + i)) &
    node_configs+=("{\"ip\": \"127.0.0.1\", \"port\": $((7090 + i))}")
done

node_configs_string=$(
    IFS=,
    echo "${node_configs[*]}"
)

echo "[$node_configs_string]" >./crawler/nodes.json
wait
