require('dotenv').config()

const { WebClient } = require('@slack/web-api');
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

module.exports.getChannels = async () => {
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
            // console.log(`getChannels.next:${JSON.stringify(param)}`);
            return web.conversations.list(param).then(pageLoaded);
        }
        // console.log(`getChannels.end:${channels.length}`);
        return channels;
    }
    // console.log(`getChannels.start:${JSON.stringify(param)}`);
    const res = await web.conversations.list(param).then(pageLoaded);
    return res
}

module.exports.getHistory = async (channel, oldest, latest) => {
    const param = {
        channel: channel,
        oldest: oldest.getTime() / 1000,
        latest: latest.getTime() / 1000,
        limit: 1000
    };
    let historys = [];
    function pageLoaded(res) {
        res.messages.forEach(m => historys.push(m));
        if (res.response_metadata && res.response_metadata.next_cursor && res.response_metadata.next_cursor !== '') {
            param.cursor = res.response_metadata.next_cursor;
            // console.log(`getHistory.next:${JSON.stringify(param)}`);
            return web.conversations.history(param).then(pageLoaded);
        }
        // console.log(`getHistory.end:${historys.length}`);
        return historys;
    }
    // console.log(`getHistory.start:${JSON.stringify(param)}`);
    const res = await web.conversations.history(param).then(pageLoaded);
    return res
}

module.exports.getUsers = async () => {
    const param = {
        limit: 100
    };
    let members = [];
    function pageLoaded(res) {
        res.members.forEach(c => members.push(c));
        if (res.response_metadata && res.response_metadata.next_cursor && res.response_metadata.next_cursor !== '') {
            param.cursor = res.response_metadata.next_cursor;
            // console.log(`getUsers.next:${JSON.stringify(param)}`);
            return web.users.list(param).then(pageLoaded);
        }
        // console.log(`getUsers.end:${members.length}`);
        return members;
    }
    // console.log(`getUsers.start:${JSON.stringify(param)}`);
    const res = await web.users.list(param).then(pageLoaded);
    return res
}
