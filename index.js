#!/usr/bin/env node

'use strict';

const express = require('express');
const handlebars = require('express-handlebars');
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
}

const app = express();
const port = process.env.PORT || 5000;
const notesDir = path.join(cwd, config.notesFolder);

const titleCase = (str) => _.chain(str).split(' ').map(_.capitalize).join(' ');
const formatNoteName = (fName) => titleCase(fName.replace(/-/g, ' ').replace(/\.md$/, ''));

app.engine('handlebars', handlebars({
  helpers: { titleCase, formatNoteName },
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(basicAuth({
  users: {
    [config.username]: config.password,
  },
  challenge: true,
  realm: 'Application',
}));

app.get('/', (req, res) => {
  const files = fs.readdirSync(notesDir);
  return res.render('index', { files });
});

app.get('/:fName', (req, res) => {
  const fName = req.params.fName;
  const p = path.join(notesDir, fName);

  if (!fName || !fs.existsSync(p)) {
    return res.render('404');
  }

  const content = fs.readFileSync(p).toString('utf8');
  res.render('note', {
    noteHtml: converter.makeHtml(content),
  });
});

app.listen(port, () => {
  console.log('Notes app started at port: ' + port);
});
