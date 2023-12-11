const express = require('express');
const app = express();
const http = require('http').Server(app);
const bodyparser = require('body-parser');
const io = require('socket.io')(http);
const hentaigana = require('./hentaigana.json');
const fs = require('fs').promises;
const config = require('./config.json');
const crypto = require('crypto');
const path = require('path');

app.set('view engine', 'ejs');
app.use(express.static('static'));

app.get('/', function (req, res) {
    return res.render('main');
});

app.get('/start', function (req, res) {
    return res.render('start');
});

http.listen(config.port, function () {
    console.log('Server on');
});

io.on('connection', function (socket) {    
    socket.on('disconnect', function () {
        
    });
    socket.on('chose', function (data) {
        try {
            const dec = JSON.parse(decode(data.info));
            const answers = hentaigana.characters[dec.idx].answers;
            if (answers.includes(data.answer)) {
                socket.emit('rslt', {
                    color: '03C04A',
                    msg: '正しい'
                });
                setTimeout(function () {
                    update(socket, dec.solved + 1, dec.total + 1);
                }, 1000);
            } else {
                socket.emit('rslt', {
                    color: 'DC143C',
                    msg: `違う; 正解: ${answers.join(', ')}`
                });
                setTimeout(function () {
                    update(socket, dec.solved, dec.total + 1);
                }, 1000);
            }
        } catch (e) {
            console.log(e);
        }
    });
    update(socket, 0, 0);
});

function random(x) {
    return Math.floor(Math.random() * x);
}

function encode(str) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', config.secret, iv);
    const ret = cipher.update(str, 'utf-8', 'base64');
    return {
        iv: iv,
        data: ret + cipher.final("base64")
    }
}

function decode(str) {
    const iv = crypto.randomBytes(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', config.secret, str.iv);
    const ret = decipher.update(str.data, 'base64', 'utf-8');
    return ret + decipher.final('utf-8');
}

const choice_size = 10;

function invalid(idx, choice) {
    if (choice.length != choice_size) return true;
    for (var i = 0; i < choice.length; i++) for (var j = i + 1; j < choice.length; j++) if (choice[i] == choice[j]) return true;
    const answer = hentaigana.characters[idx].answers;
    for (var i = 0; i < answer.length; i++) {
        var occur = false;
        for (var j = 0; j < choice.length; j++) if (answer[i] == choice[j]) occur = true;
        if (!occur) return true;
    }
    return false;
}

async function update(socket, solved, total) {
    var idx = random(hentaigana.characters.length);
    const figure = await fs.readFile(path.join(__dirname, 'images/' + hentaigana.characters[idx].filename));
    const encrypted = encode(JSON.stringify({
        salt: config.salt + crypto.randomBytes(16),
        idx: idx,
        solved: solved,
        total: total
    }));
    var choice = [ ];
    while (invalid(idx, choice)) {
        choice = [ ];
        for (var i = 0; i < choice_size; i++) {
            choice.push(hentaigana.candidates[random(hentaigana.candidates.length)]);
        }
    }
    socket.emit('updt', {
        fig: figure,
        choice: choice,
        info: encrypted,
        solved: solved,
        total: total
    });
}