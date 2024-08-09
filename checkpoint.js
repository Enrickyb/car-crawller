const fs = require('fs');
const path = './checkpoint.txt';

function getCheckpoint() {
    if (fs.existsSync(path)) {
        const data = fs.readFileSync(path, 'utf8');
        return parseInt(data, 10);
    }
    return 0;
}

function setCheckpoint(index) {
    fs.writeFileSync(path, index.toString());
}
