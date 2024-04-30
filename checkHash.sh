#!/bin/bash

args=${1:-"crawler"}

# Get the first directory names under ./store/ and ignore ./store
dirs=$(find ./store/ -maxdepth 1 -mindepth 1 -type d -printf "%f\n")

# Print the directory names
# echo "$dirs"
echo "Number of nodes: $(echo "$dirs" | wc -l)"

total=0  # Initialize total count

for dir in $dirs; do
    count=$(find "./store/$dir/groups/$args" -type f | wc -l)
    echo "Number of files under ./store/$dir/groups/$args: $count"
    total=$((total + count))  # Add count to total
done

echo "Total count: $total"  # Echo the total count