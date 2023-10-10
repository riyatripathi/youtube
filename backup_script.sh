#!bin/bash

DB_FILE='/root/youtube/database.db'
BACKUP_DIR='/root/youtube/backupDB/'

current_date_time=$(date +"%Y_%m_%d_%H_%M_%S")
BACKUP_FILENAME="backup_${current_date_time}.tar.gz"

cd "$BACKUP_DIR" || exit

tar -czvf "$BACKUP_FILENAME" "$DB_FILE"

