var Ni = require('ni');

// hardcoded userdata, yeah!
var user = 'maritz';
var password = 'asdasd';

var userController = module.exports = {
  __init: function (cb, req, res, next) {
    res.Ni.action = 'login';
    res.Ni.controller = 'User';
    Ni.controllers.User.login(req, res, next);
  },
  
  login: function (req, res, next) {
    if (req.body) {
      if (req.body.name === user && req.body.password === password) {
        req.session.logged_in = true;
      }
    }
    next();
  }
}