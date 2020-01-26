'use strict';

const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const showdown = require('showdown');
const converter = new showdown.Converter();

const cwd = process.cwd();
let config = {
  username: 'gh-notes',
  password: 'password',
  notesFolder: 'notes',
};

try {
  const userConfig = require(path.join(cwd, 'gh-notes.config.json'));
  config = { ...config, ...userConfig };
} catch (e) {
  console.log('Could not load user configuration, using defaults instead.');
  console.log('To configure gh-notes, create a gh-notes.config.json file.');
  if (process.env.NODE_ENV !== 'production') {
    console.error(e);
  }
}

const notesDir = path.join(cwd, config.notesFolder);

const app = express();
const port = process.env.PORT || 5000;

const cap = (str) => _.chain(str).split(' ').map(_.capitalize).join(' ');
const clean = (fName) => cap(fName.replace(/-/g, ' ').replace(/\.md$/, ''));

const backLink = `<a href="/">Go Back</a><br />`;

app.use(basicAuth({
  users: {
    [config.username]: config.password,
  },
  challenge: true,
  realm: 'Application',
}));

app.get('/', (req, res) => {
  const files = fs.readdirSync(notesDir);
  res.send(
    '<ul>' +
    _.chain(files)
      .sort()
      .map((fName) => `<li><a href="/${fName}">${clean(fName)}</a></li>`)
      .join('')
      .value() +
    '</ul>'
  );
});

app.get('/:fName', (req, res) => {
  const fName = req.params.fName;
  const p = path.join(notesDir, fName);

  if (!fName || !fs.existsSync(p)) {
    return res.send(backLink + 'Not Found');
  }

  const content = fs.readFileSync(p).toString('utf8');
  res.send(backLink + converter.makeHtml(content));
});

app.listen(port, () => {
  console.log('Notes app started at port: ' + port);
});
