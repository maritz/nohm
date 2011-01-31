"use strict";

var express = require('express'),
fs = require('fs'),
RedisStore = require('connect-redis'),
Ni = require('ni'),
nohm = require('nohm')
child_process = require('child_process');

// sass watch hack for development :(
var sassfiles = fs.readdirSync(__dirname + '/public/css/default');
for (var i = 0, len = sassfiles.length; i < len; i = i + 1) {
  if (sassfiles[i].match(/\.scss$/i)) {
    fs.watchFile(__dirname + '/public/css/default/' + sassfiles[i], function () {
      console.log('file changed');
      require('child_process').spawn('touch', [__dirname + '/public/css/default/style.scss'])
    });
  }
}

// sass does not communicate well at all, so we just ignore sass output here -.-
var sass = child_process.spawn('/var/lib/gems/1.8/bin/sass', [/*'--debug-info',*/ '--watch', __dirname + '/public/css/default/style.scss']);

process.on('uncaughtException', function(excp) {
  if (excp.message || excp.name) {
    if (excp.name) process.stdout.write(excp.name);
    if (excp.message) process.stdout.write(excp.message);
    if (excp.backtrace) process.stdout.write(excp.backtrace);
    if (excp.stack) process.stdout.write(excp.stack);
  } else {
    sys = require('sys');
    process.stdout.write(sys.inspect(excp));    
  }
});

var merge = function () {
  var result = {};
  for (var i = arguments.length - 1; i >= 0; i--) {
    if (typeof(arguments[i]) === 'object') {
      var obj = arguments[i];
      Object.keys(obj).forEach(function () {
        result[arguments[0]] = obj[arguments[0]];
      });
    }
  }
  return result;
}

// real application starts now!

// load config
require('./config');


Ni.boot(function() {
  nohm.connect(Ni.config('redis_port'), Ni.config('redis_host'));
  var nohmclient = nohm.getClient();
  nohmclient.select(Ni.config('redis_nohm_db'), function (err) {
    if (err) {
      console.dir(err);
    }
    Ni.config('nohmclient', nohmclient);
  });
  
  
  var workerstart = new Date().toLocaleTimeString();
  
  Ni.controllers.home = Ni.controllers.Models;
  
  // initialize the main app
  var app = express.createServer();
  app.set('view engine', 'jade');

  if (app.set('env') !== 'production') {
    app.use(express.lint(app));
  }

  // static stuff
  app.use(express.conditionalGet());
  app.use(express.favicon(''));
  app.use(express.gzip());
  app.use(express.staticProvider(__dirname + '/public'));

  // start main app pre-routing stuff
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
  var redisSessionStore = new RedisStore({magAge: 60000 * 60 * 24, port: Ni.config('redis_port')}); // one day
  redisSessionStore.client.select(Ni.config('redis_session_db'), function () {
    
    app.use(express.session({
      key: Ni.config('cookie_key'),
      secret: Ni.config('cookie_secret'),
      store: redisSessionStore}));
    
    
    app.use(function (req, res, next) {
      res.original_render = res.render;
      res.rlocals = {};
      res.render = function (file, options) {
        var rlocals = res.rlocals;
        rlocals.session = req.session;
        if (typeof(options) === 'undefined') {
          options = {};
        }
        options.locals = merge(options.locals, rlocals);
        if (req.xhr) {
          options.layout = false;
        }
        res.original_render(file, options);
      };
      next();
    });
    
    app.use(Ni.router);
    
    app.use(Ni.renderView(function(req, res, next, filename) {
      res.render(filename, {layout: __dirname + '/views/layout.jade'});
    }));
    
    app.use(function (req, res, next) {
      res.render('404');
    });
    
    if (app.set('env') !== 'production') {
      app.use(express.errorHandler({showStack: true}));
    }
  
    app.listen(Ni.config('port'), Ni.config('host'));
    console.log('listening to '+Ni.config('host')+':'+Ni.config('port'));
  });
});