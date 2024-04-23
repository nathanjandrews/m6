#!/bin/bash

if ! command -v node &> /dev/null
then
    echo "Error: Node.js is not installed. Please install Node.js before running this script."
    exit 1
fi

npm i

rm -rf ./store/*

node ./distribution.js --ip 0.0.0.0 --port 8080