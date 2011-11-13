var express = require(__dirname+'/../../../stack/node_modules/express');
var Nohm = require(__dirname+'/../../lib/nohm.js').Nohm;
var UserModel = require(__dirname+'/UserModel.js');
var redis = require('redis');

var redisClient = redis.createClient();

Nohm.setPrefix('rest-user-server-example');
Nohm.setClient(redisClient);

var server = express.createServer();

server.get('/User/list', function (req, res, next) {
  UserModel.find(function (err, ids) {
    if (err) {
     return next(err);
    }
    var users = [];
    var len = ids.length;
    var count = 0;
    if (len === 0) {
      return res.json(users);
    }
    ids.forEach(function (id) {
      var user = new UserModel();
      user.load(id, function (err, props) {
        if (err) {
          return next(err);
        }
        users.push({id: this.id, name: props.name});
        if (++count === len) {
          res.json(users);
        }
      });
    });
  });
});

server.get('/User/create', function (req, res, next) {
  var data = {
    name: req.param('name'),
    password: req.param('password'),
    email: req.param('email')
  };
  
  var user = new UserModel();
  user.store(data, function (err) {
    if (err === 'invalid') {
      next(user.errors);
    } else if (err) {
      next(err);
    } else {
      res.json({result: 'success', data: user.allProperties()});
    }
  });
});

server.use(function (err, req, res, next) {
  if (err instanceof Error) {
    err = err.message;
  }
  res.json({result: 'error', data: err});
});

server.listen(3000);
console.log('listening on 3000');