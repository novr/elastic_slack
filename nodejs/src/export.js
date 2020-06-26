require('dotenv').config()
require('date-utils');
const nqdm = require('nqdm');

var slack = require('./module/myslack');
var fs = require('fs');
const dist = process.env.DATA_DIR;
const paramPath = `${dist}/param.json`;

const exportChannels = async (param, latest) => {
    const channelsJson = `${dist}/channels.json`;
    let channels;
    if (fs.existsSync(channelsJson) && latest.getTime() == param.channels) {
        channels = require(channelsJson);
        console.log("exportChannels:skip");
    } else {
        console.time("exportChannels");
        channels = await slack.getChannels();
        fs.writeFileSync(channelsJson, JSON.stringify(channels, null, 4));
        param.channels = latest.getTime();
        param.channelsDate = latest;
        saveParam(param);
        console.timeEnd("exportChannels");
    }
    return channels;
}

const exportUsers = async (param, latest) => {
    const usersJson = `${dist}/users.json`;
    let users;
    if (fs.existsSync(usersJson) && latest.getTime() == param.users) {
        users = require(usersJson);
        console.log("exportUsers:skip");
    } else {
        console.time("exportUsers");
        users = await slack.getUsers();
        fs.writeFileSync(usersJson, JSON.stringify(users, null, 4));
        param.users = latest.getTime();
        param.usersDate = latest;
        saveParam(param);
        console.timeEnd("exportUsers");
    }
    return users;
}

const exportEmojis = async (param, latest) => {
    const emojisJson = `${dist}/emojis.json`;
    let emojis;
    if (fs.existsSync(emojisJson) && latest.getTime() == param.emojis) {
        emojis = require(emojisJson);
        console.log("exportEmojis:skip");
    } else {
        console.time("exportEmojis");
        emojis = await slack.getEmojis();
        fs.writeFileSync(emojisJson, JSON.stringify(emojis, null, 4));
        param.emojis = latest.getTime();
        param.emojisDate = latest;
        saveParam(param);
        console.timeEnd("exportEmojis");
    }
    return emojis;
}

const exportHistory = async (channel, oldest, latest, appned = false) => {
    const historyPath = `${dist}/history/${channel.id}`;
    if (!fs.existsSync(historyPath)) {
        fs.mkdirSync(historyPath, { recursive: true });
    }
    const res = await slack.getHistory(channel.id, oldest, latest);
    if (res.length == 0) {
        return [];
    }
    let jsons = {};
    res.forEach(value => {
        const key = new Date(value.ts * 1000).toFormat("YYYY-MM-DD");
        if (jsons.hasOwnProperty(key)) {
            jsons[key].push(value);
        } else {
            jsons[key] = [value];
        }
    });
    for (const key in jsons) {
        if (!jsons.hasOwnProperty(key)) {
            continue;
        }
        const historyJson = `${historyPath}/${key}.json`
        let history = jsons[key];
        if (history.length > 0) {
            fs.writeFileSync(historyJson, JSON.stringify(history, null, 4));
        }
    }
    return res;
}

const exportPastHistorys = async (channels, year) => {
    const oldest = new Date(year, 0, 1);
    const latest = new Date(year + 1, 0, 1);
    console.log(`exportPastHistorys: ${oldest.toFormat("YYYY/MM/DD")}~${latest.toFormat("YYYY/MM/DD")}`);
    const latestCreate = latest.getTime() / 1000;
    console.time("exportPastHistorys:" + year);
    for (const channel of nqdm(channels.filter(c => c.created < latestCreate))) {
        await exportHistory(channel, oldest, latest);
    }
    console.timeEnd("exportPastHistorys:" + year);
}

const exportDiffHistorys = async (channels, oldest, latest, param) => {
    console.log(`exportDiffHistorys: ${oldest.toFormat("YYYY/MM/DD")}~${latest.toFormat("YYYY/MM/DD")}`);
    console.time("exportDiffHistorys");
    for (const channel of nqdm(channels)) {
        await exportHistory(channel, oldest, latest, true);
    }
    console.timeEnd("exportDiffHistorys");
}

const exportHistorys = async (channels, param, latest) => {
    const lastYear = param.lastYear || parseInt(process.env.SLACK_INIT_YEAR);
    const nowYear = latest.getFullYear();
    if (lastYear != nowYear) {
        for (let year = lastYear; year < nowYear; year++) {
            await exportPastHistorys(channels, year);
            param.lastYear = year + 1;
            saveParam(param);
        }
        const historysDate = new Date(nowYear, 0, 1);
        param.historys = historysDate.getTime();
        param.historysDate = historysDate;
        saveParam(param);
    } else {
        console.log("exportPastHistorys:skip");
    }
    const oldest = new Date(param.historys);
    if (oldest.getTime() != latest.getTime()) {
        await exportDiffHistorys(channels, oldest, latest, param);
        param.historys = latest.getTime();
        param.historysDate = latest;
        saveParam(param);
    } else {
        console.log("exportDiffHistorys:skip");
    }
}

const loadParam = function () {
    var param = {};
    if (fs.existsSync(paramPath)) {
        param = require(paramPath);
    }
    return param;
}

const saveParam = function (param) {
    fs.writeFileSync(paramPath, JSON.stringify(param, null, 4));
}

const main = async () => {
    var param = loadParam();

    var latest = Date.yesterday();

    let channels = await exportChannels(param, latest);
    console.log("channels: " + channels.length);

    let users = await exportUsers(param, latest);
    console.log("users: " + users.length);

    let emojis = await exportEmojis(param, latest);
    console.log("emojis: " + emojis.length);

    await exportHistorys(channels, param, latest);

}

main();
