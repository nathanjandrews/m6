#!/bin/bash

ip_addresses=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].PublicIpAddress' --output text)

node_configs_string=""
for ip in $ip_addresses; do
    node_configs_string+="{\"ip\": \"$ip\", \"port\": 8080}, "
done
node_configs_string=${node_configs_string%, }

echo "[$node_configs_string]" > ./crawler/ec2-nodes.json

ssh_commands=""
for ip in $ip_addresses; do
    ip_with_dash=$(echo $ip | tr '.' '-')
    ssh_commands+="ssh -i \"~/Apr15.pem\" ec2-user@ec2-${ip_with_dash}.us-east-2.compute.amazonaws.com \"cd ./m6 && ./start.sh\"\n"
    # ssh_commands+="ssh -i \"~/Apr15.pem\" ec2-user@ec2-${ip_with_dash}.us-east-2.compute.amazonaws.com \"kill -9 \$(lsof -t -i:8080)\"\n\n"
done
echo -e "$ssh_commands" > ./crawler/ec2-ssh.sh

