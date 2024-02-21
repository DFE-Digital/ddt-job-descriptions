const express = require('express')
const nunjucks = require('nunjucks')
const https = require('https')
const axios = require('axios')
var dateFilter = require('nunjucks-date-filter')
var markdown = require('nunjucks-markdown')
var marked = require('marked')
const bodyParser = require('body-parser')
var NotifyClient = require('notifications-node-client').NotifyClient
const fs = require('fs');
const path = require('path');

require('dotenv').config()
const app = express()

const notify = new NotifyClient(process.env.notifyKey)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'html')

app.locals.serviceName = 'Find a job description'
app.locals.BASE_URL = process.env.BASE_URL;

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
)

nunjuckEnv.addFilter('date', dateFilter)
markdown.register(nunjuckEnv, marked.parse)

// Set up static file serving for the app's assets
app.use('/assets', express.static('public/assets'))

// Render sitemap.xml in XML format
app.get('/sitemap.xml', (_, res) => {
  res.set({ 'Content-Type': 'application/xml' });
  res.render('sitemap.xml');
});

app.get('/downloads/:filename', (req, res) => {
  const {filename} = req.params;
  const filePath = path.join(__dirname, '/app/downloads/' + filename);
 
  //  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  // Send the file
  res.sendFile(filePath);
});

app.get('/accessibility-statement', (_, res) => {
  res.render('accessibility-statement');
});

app.post('/submit-feedback', (req, res) => {
  const feedback = req.body.feedback_form_input
  const fullUrl = req.headers.referer || 'Unknown'

  //Send to notify after validation with recaptcha first
  //TODO: Implement recaptcha

  notify
    .sendEmail(process.env.feedbackTemplateID, 'design.ops@education.gov.uk', {
      personalisation: {
        feedback: feedback,
        page: fullUrl,
        service: "Job descriptions"
      },
    })
    .then((response) => { })
    .catch((err) => console.log(err))

  return res.sendStatus(200)
})

app.get('/', function (req, res) {
  const professionData = require('./app/data/nav.json');
  res.render('index', { professions: professionData });
});

app.get('/accessibility-statement', function (req, res) {
  res.render('accessibility-statement')
});

app.get('/cookie-policy', function (req, res) {
  res.render('cookie-policy')
});

app.get('/profession/:profession', function (req, res) {
  const { profession } = req.params;

  const nav = require('./app/data/nav.json');
  const data = nav.filter(role => role.slug === profession);
  const professionData = data.length > 0 ? data[0] : {};

  res.render('profession', { profession: professionData });
});

app.get('/:profession/:role', function (req, res) {
  const { profession, role } = req.params;

  const nav = require('./app/data/nav.json');
  const data = nav.filter(role => role.slug === profession);
  const professionData = data.length > 0 ? data[0] : {};

  res.render('job-description', { profession: professionData, role: role });
});

app.get(/\.html?$/i, function (req, res) {
  var path = req.path
  var parts = path.split('.')
  parts.pop()
  path = parts.join('.')
  res.redirect(path)
})

app.get(/^([^.]+)$/, function (req, res, next) {
  matchRoutes(req, res, next)
})

// Handle 404 errors
app.use(function (req, res, next) {
  res.status(404).render('error.html')
})

// Handle 500 errors
app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).render('error.html')
})

function renderPath(path, res, next) {
  // Try to render the path
  res.render(path, function (error, html) {
    if (!error) {
      // Success - send the response
      res.set({ 'Content-type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
    if (!error.message.startsWith('template not found')) {
      // We got an error other than template not found - call next with the error
      next(error)
      return
    }
    if (!path.endsWith('/index')) {
      // Maybe it's a folder - try to render [path]/index.html
      renderPath(path + '/index', res, next)
      return
    }
    // We got template not found both times - call next to trigger the 404 page
    next()
  })
}

matchRoutes = function (req, res, next) {
  var path = req.path

  // Remove the first slash, render won't work with it
  path = path.substr(1)

  // If it's blank, render the root index
  if (path === '') {
    path = 'index'
  }

  renderPath(path, res, next)
}

app.listen(process.env.PORT || 3088)