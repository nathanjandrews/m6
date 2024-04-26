#!/bin/bash

# Get all EC2 instances
instances=$(aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text)

# Stop each instance
for instance in $instances; do
    aws ec2 stop-instances --instance-ids $instance
done