var redis = require('redis');
var nohm = require(__dirname+'/../../lib/nohm').Nohm;
var args = require(__dirname+'/../testArgs.js');

nohm.setPrefix(args.prefix);
nohm.setClient(args.setClient);
require(__dirname+'/Model.js');

process.on('message', function (msg) {
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
      var event = msg.args.event;
      var modelName = msg.args.modelName;
      nohm.factory(modelName).subscribe(event, function (change) {
        process.send({
          question: 'subscribe',
          answer: change
        })
      });
    break;
  }
});