#!bin/bash

LOG_DIR="/root/youtube/logs/"

find "$LOG_DIR" -type f -name "*.log" -mtime +2 -exec rm {} \;
find "$LOG_DIR" -type f -name "*.log.gz" -mtime +2 -exec rm {} \;
