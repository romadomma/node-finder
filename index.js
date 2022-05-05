"use strict"

const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');

class Phrase {
    constructor(text) {
        this.source = text;
        this.findPart = text;
        this.numberOfMatches = 0;
    }

    matchPart(str) {
        if (this.findPart.indexOf(str) === 0) {
            this.findPart = this.findPart.slice(str.length);
            if (!this.findPart) {
                this.numberOfMatches++;
                this.reset();
            }
        } else {
            this.reset();
        }
    }

    reset() {
        this.findPart = this.source;
    }
}

const resetPhrases = findPhrases => findPhrases.forEach(phrase => phrase.reset());

const fileScan = async (fileName, findPhrases) => {
    const readStream = fs.createReadStream(fileName, { highWaterMark: 1024 });
    readStream.on('data', data => {
        for (let char of data.toString()) {
            for (let phrase of findPhrases) {
                phrase.matchPart(char);
            }
        }
    });
    resetPhrases(findPhrases);
}

const search = async findPhrases => {
    let [,,, findPath] = process.argv;

    if (!findPath) {
        throw Error('Search path is empty.');
    }

    findPath = path.join(__dirname, findPath);

    try {
        const stat = await fsPromises.stat(findPath);
        if (!stat.isDirectory()) {
            throw Error('Path for searching is not directory.');
        }
    } catch(err) {
        if (err.code === 'ENOENT') {
            throw Error('Invalid path for searching.');
        } else {
            throw err;
        }
    }

    const listOfDirs = new Set([await fsPromises.opendir(findPath)]);
    for (let curDir of listOfDirs) {
        for await (let entry of curDir) {
            const entryPath = path.join(curDir.path, entry.name);
            if (entry.isDirectory())
            {
                listOfDirs.add(await fsPromises.opendir(entryPath));
            } else if(entry.isFile()) {
                await fileScan(entryPath, findPhrases);
            }
        }
        listOfDirs.delete(curDir);
    }
}

const getFindPhrases = async () => {
    let [,, findPhrasesFilePath] = process.argv;

    if (!findPhrasesFilePath) {
        throw Error('Path for file with find phrases is empty.');
    }

    findPhrasesFilePath = path.join(__dirname, findPhrasesFilePath);

    try {
        await fsPromises.access(findPhrasesFilePath, fs.constants.R_OK);
    } catch(err) {
        if (err.code === 'ENOENT') {
            throw Error('Invalid path for find phrases file.');
        } else {
            throw err;
        }
    }

    return (await fsPromises.readFile(findPhrasesFilePath, { encoding: 'utf8' }))
        .split('\n')
        .filter(Boolean)
        .map(v => new Phrase(v));
}

(async function() {
    try {
        const findPhrases = await getFindPhrases();
        await search(findPhrases);
        findPhrases.forEach(phrase => {
            console.log(`"${phrase.source}"\t${phrase.numberOfMatches} matches`);
        });
    } catch (e) {
        console.error(e.message);
    }
})();
