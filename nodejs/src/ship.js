require('dotenv').config()
require('date-utils');
const nqdm = require('nqdm');

const elastic = require('./module/myelastic');
const fs = require('fs');
const path = require('path');
const dist = process.env.DATA_DIR;
const prefix = process.env.ELASTIC_INDEX_PREFIX;

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

var slack = {
    channels: require(`${dist}/channels.json`),
    users: require(`${dist}/users.json`),
};

const userid2name = (id) => {
    let user = slack.users.find(u => u.id == id);
    return user ? user.name : "";
}

const ship = async (options) => {
    console.time("ship");
    console.log(options);
    if (options["i"]) {
        await createIndices();
    }
    let channels = slack.channels;
    if (options["c"]) {
        channels = channels.filter(c => c.id == options["c"]);
    }
    for (const channel of nqdm(channels)) {
        await shipChannel(channel, options);
    }
    console.timeEnd("ship");
}

const createIndices = async () => {
    console.time("createIndices");
    const indices = require('./template/slack.json');
    await elastic.client.indices.create({
        index: 'tweets',
        body: indices
    }, { ignore: [400] });
    console.timeEnd("createIndices");
}

const shipChannel = async (channel, options) => {
    const history = await loadChannel(channel.id, options["y"]);
    const docs = aggregate(history, channel.name);
    await bulkIndex(docs);
}

const loadChannel = async (id, target = null) => {
    const files = listFiles(`${dist}/history/${id}`);
    let history = [];
    for (const file of files) {
        if (target && !file.includes(target)) {
            continue;
        }
        const json = require(file);
        json.forEach(c => history.push(c));
    }
    return history;
}

const listFiles = (dirpath) => {
    let files = [];
    for (const dirent of fs.readdirSync(dirpath, { withFileTypes: true })) {
        const fp = path.join(dirpath, dirent.name);
        if (!dirent.isDirectory()) {
            files.push(fp);
        }
    }
    return files;
}

const aggregate = (messages, channelName) => {
    let docs = {};
    for (const message of messages) {
        const ts = message["ts"];
        const datetime = new Date(ts * 1000);
        const index = `${prefix}-${datetime.toFormat("YYYY-MM-DD")}`;
        message["@timestamp"] = datetime.toISOString();
        message["hour_of_day"] = datetime.getHours();
        message["day_of_week"] = datetime.getDay();
        message['user_name'] = userid2name(message['user']);
        message['channel_name'] = channelName;
        if (!docs[index]) {
            docs[index] = [];
        }
        docs[index].push(message);
    }
    return docs
}

const bulkIndex = async (docs) => {
    let bulk_body = [];
    for (const key in docs) {
        if (docs.hasOwnProperty(key)) {
            const dataset = docs[key];
            const body = dataset.flatMap(doc => [{ index: { _index: key, _type: 'slack-message' } }, doc]);
            bulk_body.push(body);
        }
    }
    const { body: bulkResponse } = await elastic.client.bulk({ refresh: true, bulk_body })
    sleep(10);
    if (bulkResponse.errors) {
        const erroredDocuments = []
        // The items array has the same order of the dataset we just indexed.
        // The presence of the `error` key indicates that the operation
        // that we did for the document has failed.
        bulkResponse.items.forEach((action, i) => {
            const operation = Object.keys(action)[0]
            if (action[operation].error) {
                erroredDocuments.push({
                    // If the status is 429 it means that you can retry the document,
                    // otherwise it's very likely a mapping error, and you should
                    // fix the document before to try it again.
                    status: action[operation].status,
                    error: action[operation].error,
                    operation: body[i * 2],
                    document: body[i * 2 + 1]
                })
            }
        })
        console.error(erroredDocuments);
    }
}

const main = () => {
    const argv = require("minimist")(process.argv.slice(2));
    ship(argv);
}

main();
