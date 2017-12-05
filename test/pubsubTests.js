var redis = require('redis');
var nohm = require(__dirname + '/../tsOut/').Nohm;
var child_process = require('child_process');

require(__dirname + '/pubsub/Model.js');

var child_path = __dirname + '/pubsub/child.js';

var after = function (times, fn) {
  return function () {
    if ((--times) <= 0) {
      fn.apply(this, arguments);
    }
  };
};

var secondaryClient = redis.createClient();

module.exports = {

  'after helper function': function (t) {

    var counter = 0;

    var _test = after(3, function () {
      counter += 1;
    });

    _test(); _test(); _test();

    t.equal(counter, 1, 'Function has been called a wrong number of times');
    t.done();

  },

  'set/get pubSub client': async (t) => {
    t.expect(2);
    await nohm.setPubSubClient(secondaryClient);
    t.same(nohm.getPubSubClient(), secondaryClient, 'Second redis client wasn\'t set properly');
    t.ok(nohm.getPubSubClient().subscription_set, 'Second redis client isn\'t subscribed to anything');
    t.done();
  },

  'close pubSub client': async (t) => {
    t.expect(1);
    const client = await nohm.closePubSub();
    t.same(client, secondaryClient, 'closePubSub returned a wrong redis client');
    client.end(true);
    t.done();
  },

  'set/get publish bool': async (t) => {
    t.expect(4);

    var no_publish = await nohm.factory('no_publish');
    t.same(no_publish.getPublish(), false, 'model without publish returned true');

    var publish = await nohm.factory('Tester');
    t.same(publish.getPublish(), true, 'model with publish returned false');

    nohm.setPublish(true);
    t.same(no_publish.getPublish(), true, 'model without publish but global publish returned false');

    nohm.setPublish(false);
    t.same(publish.getPublish(), true, 'model with publish and global publish false returned false');

    t.done();
  },

  'nohm in child process doesn\'t have pubsub yet': function (t) {
    t.expect(1);
    var question = 'does nohm have pubsub?';
    var child = child_process.fork(child_path);
    var checkNohmPubSubNotInitialized = function (msg) {
      if (msg.question === question) {
        t.same(msg.answer, undefined, 'PubSub in the child process was already initialized.');
        child.kill();
        t.done();
      }
    };
    child.on('message', checkNohmPubSubNotInitialized);
    child.send({ question: question });
  },

  'initialized': {
    setUp: function (next) {
      var child = this.child = child_process.fork(child_path, process.argv);
      child.on('message', function (msg) {
        if (msg.question === 'initialize' && msg.answer === true) {
          next();
        }
        if (msg.error) {
          throw new Error(msg.error);
        }
      });

      child.ask = function (request, callback) {
        return new Promise((resolve) => {
          child.on('message', function (msg) {
            if (msg.question === request.question) {
              if (msg.answer === 'ACK') {
                resolve();
              } else {
                callback(msg);
              }
            }
          });
          child.send(request);
        });
      };
      child.send({ question: 'initialize' });
    },

    tearDown: function (next) {
      (async () => {
        this.child.on('exit', () => {
          next();
        });
        this.child.kill();
      })();
    },

    'create': function (t) {
      (async () => {
        t.expect(4);
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'create');

        await this.child.ask({
          question: 'subscribe',
          args: {
            event: 'create',
            modelName: 'Tester'
          }
        }, function (msg) {
          var target = msg.answer.target;
          t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance.id, target.id, 'Id from create event wrong');
          t.same(instance.modelName, target.modelName, 'Modelname from create event wrong');
          t.same(instance.allProperties(), target.properties, 'Properties from create event wrong');
          t.done();
        });

        try {
          instance.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'update': function (t) {
      (async () => {
        t.expect(5);
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'update');
        var diff;

        await this.child.ask({
          question: 'subscribe',
          args: {
            event: 'update',
            modelName: 'Tester'
          }
        }, function (msg) {
          var answer = msg.answer;
          t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance.id, answer.target.id, 'Id from update event wrong');
          t.same(instance.modelName, answer.target.modelName, 'Modelname from update event wrong');
          t.same(instance.allProperties(), answer.target.properties, 'Properties from update event wrong');
          t.same(diff, answer.target.diff, 'Diffs from update event wrong');
          t.done();
        });

        try {
          await instance.save();
          instance.property('dummy', 'updatededed');
          diff = instance.propertyDiff();
          await instance.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'save': function (t) {
      (async () => {
        t.expect(8);
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'save');

        var counter = 0;
        var props = [];

        this.child.ask({
          question: 'subscribe',
          args: {
            event: 'save',
            modelName: 'Tester'
          }
        }, function (msg) {
          var answer = msg.answer;
          t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance.id, answer.target.id, 'Id from save event wrong');
          t.same(instance.modelName, answer.target.modelName, 'Modelname from save event wrong');
          t.same(props[counter], answer.target.properties, 'Properties from save event wrong');
          counter++;
          if (counter >= 2) {
            t.done();
          }
        });

        try {
          await instance.save();
          props.push(instance.allProperties());
          instance.property('dummy', 'save_the_second');
          props.push(instance.allProperties());
          await instance.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'remove': function (t) {
      (async () => {
        t.expect(4);
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'remove');
        var old_id;

        await this.child.ask({
          question: 'subscribe',
          args: {
            event: 'remove',
            modelName: 'Tester'
          }
        }, function (msg) {
          var answer = msg.answer;
          t.same(instance.id, null, 'ID was not reset properly before the child returned the event.');
          t.same(old_id, answer.target.id, 'Id from remove event wrong');
          t.same(instance.modelName, answer.target.modelName, 'Modelname from remove event wrong');
          t.same(instance.allProperties(), answer.target.properties, 'Properties from remove event wrong');
          t.done();
        });

        try {
          await instance.save();
          old_id = instance.id;
          await instance.remove();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'link': function (t) {
      (async () => {
        t.expect(8);
        var instance_child = await nohm.factory('Tester');
        var instance_parent = await nohm.factory('Tester');
        instance_child.property('dummy', 'link_child');
        instance_parent.property('dummy', 'link_parent');
        instance_child.link(instance_parent);

        await this.child.ask({
          question: 'subscribe',
          args: {
            event: 'link',
            modelName: 'Tester'
          }
        }, function (msg) {
          var answer = msg.answer;
          t.ok(instance_child.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance_child.id, answer.child.id, 'Id from link event wrong');
          t.same(instance_child.modelName, answer.child.modelName, 'Modelname from link event wrong');
          t.same(instance_child.allProperties(), answer.child.properties, 'Properties from link event wrong');

          t.ok(instance_parent.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance_parent.id, answer.parent.id, 'Id from link event wrong');
          t.same(instance_parent.modelName, answer.parent.modelName, 'Modelname from link event wrong');
          t.same(instance_parent.allProperties(), answer.parent.properties, 'Properties from link event wrong');
          t.done();
        });


        try {
          await instance_child.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'unlink': function (t) {
      (async () => {
        t.expect(8);
        var instance_child = await nohm.factory('Tester');
        var instance_parent = await nohm.factory('Tester');
        instance_child.property('dummy', 'unlink_child');
        instance_parent.property('dummy', 'unlink_parent');
        instance_child.link(instance_parent);

        await this.child.ask({
          question: 'subscribe',
          args: {
            event: 'unlink',
            modelName: 'Tester'
          }
        }, function (msg) {
          var answer = msg.answer;
          t.ok(instance_child.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance_child.id, answer.child.id, 'Id from unlink event wrong');
          t.same(instance_child.modelName, answer.child.modelName, 'Modelname from unlink event wrong');
          t.same(instance_child.allProperties(), answer.child.properties, 'Properties from unlink event wrong');

          t.ok(instance_parent.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance_parent.id, answer.parent.id, 'Id from unlink event wrong');
          t.same(instance_parent.modelName, answer.parent.modelName, 'Modelname from unlink event wrong');
          t.same(instance_parent.allProperties(), answer.parent.properties, 'Properties from unlink event wrong');
          t.done();
        });

        try {
          await instance_child.save();
          instance_child.unlink(instance_parent);
          await instance_child.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'createOnce': function (t) {
      (async () => {
        // because testing a once event is a pain in the ass and really doesn't have many ways it can fail if the on method on the same event works, we only do on once test.
        t.expect(5);
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'create_once');
        var once_done = 0;

        await this.child.ask({
          question: 'subscribeOnce',
          args: {
            event: 'create',
            modelName: 'Tester'
          }
        }, async (msg) => {
          var answer = msg.answer;
          once_done++;
          t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
          t.same(instance.id, answer.target.id, 'Id from createOnce event wrong');
          t.same(instance.modelName, answer.target.modelName, 'Modelname from createOnce event wrong');
          t.same(instance.allProperties(), answer.target.properties, 'Properties from createOnce event wrong');

          var instance_inner = await nohm.factory('Tester');
          instance_inner.property('dummy', 'create_once_again');
          instance_inner.save();

          setTimeout(function () {
            t.same(once_done, 1, 'subscribeOnce called the callback more than once.');
            t.done();
          }, 150); // this is fucked up :(
        });

        try {
          await instance.save();
        } catch (err) {
          t.same(err, null, 'Async actions failed');
          t.done();
        }
      })();
    },

    'silenced': function (t) {
      var self = this;
      t.expect(1);
      (async () => {
        var instance = await nohm.factory('Tester');
        instance.property('dummy', 'silenced');
        var answered = false;

        var events = ['create', 'update', 'save', 'remove', 'link', 'unlink'];

        events.forEach(function (event) {
          self.child.ask({
            question: 'subscribe',
            args: {
              event: event,
              modelName: 'Tester'
            }
          }, function (msg) {
            if (msg.event === event) {
              console.log('Received message from child:', msg);
              answered = true;
            }
          });
        });

        try {
          await instance.save({ silent: true });
          instance.property('dummy', 'updated');
          await instance.save({ silent: true });
          var second = await nohm.factory('Tester');
          instance.link(second);
          await instance.save({ silent: true });
          instance.unlink(second);
          await instance.save({ silent: true });
          await instance.remove({ silent: true });
          setTimeout(function () {
            t.same(answered, false, 'There was an event!');
            t.done();
          }, 250);
        } catch (err) {
          t.same(true, false, 'There was an unexpected error!');
          t.same(err, null, 'There was an unexpected error!');
        }
      })();
    }
  }
};
