#!/bin/bash

# Check if the number of nodes argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide the number of nodes as an argument."
    exit 1
fi

num_nodes=$1

# rm -rf ./store/*

node_configs=()
for ((i = 0; i < num_nodes; i++)); do
    node ./distribution.js --port $((7000 + i)) &
    node_configs+=("{\"ip\": \"127.0.0.1\", \"port\": $((7000 + i))}")
done

node_configs_string=$(
    IFS=,
    echo "${node_configs[*]}"
)

echo "[$node_configs_string]" >./nodes.json
wait
