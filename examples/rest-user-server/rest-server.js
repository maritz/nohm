const express = require('express');
const Nohm = require('nohm').Nohm;
const UserModel = require(__dirname + '/UserModel.js');
const redis = require('redis');
const fs = require('fs');
const bodyParser = require('body-parser');

const redisClient = redis.createClient();

redisClient.once('connect', function() {
  Nohm.setPrefix('rest-user-server-example');
  Nohm.setClient(redisClient);

  const server = express();

  server.use(bodyParser.urlencoded({ extended: false }));

  server.use(
    Nohm.middleware(
      [
        {
          model: UserModel,
        },
      ],
      /*
      // doesn't work yet in v2.0.0
      {
        extraFiles: __dirname + '/custom_validations.js',
      },*/
    ),
  );

  server.get('/User/list', async function(req, res, next) {
    try {
      const users = await UserModel.findAndLoad();
      const response = users.map((user) => {
        return {
          id: user.id,
          name: user.property('name'),
          email: user.property('email'),
          createdAt: user.property('createdAt'),
          updatedAt: user.property('updatedAt'),
          password: user.property('password'), // WARNING: obviously in a real application NEVER give this out. This is just to test/demo the fill() method
        };
      });
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  server.post('/User/', async function(req, res, next) {
    try {
      const data = {
        name: req.body.name,
        password: req.body.password,
        email: req.body.email,
      };
      const user = await Nohm.factory('User'); // alternatively new UserModel(); like in put
      await user.store(data);
      res.json({ result: 'success', data: user.safeAllProperties() });
    } catch (err) {
      next(err);
    }
  });

  server.put('/User/:id', async function(req, res, next) {
    try {
      const data = {
        name: req.body.name,
        password: req.body.password,
        email: req.body.email,
      };
      const user = new UserModel(); // alternatively Nohm.factory('User'); like in post
      await user.load(req.params.id);
      console.log('loaded user', user.property('updatedAt'));
      await user.store(data);
      res.json({ result: 'success', data: user.safeAllProperties() });
    } catch (err) {
      next(err);
    }
  });

  server.post('/User/login', async function(req, res) {
    const user = new UserModel(); // alternatively Nohm.factory('User'); like in post
    const loginSuccess = await user.login(req.body.name, req.body.password);
    if (loginSuccess) {
      res.json({ result: 'success' });
    } else {
      res.status(401);
      res.send('Wrong login');
    }
  });

  server.delete('/User/:id', async function(req, res, next) {
    try {
      await UserModel.remove(req.params.id);
      res.status(204);
      res.end();
    } catch (err) {
      next(err);
    }
  });

  server.get('/', function(req, res) {
    res.send(fs.readFileSync(__dirname + '/index.html', 'utf-8'));
  });

  server.get('/client.js', function(req, res) {
    res.sendFile(__dirname + '/client.js');
  });

  server.use(function(err, req, res, _next) {
    // error handler
    res.status(500);
    let errData = err.message;
    if (err instanceof Error) {
      if (err.message === 'not found') {
        res.status(404);
      }
    }
    if (err instanceof Nohm.ValidationError) {
      res.status(400);
      errData = err.errors;
    }
    if (res.statusCode >= 500) {
      console.error('Server error:', err);
    }
    res.send({ result: 'error', data: errData });
  });

  server.listen(3000);
  console.log('listening on 3000');
});
