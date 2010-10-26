"use strict";

var express = require('express'),
fs = require('fs'),
RedisStore = require('connect-redis'),
Ni = require('ni'),
fugue = require('fugue');

// sass watch hack for development :(
var sassfiles = fs.readdirSync('public/css/default');
for (var i = 0, len = sassfiles.length; i < len; i = i + 1) {
  if (sassfiles[i].match(/\.scss$/i)) {
    fs.watchFile('./public/css/default/' + sassfiles[i], function () {
      console.log('file changed');
      require('child_process').spawn('touch', ['public/css/default/style.scss'])
    });
  }
}

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

Ni.setRoot(__dirname);
Ni.config.redis_prefix = 'tests';

Ni.boot(function() {
  
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
  app.use(express.session({store: new RedisStore({magAge: 60000 * 60 * 24})})); // one day
  
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
  
  app.use(Ni.view(function(req, res, next, filename) {
    res.render(filename);
  }));
  
  app.use(function (req, res, next) {
    res.render('404');
  });
  
  if (app.set('env') !== 'production') {
    app.use(express.errorHandler({showStack: true}));
  }

  fugue.start(app, 3000, null, 2, {
    started: function () {
      console.log('listening on 3000');
    },
    log_file: __dirname + '/log/workers.log',
    master_pid_path: '/tmp/fugue-master-nohmadmin.pid',
    verbose: true
  });
});