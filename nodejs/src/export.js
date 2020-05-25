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
    if (fs.existsSync(channelsJson) && latest == param.channels) {
        channels = require(channelsJson);
        console.log("exportChannels:skip");
    } else {
        console.time("exportChannels");
        channels = await slack.getChannels();
        fs.writeFileSync(channelsJson, JSON.stringify(channels, null, 4));
        param.channels = latest;
        saveParam(param);
        console.timeEnd("exportChannels");
    }
    return channels;
}

const exportHistory = async (channel, oldest, latest, appned = false) => {
    const historyPath = `${dist}/history/${channel.id}`;
    if (!fs.existsSync(historyPath)) {
        fs.mkdirSync(historyPath, { recursive: true });
    }
    const res = await slack.getHistory(channel.id, oldest, latest);
    const historyJson = `${historyPath}/${oldest.toFormat("YYYY")}.json`
    let history;
    if (appned && fs.existsSync(historyJson)) {
        history = res.concat(require(historyJson));
    } else {
        history = res;
    }
    if (history.length > 0) {
        fs.writeFileSync(historyJson, JSON.stringify(history, null, 4));
    }
    return history;
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
        param.historys = new Date(nowYear, 0, 1).getTime();
        saveParam(param);
    } else {
        console.log("exportPastHistorys:skip");
    }
    const oldest = new Date(param.historys);
    if (oldest.getTime() != latest.getTime()) {
        await exportDiffHistorys(channels, oldest, latest, param);
        param.historys = latest.getTime();
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
    var latestTime = latest.getTime();

    let channels = await exportChannels(param, latestTime);

    await exportHistorys(channels, param, latest);

}

main();
