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

const airtable = require('airtable');
require('dotenv').config()
const app = express()

const notify = new NotifyClient(process.env.notifyKey)
const base = new airtable({ apiKey: process.env.airtableFeedbackKey }).base(process.env.airtableFeedbackBase);

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
  const { filename } = req.params;
  const filePath = path.join(__dirname, '/app/downloads/' + filename);

  //  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  // Send the file
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
  ], function(err) {
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
  
  const service = "Job descriptions"; // Example service name
  const pageURL = req.headers.referer || 'Unknown'; // Attempt to capture the referrer URL
  const date = new Date().toISOString();

  base('Feedback').create([{
      "fields": {
          "Feedback": response,
          "Service": service,
          "URL": pageURL
      }
  }], function(err) {
      if (err) {
          console.error(err);
          return res.status(500).send('Error saving to Airtable');
      }
      res.json({ success: true, message: 'Feedback submitted successfully' });
  });
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
  // Assuming the JSON data is stored in './app/data/nav.json'
  fs.readFile('./app/data/nav.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Error loading profession data");
    }

    const professionData = JSON.parse(data);
    const professionsGroupedByFamily = professionData.reduce((acc, profession) => {
      // Initialize the family array if it doesn't already exist
      if (!acc[profession.family]) {
        acc[profession.family] = [];
      }
      // Add the current profession to the appropriate family array
      acc[profession.family].push(profession);
      return acc;
    }, {});

    // Render the index template with the grouped professions data
    res.render('index', { professionsGroupedByFamily });
  });
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
  const data = nav.find(role => role.slug === profession); // Use .find() to get the first match directly

  if (data) {
    // Group roles by their 'group' attribute
    const groupedRolesByGroup = data.roles.reduce((acc, role) => {
      const group = role.group || 'Other'; // Fallback to 'Other' if no group is specified
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(role);
      return acc;
    }, {});

    // Pass the grouped roles in the profession object
    data.groupedRoles = groupedRolesByGroup;
  }

  res.render('profession', { profession: data || {} });
});


app.get('/:profession/:role', function (req, res) {
  const { profession, role } = req.params;
  const nav = require('./app/data/nav.json');
  const professionData = nav.find(item => item.slug === profession);
  const data = nav.find(role => role.slug === profession); // Use .find() to get the first match directly

  if (professionData) {
    const roleData = professionData.roles.find(r => r.slug === role);
    // If you need to group roles for navigation or related roles display, do it here similarly to the first route
  }

  if (data) {
    // Group roles by their 'group' attribute
    const groupedRolesByGroup = data.roles.reduce((acc, role) => {
      const group = role.group || 'Other'; // Fallback to 'Other' if no group is specified
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(role);
      return acc;
    }, {});

    // Pass the grouped roles in the profession object
    data.groupedRoles = groupedRolesByGroup;
  }

  res.render('job-description', { profession: data || {}, role });
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