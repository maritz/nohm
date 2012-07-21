var redis = require('redis');
var nohm = require(__dirname+'/../../lib/nohm').Nohm;
var args = require(__dirname+'/../testArgs.js');

nohm.setPrefix(args.prefix);
args.redis.on('ready', function () {
  nohm.setClient(args.redis);
});
require(__dirname+'/Model.js');

process.on('message', function (msg) {
  var event, modelName, fn;
  
  switch (msg.question) {
    case 'does nohm have pubsub?':
      process.send({
        question: msg.question,
        answer: nohm.getPubSubClient()
      });
    break;
    
    case 'initialize':
      nohm.setPubSubClient(redis.createClient(args.redis_port, args.redis_host), function (err) {
        process.send({
          question: msg.question,
          answer: err || true,
          error: err
        });
      });
    break;
    
    case 'subscribe':
      event = msg.args.event;
      modelName = msg.args.modelName;
      nohm.factory(modelName).subscribe(event, function (change) {
        process.send({
          question: 'subscribe',
          answer: change,
          event: event
        });
      });
    break;
    
    case 'subscribeOnce':
      event = msg.args.event;
      modelName = msg.args.modelName;
      nohm.factory(modelName).subscribeOnce(event, function (change) {
        process.send({
          question: 'subscribeOnce',
          answer: change
        });
      });
    break;
    
    case 'unsubscribe':
      event = msg.args.event;
      modelName = msg.args.modelName;
      fn = msg.args.fn;
      nohm.factory(modelName).unsubscribe(event, fn);
      process.send({
        question: 'unsubscribe',
        answer: true
      });
    break;
  }
});