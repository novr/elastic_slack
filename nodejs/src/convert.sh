#!/bin/sh

json2csv -i /tmp/channels.json -c /app/src/template/csv/channels.json -o /tmp/csv/channels.csv
json2csv -i /tmp/emojis.json -c /app/src/template/csv/emojis.json -o /tmp/csv/emojis.csv
json2csv -i /tmp/users.json -c /app/src/template/csv/users.json -o /tmp/csv/users.csv
