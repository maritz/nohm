var Ni = require('ni'),
redis = require('redis').createClient();

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
  
  index: function(req, res, next) {
    redis.keys('tests:idsets:*', function (err, replies) {
      res.rlocals.models = [];
      replies.forEach(function (val, i) {
         res.rlocals.models[i] = val.toString().replace(/^.*\:idsets:/, '');
      });
      next();
    });
  }
}