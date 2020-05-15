require('dotenv').config()

const { WebClient } = require('@slack/web-api');
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

var fs = require("fs");

function getChannels() {
    const param = {
        exclude_archived: true,
        types: 'public_channel',
        limit: 200
    };
    let channels = [];
    function pageLoaded(res) {
        res.channels.forEach(c => channels.push(c));
        if (res.response_metadata && res.response_metadata.next_cursor && res.response_metadata.next_cursor !== '') {
            param.cursor = res.response_metadata.next_cursor;
            return web.conversations.list(param).then(pageLoaded);
        }
        return channels;
    }
    return web.conversations.list(param).then(pageLoaded);
}

getChannels()
    .then((d) => fs.writeFileSync("/tmp/channels.json", JSON.stringify(d, null, 4)))
    .catch(console.error);
