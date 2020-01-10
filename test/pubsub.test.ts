import anyTest, { TestInterface } from 'ava';

import { nohm } from '../ts';
import * as child_process from 'child_process';

import * as testArgs from './testArgs';
import { cleanUpPromise, sleep } from './helper';

interface IChildProcessWithAsk extends child_process.ChildProcess {
  ask(...args: Array<any>): Promise<void>;
}

const test = anyTest as TestInterface<{
  child: IChildProcessWithAsk;
}>;

const prefix = testArgs.prefix + 'pubsub';

test.before(async () => {
  nohm.setPrefix(prefix);
  await testArgs.setClient(nohm, testArgs.redis);
  await cleanUpPromise(testArgs.redis, prefix);
});

test.afterEach(async () => {
  await cleanUpPromise(testArgs.redis, prefix);
});

// tslint:disable-next-line:no-var-requires
require('./pubsub/Model');

const childPath = __dirname + '/pubsub/child_wrapper.js';

const after = (times: number, fn: () => void) => {
  return (...args: Array<any>) => {
    if (--times <= 0) {
      fn.apply(this, args);
    }
  };
};

const secondaryClient = testArgs.secondaryClient;

test('after helper function', async (t) => {
  let counter = 0;

  const _test = after(3, () => {
    counter += 1;
  });

  _test();
  _test();
  _test();

  t.is(counter, 1, 'Function has been called a wrong number of times');
});

test.serial('set/get pubSub client', async (t) => {
  await nohm.setPubSubClient(secondaryClient);
  const client = nohm.getPubSubClient();
  t.is(client, secondaryClient, "Second redis client wasn't set properly");
  const isIoRedis =
    client.connected === undefined && (client as any).status === 'ready';
  if (isIoRedis) {
    t.true(
      (client as any).condition.subscriber !== false,
      "Second redis client isn't subscribed to anything",
    );
  } else {
    t.snapshot(
      (client as any).subscription_set,
      "Second redis client isn't subscribed to anything",
    );
  }
});

test.serial('close pubSub client', async (t) => {
  const client = await nohm.closePubSub();
  t.is(client, secondaryClient, 'closePubSub returned a wrong redis client');
  client.end(true);
});

test.serial('set/get publish bool', async (t) => {
  const noPublish = await nohm.factory('no_publish');
  t.false(
    // @ts-ignore
    noPublish.getPublish(),
    'model without publish returned true',
  );

  const publish = await nohm.factory('Tester');
  // @ts-ignore
  t.true(publish.getPublish(), 'model with publish returned false');

  nohm.setPublish(true);
  t.true(
    // @ts-ignore
    noPublish.getPublish(),
    'model without publish but global publish returned false',
  );

  nohm.setPublish(false);
  t.true(
    // @ts-ignore
    publish.getPublish(),
    'model with publish and global publish false returned false',
  );
});

test.cb("nohm in child process doesn't have pubsub yet", (t) => {
  t.plan(1);
  const question = 'does nohm have pubsub?';
  const child = child_process.fork(childPath);
  const checkNohmPubSubNotInitialized = (msg) => {
    if (msg.question === question) {
      t.is(
        msg.answer,
        undefined,
        'PubSub in the child process was already initialized.',
      );
      child.kill();
      t.end();
    }
  };
  child.on('message', checkNohmPubSubNotInitialized);
  child.send({ question });
});

const initializeChild = () => {
  return new Promise<IChildProcessWithAsk>((resolve, reject) => {
    const child = child_process.fork(childPath, process.argv);
    child.on('message', (msg) => {
      if (msg.question === 'initialize' && msg.answer === true) {
        resolve(child as IChildProcessWithAsk);
      }
      if (msg.error) {
        console.error(
          'Error message from child process in pubsub tests!',
          msg.error,
        );
        reject(msg.error);
        process.exit(1);
      }
    });

    (child as any).ask = (request, callback) => {
      return new Promise((resolveInner) => {
        child.on('message', (msg) => {
          if (msg.question === request.question) {
            if (msg.answer === 'ACK') {
              // this happens on things like subscribe where it acknowledges the subscribe has happened
              resolveInner();
            } else {
              // in case of a subscribe this is a message the subscription has received
              callback(msg);
            }
          }
        });
        child.send(request);
      });
    };
    child.send({ question: 'initialize' });
  });
};

test.serial.beforeEach(async (t) => {
  t.context.child = await initializeChild();
});

test.serial.afterEach.cb((t) => {
  t.context.child.on('exit', () => {
    t.end();
  });
  t.context.child.kill();
});

test.serial('create', async (t) => {
  t.plan(4);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'create');

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'create',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const target = msg.answer.target;
        t.true(
          instance.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instance.id, target.id, 'Id from create event wrong');
        t.is(
          instance.modelName,
          target.modelName,
          'Modelname from create event wrong',
        );
        t.deepEqual(
          instance.allProperties(),
          target.properties,
          'Properties from create event wrong',
        );
        resolve();
      },
    );
  });

  try {
    await instance.save();
  } catch (err) {
    t.is(err, null, 'Async actions failed');
  }
  await childResponded;
});

test.serial('update', async (t) => {
  t.plan(5);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'update');
  let diff;

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'update',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const answer = msg.answer;
        t.true(
          instance.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instance.id, answer.target.id, 'Id from update event wrong');
        t.is(
          instance.modelName,
          answer.target.modelName,
          'Modelname from update event wrong',
        );
        t.deepEqual(
          instance.allProperties(),
          answer.target.properties,
          'Properties from update event wrong',
        );
        t.deepEqual(diff, answer.target.diff, 'Diffs from update event wrong');
        resolve();
      },
    );
  });

  await instance.save();
  instance.property('dummy', 'updatededed');
  diff = instance.propertyDiff();
  await instance.save();
  await childResponded;
});

test.serial('save', async (t) => {
  t.plan(8);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'save');

  let counter = 0;
  const props = [];

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'save',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const answer = msg.answer;
        t.true(
          instance.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instance.id, answer.target.id, 'Id from save event wrong');
        t.is(
          instance.modelName,
          answer.target.modelName,
          'Modelname from save event wrong',
        );
        t.deepEqual(
          props[counter],
          answer.target.properties,
          'Properties from save event wrong',
        );
        counter++;
        if (counter >= 2) {
          resolve();
        }
      },
    );
  });

  await instance.save();
  props.push(instance.allProperties());
  instance.property('dummy', 'save_the_second');
  props.push(instance.allProperties());
  await instance.save();
  await childResponded;
});

test.serial('remove', async (t) => {
  t.plan(4);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'remove');
  let oldId;

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'remove',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const answer = msg.answer;
        t.is(
          instance.id,
          null,
          'ID was not reset properly before the child returned the event.',
        );
        t.is(oldId, answer.target.id, 'Id from remove event wrong');
        t.is(
          instance.modelName,
          answer.target.modelName,
          'Modelname from remove event wrong',
        );
        t.deepEqual(
          instance.allProperties(),
          answer.target.properties,
          'Properties from remove event wrong',
        );
        resolve();
      },
    );
  });

  await instance.save();
  oldId = instance.id;
  await instance.remove();
  await childResponded;
});

test.serial('link', async (t) => {
  t.plan(8);
  const instanceChild = await nohm.factory('Tester');
  const instanceParent = await nohm.factory('Tester');
  instanceChild.property('dummy', 'link_child');
  instanceParent.property('dummy', 'link_parent');
  instanceChild.link(instanceParent);

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'link',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const answer = msg.answer;
        t.true(
          instanceChild.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instanceChild.id, answer.child.id, 'Id from link event wrong');
        t.is(
          instanceChild.modelName,
          answer.child.modelName,
          'Modelname from link event wrong',
        );
        t.deepEqual(
          instanceChild.allProperties(),
          answer.child.properties,
          'Properties from link event wrong',
        );

        t.true(
          instanceParent.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instanceParent.id, answer.parent.id, 'Id from link event wrong');
        t.is(
          instanceParent.modelName,
          answer.parent.modelName,
          'Modelname from link event wrong',
        );
        t.deepEqual(
          instanceParent.allProperties(),
          answer.parent.properties,
          'Properties from link event wrong',
        );
        resolve();
      },
    );
  });

  await instanceChild.save();
  await childResponded;
});

test.serial('unlink', async (t) => {
  t.plan(8);
  const instanceChild = await nohm.factory('Tester');
  const instanceParent = await nohm.factory('Tester');
  instanceChild.property('dummy', 'unlink_child');
  instanceParent.property('dummy', 'unlink_parent');
  instanceChild.link(instanceParent);

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event: 'unlink',
          modelName: 'Tester',
        },
      },
      (msg) => {
        const answer = msg.answer;
        t.true(
          instanceChild.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instanceChild.id, answer.child.id, 'Id from unlink event wrong');
        t.is(
          instanceChild.modelName,
          answer.child.modelName,
          'Modelname from unlink event wrong',
        );
        t.deepEqual(
          instanceChild.allProperties(),
          answer.child.properties,
          'Properties from unlink event wrong',
        );

        t.true(
          instanceParent.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instanceParent.id, answer.parent.id, 'Id from unlink event wrong');
        t.is(
          instanceParent.modelName,
          answer.parent.modelName,
          'Modelname from unlink event wrong',
        );
        t.deepEqual(
          instanceParent.allProperties(),
          answer.parent.properties,
          'Properties from unlink event wrong',
        );
        resolve();
      },
    );
  });

  await instanceChild.save();
  instanceChild.unlink(instanceParent);
  await instanceChild.save();
  await childResponded;
});

test.serial('createOnce', async (t) => {
  // because testing a once event is a pain in the ass and really doesn't have many ways it can fail
  // if the on method on the same event works, we only do on once test.
  t.plan(5);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'create_once');
  let answerCount = 0;

  const childResponded = new Promise(async (resolve) => {
    await t.context.child.ask(
      {
        question: 'subscribeOnce',
        args: {
          event: 'create',
          modelName: 'Tester',
        },
      },
      async (msg) => {
        const answer = msg.answer;
        answerCount++;
        t.true(
          instance.id.length > 0,
          'ID was not set properly before the child returned the event.',
        );
        t.is(instance.id, answer.target.id, 'Id from createOnce event wrong');
        t.is(
          instance.modelName,
          answer.target.modelName,
          'Modelname from createOnce event wrong',
        );
        t.deepEqual(
          instance.allProperties(),
          answer.target.properties,
          'Properties from createOnce event wrong',
        );

        const instanceInner = await nohm.factory('Tester');
        instanceInner.property('dummy', 'create_once_again');
        instanceInner.save();

        setTimeout(() => {
          t.is(
            answerCount,
            1,
            'subscribeOnce called the callback more than once.',
          );
          resolve();
        }, 150); // this is fucked up :(
      },
    );
  });

  await instance.save();
  await childResponded;
});

test.serial('silenced', async (t) => {
  t.plan(1);
  const instance = await nohm.factory('Tester');
  instance.property('dummy', 'silenced');
  let answered = false;

  const events = ['create', 'update', 'save', 'remove', 'link', 'unlink'];

  events.forEach((event) => {
    t.context.child.ask(
      {
        question: 'subscribe',
        args: {
          event,
          modelName: 'Tester',
        },
      },
      (msg) => {
        if (msg.event === event) {
          console.log('Received message from child:', msg);
          answered = true;
        }
      },
    );
  });

  await instance.save({ silent: true });
  instance.property('dummy', 'updated');
  await instance.save({ silent: true });
  const second = await nohm.factory('Tester');
  instance.link(second);
  await instance.save({ silent: true });
  instance.unlink(second);
  await instance.save({ silent: true });
  await instance.remove(true);
  await sleep(500);
  t.is(answered, false, 'There was an event!');
});
