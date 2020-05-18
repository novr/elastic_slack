require('dotenv').config()
require('date-utils');

var slack = require('./module/myslack')
var fs = require('fs');
const dist = process.env.DATA_DIR

async function exportSlack(oldest, latest) {
    const historyPath = `${dist}/history`;
    if (!fs.existsSync(historyPath)) {
        fs.mkdirSync(historyPath, { recursive: true });
    }

    const channels = await slack.getChannels();
    fs.writeFileSync(`${dist}/channels.json`, JSON.stringify(channels));

    for(const channel of channels) {
        const historyJson = `${historyPath}/${channel.id}.json`
        var history = []
        if (fs.existsSync(historyJson)) {
            history = require(historyJson);
        }
        const res = await slack.getHistory(channel.id, oldest, latest);
        history.push(res);
        fs.writeFileSync(historyJson, JSON.stringify(history));
    }
}

const main = async () => {
    var oldest = 0;
    var latest = Date.yesterday().getTime()
    const paramPath = `${dist}/param.json`;
    if (fs.existsSync(paramPath)) {
        oldest = require(paramPath).latest;
    }
    console.log(`oldest: ${oldest}, latest: ${latest}`);
    if (oldest == latest) {
        return
    }

    await exportSlack(oldest, latest);

    var param = { latest: latest };
    fs.writeFileSync(paramPath, JSON.stringify(param, null, 4));
}

main();
