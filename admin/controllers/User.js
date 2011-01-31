var Ni = require('ni');

var userController = module.exports = {
  __init: function (cb, req, res, next) {
    res.Ni.action = 'login';
    res.Ni.controller = 'User';
    Ni.controllers.User.login(req, res, next);
  },
  
  login: function (req, res, next) {
    if (req.body) {
      if (req.body.name === Ni.config('user') && req.body.password === Ni.config('password')) {
        req.session.logged_in = true;
        res.redirect('/');
      }
    }
    next();
  }
}