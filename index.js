#!/usr/bin/env node

'use strict';

const express = require('express');
const handlebars = require('express-handlebars');
const basicAuth = require('express-basic-auth');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const remark = require('remark');
const remarkHtml = require('remark-html');
const remarkToc = require('remark-toc');
const remarkExternalLinks = require('remark-external-links');
const remarkSlug = require('remark-slug');
const remarkHighlight = require('remark-highlight.js');

const Fuse = require('fuse.js');

const cwd = process.cwd();
let config = {
  username: 'gh-notes',
  password: 'password',
  notesFolder: 'notes',
  siteName: 'GH Notes',
  githubNotesLink: '',
  font: '',
  darkModeToggle: true,
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
const notesFolder = path.join(cwd, config.notesFolder);

app.use(morgan('dev'));
app.use(bodyParser.json());

const titleCase = (str) => _.chain(str).split(' ').map(_.capitalize).join(' ').value();
const formatTitle = (fName) => titleCase(fName.replace(/-/g, ' ').replace(/\.md$/, ''));
const countWords = (str) => str.trim().split(/\s+/).length; // a little dirty, but good enough
const commify = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pluralise = (n, singularForm, pluralForm) => `${n} ${parseInt(n) === 1 ? singularForm : pluralForm}`;
const isEqual = function (arg1, arg2, options) {return (arg1 == arg2) ? options.fn(this) : options.inverse(this)};
const formatLocation = (loc) => _.chain(loc.split(path.sep)).filter().map(formatTitle).join(' > ').value();

//
// For search:
//
const allNotes = [];

const crawl = (location = '') => {
  const list = fs.readdirSync(path.join(notesFolder, location)).sort();
  const files  = [];
  const directories = [];

  for (const item of list) {
    const newLocation = `${location}${path.sep}${item}`;

    if (item.match(/\.md$/)) {
      const title = formatTitle(item);
      const content = fs.readFileSync(path.join(notesFolder, newLocation)).toString('utf8');
      files.push({
        type: 'file',
        location: newLocation,
        title,
      });
      allNotes.push({
        location: newLocation,
        title,
        content,
      });
      continue;
    }

    const stats = fs.lstatSync(path.join(notesFolder, newLocation));
    if (stats.isDirectory()) {
      directories.push({
        type: 'directory',
        location: newLocation,
        title: formatTitle(item),
        files: crawl(newLocation)
      });
    }
  }

  return [ ...directories, ...files ];
};

//
// Putting items into the Express 'locals' store makes them available in all Handlebars templates
//
app.locals.config = config;
app.locals.files = crawl();

app.engine('handlebars', handlebars({
  helpers: { isEqual, formatTitle, pluralise, formatLocation },
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
  return res.render('index', {
    siteName: config.siteName,
    notesQuantity: app.locals.files.length,
    layout: !!req.get('X-PJAX') ? false : 'main',
  });
});

//
// TODO - tweak this, search results are pretty sketchy still
//
const fuse = new Fuse(allNotes, {
  keys: [
    'title',
    'content',
  ],
});

app.get('/search', (req, res) => {
  res.render('search');
});

app.post('/search', (req, res) => {
  const q = req.body.query;
  const results = fuse.search(q);
  res.json({ results });
});

app.get('/*', (req, res) => {
  const fName = _.last(String(req.path).split(path.sep));
  const p = path.join(notesFolder, req.path);

  if (!fs.existsSync(p)) {
    return res.render('404');
  }

  const stats = fs.lstatSync(p);
  if (stats.isDirectory()) {
    res.redirect('/');
  }

  const content = fs.readFileSync(p).toString('utf8');
  const words = countWords(content);

  remark()
    .use(remarkHtml)
    .use(remarkToc)
    .use(remarkSlug)
    .use(remarkExternalLinks, { target: '_blank', rel: ['noopener', 'noreferer'] })
    .use(remarkHighlight)
    .process(content, (err, file) => {
      if (err) throw err;
      return res.render('note', {
        layout: !!req.get('X-PJAX') ? false : 'main',
        pageSubtitle: `${commify(words)} word${words.length === 1 ? '' : 's'}`,
        noteHtml: String(file),
        noteLocation: req.path,
        fName,
      });
    });
});

app.listen(port, () => {
  console.log('Notes app started at port: ' + port);
});
