var express = require('express');
var formidable = require('formidable');
var nodemailer = require('nodemailer');
var app = express();

var cartValidation = require('./lib/cartValidation.js');
var credentials = require('./credentials.js');
var fortune = require('./lib/fortune.js');

app.set('port', process.env.PORT || 3000);

var handlebars = require('express-handlebars').create({ 
  defaultLayout:'main',
  helpers: {
    section: function(name, options) {
      if(!this._sections) this._sections = {};
      this._sections[name] = options.fn(this);
      return null;
    }
  }
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var mailTransport = nodemailer.createTransport('smtps://lucas1richard%40gmail.com:Hollowjob1@smtp.gmail.com');

// mailTransport.sendMail({
//   from:'"Meadowlark Travel" <info@meadowlarktravel.com>',
//   to:'lucas1richard@gmail.com',
//   subject:'Your Meadowlark Travel Tour',
//   text:'Thank you for booking your trip with Meadowlark Travel. We look forward to your visit!'
// }, function(err) {
//   if(err) console.error('Unable to send email: ' + err);
// });


app.use(express.static(__dirname + '/public'));
app.use(function(req, res, next) {
  res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
  next();
});

app.use(function(req, res, next) {
  if(!res.locals.partials) res.locals.partials = {};
  res.locals.partials.weatherContext = getWeatherData();
  next();
});

app.use(cartValidation.checkWaivers);
app.use(cartValidation.checkGuestCounts);

app.use(require('body-parser').urlencoded({ extended:true }));
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
  resave: false,
  saveUninitialized: false,
  secret: credentials.cookieSecret,
}));

app.use(function(req, res, next) {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// mocked weather data
function getWeatherData(){
  return {
    locations: [
      {
        name: 'Portland',
        forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
        weather: 'Overcast',
        temp: '54.1 F (12.3 C)',
      },
      {
        name: 'Bend',
        forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
        weather: 'Partly Cloudy',
        temp: '55.0 F (12.8 C)',
      },
      {
        name: 'Manzanita',
        forecastUrl: 'http://www.wunderground.com/US/OR/Manzanita.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
        weather: 'Light Rain',
        temp: '55.0 F (12.8 C)',
      },
    ],
  };
}

app.get('/', function(req, res) {
  res.render('home');
});

app.get('/thank-you', function(req, res) {
  res.render('thank-you');
});

app.get('/contest/vacation-photo', function(req, res) {
  var now = new Date();
  res.render('contest/vacation-photo', {
    year:now.getFullYear(), month:now.getMonth()
  });
});

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    if(err) return res.redirect(303,'/error');
    console.log('received fields:');
    console.log(fields);
    console.log('received files:');
    console.log(files);
    res.redirect(303, '/thank-you')
  });
});

app.get('/newsletter', function(req, res) {
  res.render('newsletter', {csrf:'CSRF token goes here'});
});

app.get('/newsletter/archive', function(req, res){
  res.render('newsletter/archive');
});

// for now, we're mocking NewsletterSignup:
function NewsletterSignup(){
}
NewsletterSignup.prototype.save = function(cb){
  cb();
};

var VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

app.post('/newsletter', function(req, res){
  var name = req.body.name || '', email = req.body.email || '';
  // input validation
  if(!email.match(VALID_EMAIL_REGEX)) {
    if(req.xhr) return res.json({ error: 'Invalid name email address.' });
    req.session.flash = {
      type: 'danger',
      intro: 'Validation error!',
      message: 'The email address you entered was  not valid.',
    };
    return res.redirect(303, '/newsletter/archive');
  }
  new NewsletterSignup({ name: name, email: email }).save(function(err){
    if(err) {
      if(req.xhr) return res.json({ error: 'Database error.' });
      req.session.flash = {
        type: 'danger',
        intro: 'Database error!',
        message: 'There was a database error; please try again later.',
      };
      return res.redirect(303, '/newsletter/archive');
    }
    if(req.xhr) return res.json({ success: true });
    req.session.flash = {
      type: 'success',
      intro: 'Thank you!',
      message: 'You have now been signed up for the newsletter.',
    };
    return res.redirect(303, '/newsletter/archive');
  });
});

app.post('/process', function(req, res) {
  if(req.xhr || req.accepts('json,html')==='json') {
    console.log('Form (from querystring):' + req.query.form);
    console.log('CSRF token (from hidden form field):' + req.body._csrf);
    console.log('Name (from visible form field):' + req.body.name);
    console.log('Email (from visible form field):' + req.body.email);
    res.send({success:true});
  } else {
    res.redirect(303, '/thank-you');
  }
});

app.get('/about', function(req, res) {
  res.render('about', { 
    fortune: fortune.getFortune(),
    pageTestScript: '/qa/tests-about.js'
  } );
});

app.get('/tours/hood-river', function(req, res) {
  res.render('tours/hood-river');
});

app.get('/tours/request-group-rate', function(req, res) {
  res.render('tours/request-group-rate');
});

app.get('/jquery-test', function(req, res){
  res.render('jquery-test');
});

app.get('/nursery-rhyme', function(req, res){
  res.render('nursery-rhyme');
});

app.get('/data/nursery-rhyme', function(req, res){
  res.json({
    animal: 'squirrel',
    bodyPart: 'tail',
    adjective: 'bushy',
    noun: 'heck',
  });
});

app.use(function(req, res, next){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function() {
  console.log('--------------------------------');
  console.log('Server is listening on port 3000');
});