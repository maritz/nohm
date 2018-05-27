const express = require('express');
const Nohm = require('nohm').Nohm;
const UserModel = require('./UserModel.js');
const redis = require('redis');
const fs = require('fs');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT,
};

const redisClient = redis.createClient(redisOptions);
const pubSubClient = redis.createClient(redisOptions);

redisClient.once('connect', async () => {
  Nohm.setPrefix('rest-user-server-example');
  Nohm.setClient(redisClient);

  const app = express();
  const server = http.Server(app);

  const io = socketIo(server);

  await Nohm.setPubSubClient(pubSubClient);
  Nohm.setPublish(true);

  const subscriber = async (eventName) => {
    await new UserModel().subscribe(eventName, (payload) => {
      console.log('Emitting event "%s"', eventName);
      io.emit('nohmEvent', {
        eventName,
        payload,
      });
    });
  };
  ['update', 'create', 'save', 'remove', 'link', 'unlink'].forEach(subscriber);

  app.use(bodyParser.urlencoded({ extended: false }));

  app.use(
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

  setInterval(() => {
    const maxUsers = process.env.MAX_USERS || 5;
    const user = new UserModel();
    redisClient.SCARD(`${user.prefix('idsets')}`, async (err, number) => {
      if (err) {
        console.error('SCARD failed:', err);
        return;
      }
      if (number > maxUsers) {
        const sortedIds = await UserModel.sort({
          field: 'updatedAt',
          direction: 'ASC',
        });
        sortedIds.splice(-1 * maxUsers);
        console.log('Autoremoving', sortedIds);
        await Promise.all(sortedIds.map((id) => UserModel.remove(id)));
      }
    });
  }, 5000);

  app.get('/User/', async function(req, res, next) {
    try {
      const defaultSortField = 'updatedAt';
      const allowedSortFields = ['name', 'email', 'createdAt', 'updatedAt'];
      let sortField = req.query.sortField;
      if (!sortField || !allowedSortFields.includes(sortField)) {
        sortField = defaultSortField;
      }
      const direction = req.query.direction === 'DESC' ? 'DESC' : 'ASC';
      // the sorting could easily be done after loading here, but for demo purposes we use nohm functionality
      const sortedIds = await UserModel.sort({
        field: sortField,
        direction,
      });
      const users = await UserModel.loadMany(sortedIds);
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

  app.post('/User/', async function(req, res, next) {
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

  app.put('/User/:id', async function(req, res, next) {
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

  app.post('/User/login', async function(req, res) {
    const user = new UserModel(); // alternatively Nohm.factory('User'); like in post
    const loginSuccess = await user.login(req.body.name, req.body.password);
    if (loginSuccess) {
      res.json({ result: 'success' });
    } else {
      res.status(401);
      res.send('Wrong login');
    }
  });

  app.delete('/User/:id', async function(req, res, next) {
    try {
      await UserModel.remove(req.params.id);
      res.status(204);
      res.end();
    } catch (err) {
      next(err);
    }
  });

  app.get('/', function(req, res) {
    res.send(fs.readFileSync(__dirname + '/index.html', 'utf-8'));
  });

  app.get('/client.js', function(req, res) {
    res.sendFile(__dirname + '/client.js');
  });

  app.use(function(err, req, res, _next) {
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

  server.listen(3000, () => {
    console.log('listening on 3000');
  });
});
