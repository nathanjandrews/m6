#!/bin/bash

ip_addresses=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].PublicIpAddress' --output text)

node_configs_string=""
for ip in $ip_addresses; do
    node_configs_string+="{\"ip\": \"$ip\", \"port\": 8080}, "
done
node_configs_string=${node_configs_string%, }

echo "[$node_configs_string]" > ./crawler/ec2-nodes.json
