#!/bin/bash

# Define the target URL
TARGET_URL="https://sotrendzy.store/"  # Replace with your server's URL

# Define the number of concurrent requests
CONCURRENT_REQUESTS=100  # Adjust as needed

# Define the total number of requests to send
TOTAL_REQUESTS=1000  # Adjust as needed

# Initialize counters for successes and failures
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Loop to send concurrent requests
for ((i = 0; i < CONCURRENT_REQUESTS; i++)); do
  # Send requests in the background and capture the response status
  response=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL")
  echo "$i"  
  if [ "$response" = "200" ]; then
    ((SUCCESS_COUNT++))
  else
    ((FAILURE_COUNT++))
  fi &
done

# Wait for all requests to complete
wait

echo "Load test completed: $TOTAL_REQUESTS requests sent."
echo "Successes: $SUCCESS_COUNT"
echo "Failures: $FAILURE_COUNT"

