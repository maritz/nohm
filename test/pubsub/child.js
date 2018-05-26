var redis = require('redis');
var nohm = require(__dirname + '/../../tsOut/').Nohm;
var args = require(__dirname + '/../testArgs.js');

nohm.setPrefix(args.prefix);
args.redis.on('ready', function() {
  nohm.setClient(args.redis);
});
require(__dirname + '/Model.js');

process.on('message', async (msg) => {
  let event, modelName, instance, fn;

  switch (msg.question) {
    case 'does nohm have pubsub?':
      process.send({
        question: msg.question,
        answer: nohm.getPubSubClient(),
      });
      break;

    case 'initialize':
      try {
        await nohm.setPubSubClient(
          redis.createClient(args.redis_port, args.redis_host),
        );
        process.send({
          question: msg.question,
          answer: true,
          error: null,
        });
      } catch (err) {
        process.send({
          question: msg.question,
          answer: err || true,
          error: err,
        });
      }
      break;

    case 'subscribe':
      event = msg.args.event;
      modelName = msg.args.modelName;
      instance = await nohm.factory(modelName);
      await instance.subscribe(event, function(change) {
        process.send({
          question: 'subscribe',
          answer: change,
          event: event,
        });
      });
      process.send({
        question: 'subscribe',
        answer: 'ACK',
      });
      break;

    case 'subscribeOnce':
      event = msg.args.event;
      modelName = msg.args.modelName;
      instance = await nohm.factory(modelName);
      await instance.subscribeOnce(event, function(change) {
        process.send({
          question: 'subscribeOnce',
          answer: change,
        });
      });
      process.send({
        question: 'subscribeOnce',
        answer: 'ACK',
      });
      break;

    case 'unsubscribe':
      event = msg.args.event;
      modelName = msg.args.modelName;
      fn = msg.args.fn;
      instance = await nohm.factory(modelName);
      await instance.unsubscribe(event, fn);
      process.send({
        question: 'unsubscribe',
        answer: true,
      });
      break;
  }
});
