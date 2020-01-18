import anyTest, { TestInterface } from 'ava';

import { NohmClass } from '../ts';
import * as child_process from 'child_process';

import * as testArgs from './testArgs';
import { cleanUpPromise, sleep } from './helper';
import { IPropertyDiff } from '../ts/model.header';
import { register } from './pubsub/Model';

interface IChildProcessWithAsk extends child_process.ChildProcess {
  ask(...args: Array<any>): Promise<void>;
}

const test = anyTest as TestInterface<{
  child: IChildProcessWithAsk;
  nohm: NohmClass;
  prefix: string;
}>;

const prefix = testArgs.prefix + 'pubsub';

let testCounter = 0;

// We create a child process with a question/answer protocol to ./pubsub/child.ts .
// The returned object has a "child" node which is a normal child_process.fork but with an added .ask() method that
// resolves once the question has been acknowledged (e.g. the child.ts process was asked to subscribe and sends ACK
// after it has done so) and receives a callback argument that is called for each answer it has (e.g. for a subscribe
// it is called every time the subscription yields a published event)
const initializeChild = (childPrefix) => {
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
    child.send({ question: 'initialize', args: { prefix: childPrefix } });
  });
};

test.beforeEach(async (t) => {
  // setup a local nohm for each test with a separate prefix, so that they can run concurrently
  const localPrefix = `${prefix}/t${++testCounter}/`;
  const localNohm = new NohmClass({
    prefix: localPrefix,
  });
  await testArgs.setClient(localNohm, testArgs.redis);
  await cleanUpPromise(testArgs.redis, localPrefix);

  register(localNohm);

  t.context.child = await initializeChild(localPrefix);

  t.context.nohm = localNohm;
  t.context.prefix = localPrefix;
});

test.afterEach(async (t) => {
  await cleanUpPromise(testArgs.redis, t.context.prefix);
});

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

test('set/get pubSub client', async (t) => {
  await t.context.nohm.setPubSubClient(secondaryClient);
  const client = t.context.nohm.getPubSubClient();
  t.is(client, secondaryClient, "Second redis client wasn't set properly");
  const isIoRedis =
    client.connected === undefined && (client as any).status === 'ready';
  if (isIoRedis) {
    t.true(
      (client as any).condition.subscriber !== false,
      "Second redis client isn't subscribed to anything",
    );
  } else {
    t.truthy(
      (client as any).subscription_set,
      "Second redis client isn't subscribed to to any channels",
    );
  }
});

test('close pubSub client', async (t) => {
  await t.context.nohm.setPubSubClient(secondaryClient);

  const client = await t.context.nohm.closePubSub();
  t.is(client, secondaryClient, 'closePubSub returned a wrong redis client');
});

test('set/get publish bool', async (t) => {
  const noPublish = await t.context.nohm.factory('no_publish');
  t.false(
    // @ts-ignore
    noPublish.getPublish(),
    'model without publish returned true',
  );

  const publish = await t.context.nohm.factory('Tester');
  // @ts-ignore
  t.true(publish.getPublish(), 'model with publish returned false');

  t.context.nohm.setPublish(true);
  t.true(
    // @ts-ignore
    noPublish.getPublish(),
    'model without publish but global publish returned false',
  );

  t.context.nohm.setPublish(false);
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

test.afterEach.cb((t) => {
  t.context.child.on('exit', () => {
    t.end();
  });
  t.context.child.kill();
});

test('create', async (t) => {
  t.plan(4);
  const instance = await t.context.nohm.factory('Tester');
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
    await instance.save();
  });

  await childResponded;
});

test('update', async (t) => {
  t.plan(5);
  const instance = await t.context.nohm.factory('Tester');
  instance.property('dummy', 'update');
  let diff: Array<void | IPropertyDiff<string | number | symbol>>;

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
    await instance.save();
    instance.property('dummy', 'updatededed');
    diff = instance.propertyDiff();
    await instance.save();
  });

  await childResponded;
});

test('save', async (t) => {
  t.plan(8);
  const instance = await t.context.nohm.factory('Tester');
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
    await instance.save();
    props.push(instance.allProperties());
    instance.property('dummy', 'save_the_second');
    props.push(instance.allProperties());
    await instance.save();
  });

  await childResponded;
});

test('remove', async (t) => {
  t.plan(4);
  const instance = await t.context.nohm.factory('Tester');
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
    await instance.save();
    oldId = instance.id;
    await instance.remove();
  });

  await childResponded;
});

test('link', async (t) => {
  t.plan(8);
  const instanceChild = await t.context.nohm.factory('Tester');
  const instanceParent = await t.context.nohm.factory('Tester');
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
    await instanceChild.save();
  });

  await childResponded;
});

test('unlink', async (t) => {
  t.plan(8);
  const instanceChild = await t.context.nohm.factory('Tester');
  const instanceParent = await t.context.nohm.factory('Tester');
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
    await instanceChild.save();
    instanceChild.unlink(instanceParent);
    await instanceChild.save();
  });

  await childResponded;
});

test('createOnce', async (t) => {
  // because testing a once event is a pain in the ass and really doesn't have many ways it can fail
  // if the on method on the same event works, we only do on once test.
  t.plan(5);
  const instance = await t.context.nohm.factory('Tester');
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

        const instanceInner = await t.context.nohm.factory('Tester');
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
    await instance.save();
  });

  await childResponded;
});

test('silenced', async (t) => {
  t.plan(1);
  const instance = await t.context.nohm.factory('Tester');
  instance.property('dummy', 'silenced');
  let answered = false;

  const events = ['create', 'update', 'save', 'remove', 'link', 'unlink'];

  await Promise.all(
    events.map((event) => {
      return t.context.child.ask(
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
    }),
  );

  await instance.save({ silent: true });
  instance.property('dummy', 'updated');
  await instance.save({ silent: true });
  const second = await t.context.nohm.factory('Tester');
  instance.link(second);
  await instance.save({ silent: true });
  instance.unlink(second);
  await instance.save({ silent: true });
  await instance.remove(true);
  await sleep(500);
  t.is(answered, false, 'There was an event!');
});
