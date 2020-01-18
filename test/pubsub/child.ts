import * as redis from 'redis';

import nohm from '../../ts/';
import * as args from '../testArgs';

args.redis.on('ready', () => {
  nohm.setClient(args.redis);
});

// tslint:disable-next-line:no-var-requires
require('./Model');

process.on('message', async (msg) => {
  let event: any;
  let modelName: string;
  let instance: any;
  let fn: any;

  switch (msg.question) {
    case 'does nohm have pubsub?':
      process.send({
        question: msg.question,
        answer: nohm.getPubSubClient(),
      });
      break;

    case 'initialize':
      try {
        if (!msg.args.prefix) {
          console.error('No prefix passed in initialize function.');
          process.exit(1);
        }
        nohm.setPrefix(msg.args.prefix);
        await nohm.setPubSubClient(
          redis.createClient(args.redisPort, args.redisHost),
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
      await instance.subscribe(event, (change) => {
        process.send({
          question: 'subscribe',
          answer: change,
          event,
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
      await instance.subscribeOnce(event, (change) => {
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
