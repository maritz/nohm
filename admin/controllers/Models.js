var Ni = require('ni'),
redis = require('redis').createClient(),
nohm = require('nohm');

module.exports = {
  __init: function (cb, req, res, next) {
    if (!req.session.logged_in) {
      res.Ni.action = 'login';
      res.Ni.controller = 'User';
      Ni.controllers.User.login(req, res, next);
    } else {
      res.Ni.controller = 'Models'; // since i've overwritten the controller for home to be News, this is neccessary for automatic views
      cb();
    }
  },
  
  index: function (req, res, next) {
    redis.keys(Ni.config.redis_prefix + ':idsets:*', function (err, replies) {
      res.rlocals.models = [];
      replies.forEach(function (val, i) {
         res.rlocals.models[i] = val.toString().replace(/^.*\:idsets:/, '');
      });
      next();
    });
  },
  
  details: function (req, res, next, model) {
    redis.hgetall(Ni.config.redis_prefix + ':meta:' + model, function (err, replies) {
      if (err) {
        console.dir('someone tried to access an inexistant model:' + model);
        res.redirect('/Models');
      }
      
      res.rlocals.model = model;
      res.rlocals.props = [];
      if (replies !== null) {
        replies.forEach(function (val, i) {
          res.rlocals.props[i] = JSON.parse(val.toString());
        });
      }
      redis.smembers(Ni.config.redis_prefix + ':idsets:' + model, function (err, replies) {
        if (err) {
          console.dir('something went wrong in fetching model details with model:' + model);
          res.redirect('/Models');
        }
        res.rlocals.ids = replies !== null ? replies : [];
        next();
      });
    })
  },
  
  getObject: function (req, res, next, model, id) {
    if (!model || !id) {
      console.dir('someone tried to access model: "' + model + '" with id #' + id);
      res.redirect('/Models');
    }
    redis.hgetall(Ni.config.redis_prefix + ':hash:' + model + ':' + id, function (err, replies) {
      if (err) {
        console.dir('someone tried to access an inexistant object of model: "' + model + '" with id #' + id);
        res.redirect('/Models');
      }
      res.rlocals.vals = [];
      if (replies !== null) {
        replies.forEach(function (val, i) {
          res.rlocals.vals[i] = val.toString();
        });
        next();
      }
    });
  }
}