#!/usr/bin/env node

'use strict';

const express = require('express');
const handlebars = require('express-handlebars');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const remark = require('remark');
const remarkHtml = require('remark-html');
const remarkToc = require('remark-toc');
const remarkExternalLinks = require('remark-external-links');

const cwd = process.cwd();
let config = {
  username: 'gh-notes',
  password: 'password',
  notesFolder: 'notes',
  siteName: 'GH Notes',
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
const formatNoteTitle = (fName) => titleCase(fName.replace(/-/g, ' ').replace(/\.md$/, ''));
const countWords = (str) => str.trim().split(/\s+/).length; // a little dirty, but good enough
const commify = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

//
// Putting items into the Express 'locals' store makes them available in all Handlebars templates
//
app.locals.config = config;
app.locals.files = fs.readdirSync(notesDir);

app.engine('handlebars', handlebars({
  helpers: { titleCase, formatNoteTitle },
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

app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const length = app.locals.files.length;
  return res.render('index', {
    pageTitle: config.siteName,
    pageSubtitle: `Showing ${length} note${length === 1 ? '' : 's'}`,
  });
});

app.get('/:fName', (req, res) => {
  const fName = req.params.fName;
  const p = path.join(notesDir, fName);

  if (!fName || !fs.existsSync(p)) {
    return res.render('404');
  }

  const content = fs.readFileSync(p).toString('utf8');
  const words = countWords(content);

  remark()
    .use(remarkHtml)
    .use(remarkToc)
    .use(remarkExternalLinks, { target: '_blank', rel: ['noopener', 'noreferer'] })
    .process(content, (err, file) => {
      if (err) throw err;
      return res.render('note', {
        pageTitle: formatNoteTitle(fName),
        pageSubtitle: `${commify(words)} word${words.length === 1 ? '' : 's'}`,
        noteHtml: String(file),
      });
    });
});

app.listen(port, () => {
  console.log('Notes app started at port: ' + port);
});
