const express = require('express');
const fs = require('fs');
const { promisify } = require('util');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const app = express();

async function loadConnections() {
  const file = await readFile('connections.txt');
  return file
    .toString()
    .split('\n')
    .map(line => line.split(/\s+/))
    .map(line => ({ ip: line.shift(), name: line.join(' ') }));
}

async function saveConnections(connections) {
  await writeFile('connections.txt', connections.map(conn => conn.ip + ' ' + (conn.name || '')).join('\n'));
}

function addConnection(connections, connection) {
  for(conn of connections) {
    if(conn.ip == connection.ip) {
      if(connection.name) {
        conn.name = connection.name;
        return true;
      }
      return false;
    }
  }
  connections.push(connection);
  return true;
}

app.set('view engine', 'pug')
app.use(express.static('./static'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('', async (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;

  const files = await readdir('./static');
  const connections = await loadConnections();
  let me = connections.find(c => c.ip == ip);
  
  if(!me) {
    me = { ip };
    if(addConnection(connections, me)) {
      saveConnections(connections);
    }
  } else {
    if(me.name == '')
      delete me.name;
  }

  res.render('home', { me, files, connections });
});

app.all('/name', async (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;

  const connections = await loadConnections();
  if(addConnection(connections, { ip, name: req.body.name })) {
    saveConnections(connections);
  }

  res.redirect('./');
});



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './static/');
  },
  filename: async function (req, file, cb) {
    const connections = await loadConnections();
    const me = connections.find(c => c.ip == req.ip) || { name: req.ip };

    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const dateTime = new Date().toISOString().split('.')[0];

    cb(null, `${basename}-${me.name}-${dateTime}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  res.redirect('./');
})

app.listen(8008);
