var express = require('express');
var Nohm = require(__dirname + '/../../').Nohm;
var ValidationError = require(__dirname + '/../../').ValidationError;
var UserModel = require(__dirname + '/UserModel.js');
var redis = require('redis');
var fs = require('fs');
var bodyParser = require('body-parser');

var redisClient = redis.createClient();

redisClient.once('connect', function () {

  Nohm.setPrefix('rest-user-server-example');
  Nohm.setClient(redisClient);

  var server = express();

  server.use(bodyParser.urlencoded({ extended: false }))

  server.use(Nohm.middleware([{
    model: UserModel,
    blacklist: ['salt'] // remove the salt property from client validation so that clients don't know we have this field.
  }], {
      extraFiles: __dirname + '/custom_validations.js'
    }));

  server.get('/User/list', async function (req, res, next) {
    try {
      const users = await UserModel.findAndLoad();
      const response = users.map((user) => {
        return {
          id: user.id,
          name: user.property('name'),
          email: user.property('email'),
          salt: user.property('salt') // WARNING: obviously in a real application NEVER give this out. This is just to test/demo the fill() method 
        };
      });
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  server.post('/User/create', async function (req, res, next) {
    try {
      var data = {
        name: req.body.name,
        password: req.body.password,
        email: req.body.email,
        salt: req.body.salt, // WARNING: obviously in a real application NEVER take a salt from a client. This is just to test/demo the fill() method 
      };
      var user = await Nohm.factory('User'); // alternatively new UserModel();
      await user.store(data);
      res.json({ result: 'success', data: user.allProperties() });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.json({ result: 'error', data: err.errors });
      } else {
        next(err);
      }
    }
  });

  server.get('/', function (req, res) {
    res.send(fs.readFileSync(__dirname + '/index.html', 'utf-8'));
  });

  server.get('/client.js', function (req, res) {
    res.sendFile(__dirname + '/client.js');
  });

  server.use(function (err, req, res) {
    if (err instanceof Error) {
      err = err.message;
    }
    res.json({ result: 'error', data: err });
  });

  server.listen(3000);
  console.log('listening on 3000');

});
