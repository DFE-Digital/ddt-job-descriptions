const express = require('express');
const nunjucks = require('nunjucks');
const https = require('https');
const axios = require('axios');
var dateFilter = require('nunjucks-date-filter');
var markdown = require('nunjucks-markdown');
var marked = require('marked');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const { JSDOM } = require('jsdom');

const airtable = require('airtable');
require('dotenv').config();
const app = express();

const md = new markdownIt();
const base = new airtable({ apiKey: process.env.airtableFeedbackKey }).base(process.env.airtableFeedbackBase);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'html');

const nav = require('./app/data/nav.json');

app.locals.serviceName = 'Find a job description';

// Set up Nunjucks as the template engine
var nunjuckEnv = nunjucks.configure(
  [
    'app/views',
    'node_modules/govuk-frontend/dist/',
    'node_modules/dfe-frontend-alpha/packages/components',
  ],
  {
    autoescape: true,
    express: app,
  },
);

nunjuckEnv.addFilter('date', dateFilter);
markdown.register(nunjuckEnv, marked.parse);

// Set up static file serving for the app's assets
app.use('/assets', express.static('public/assets'));

// Render sitemap.xml in XML format
app.get('/sitemap.xml', (_, res) => {
  res.set({ 'Content-Type': 'application/xml' });
  res.render('sitemap.xml');
});

app.get('/downloads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '/app/downloads/' + filename);

  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.sendFile(filePath);
});

app.get('/accessibility-statement', (_, res) => {
  res.render('accessibility-statement');
});

// Route for handling Yes/No feedback submissions
app.post('/form-response/helpful', (req, res) => {
  const { response } = req.body;
  const service = "Job descriptions";
  const pageURL = req.headers.referer || 'Unknown';
  const date = new Date().toISOString();

  base('Data').create([
    {
      "fields": {
        "Response": response,
        "Service": service,
        "URL": pageURL
      }
    }
  ], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Error saving to Airtable');
    }
    res.json({ success: true, message: 'Feedback submitted successfully' });
  });
});

// New route for handling detailed feedback submissions
app.post('/form-response/feedback', (req, res) => {
  const { response } = req.body;

  const service = "Job descriptions";
  const pageURL = req.headers.referer || 'Unknown';
  const date = new Date().toISOString();

  base('Feedback').create([{
    "fields": {
      "Feedback": response,
      "Service": service,
      "URL": pageURL
    }
  }], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Error saving to Airtable');
    }
    res.json({ success: true, message: 'Feedback submitted successfully' });
  });
});

app.get('/', function (req, res) {
  fs.readFile('./app/data/nav.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Error loading profession data");
    }

    const professionData = JSON.parse(data);
    const professionsGroupedByFamily = professionData.reduce((acc, profession) => {
      if (!acc[profession.family]) {
        acc[profession.family] = [];
      }
      acc[profession.family].push(profession);
      return acc;
    }, {});

    res.render('index', { professionsGroupedByFamily });
  });
});

app.get('/accessibility-statement', function (req, res) {
  res.render('accessibility-statement');
});

app.get('/cookie-policy', function (req, res) {
  res.render('cookie-policy');
});

app.get('/profession/:profession', function (req, res) {
  const { profession } = req.params;
  const data = nav.find(role => role.slug === profession);

  if (data) {
    const groupedRolesByGroup = data.roles.reduce((acc, role) => {
      const group = role.group || 'Other';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(role);
      return acc;
    }, {});

    data.groupedRoles = groupedRolesByGroup;
  }

  res.render('profession', { profession: data || {} });
});

app.get('/:profession/:role', function (req, res) {
  const { profession, role } = req.params;
  const professionData = nav.find(item => item.slug === profession);
  const data = nav.find(role => role.slug === profession);

  if (professionData) {
    const roleData = professionData.roles.find(r => r.slug === role);
  }

  if (data) {
    const groupedRolesByGroup = data.roles.reduce((acc, role) => {
      const group = role.group || 'Other';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(role);
      return acc;
    }, {});

    data.groupedRoles = groupedRolesByGroup;
  }

  res.render('job-description', { profession: data || {}, role });
});

// Function to handle custom Markdown processing
function processMarkdown(markdownContent) {
  const cleanedContent = markdownContent.replace(
    /<dl.*?>.*?<dt.*?>\s*(.*?)\s*<\/dt>\s*<dd.*?>\s*(.*?)\s*<\/dd>.*?<\/dl>/gs,
    (match, dt, dd) => `**${dt.trim()}:** ${dd.trim()}`
  );

  return md.render(cleanedContent);
}

// Function to convert HTML content into docx paragraphs
function htmlToDocx(html) {
  const docElements = [];
  const dom = new JSDOM(html);
  const document = dom.window.document;

  document.body.childNodes.forEach((node) => {
    if (node.nodeName === 'H1' || node.nodeName === 'H2') {
      docElements.push(new Paragraph({
        children: [new TextRun({ text: node.textContent, bold: true, size: 28, font: "Aptos" })],
        spacing: { after: 200 },
      }));
    } else if (node.nodeName === 'H3') {
      docElements.push(new Paragraph({
        children: [new TextRun({ text: node.textContent, bold: true, size: 24, font: "Aptos" })],
        spacing: { after: 150 },
      }));
    } else if (node.nodeName === 'P') {
      docElements.push(new Paragraph({
        children: [new TextRun({ text: node.textContent, font: "Aptos" })],
        spacing: { after: 100 },
      }));
    } else if (node.nodeName === 'UL') {
      node.querySelectorAll('li').forEach((li) => {
        docElements.push(new Paragraph({
          children: [new TextRun({ text: li.textContent, font: "Aptos" })],
          bullet: { level: 0 },
        }));
      });

      // Add extra spacing after the list
      docElements.push(new Paragraph({
        spacing: { after: 200 }, // Adjust the value as needed for more or less spacing
      }));
    }
  });

  return docElements;
}

// Generic route for handling profession and role, with optional output
app.get('/:profession/:role/:output?', async function (req, res) {
  const { profession, role, output } = req.params;

  const professionData = nav.find(item => item.slug === profession);
  if (!professionData) {
    return res.status(404).send('Profession not found');
  }

  const roleData = professionData.roles.find(r => r.slug === role);
  if (!roleData) {
    return res.status(404).send('Role not found');
  }

  const filePath = path.join(__dirname, 'app', 'views', 'jd', `${roleData.slug}.md`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Job description not found');
  }

  const markdownContent = fs.readFileSync(filePath, 'utf8');
  const htmlContent = processMarkdown(markdownContent);

  if (output === 'word') {
    const docxContent = htmlToDocx(htmlContent);

    const doc = new Document({
      sections: [{ properties: {}, children: docxContent }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${roleData.slug}.docx`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } else {
    res.render('job-description', { profession: professionData, role: roleData, content: htmlContent });
  }
});

app.get(/\.html?$/i, function (req, res) {
  var path = req.path;
  var parts = path.split('.');
  parts.pop();
  path = parts.join('.');
  res.redirect(path);
});

app.get(/^([^.]+)$/, function (req, res, next) {
  matchRoutes(req, res, next);
});

// Handle 404 errors
app.use(function (req, res, next) {
  res.status(404).render('error.html');
});

// Handle 500 errors
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).render('error.html');
});

function renderPath(path, res, next) {
  res.render(path, function (error, html) {
    if (!error) {
      res.set({ 'Content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (!error.message.startsWith('template not found')) {
      next(error);
      return;
    }
    if (!path.endsWith('/index')) {
      renderPath(path + '/index', res, next);
      return;
    }
    next();
  });
}

matchRoutes = function (req, res, next) {
  var path = req.path;
  path = path.substr(1);

  if (path === '') {
    path = 'index';
  }

  renderPath(path, res, next);
};

app.listen(process.env.PORT || 3088);
