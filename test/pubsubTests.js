var redis = require('redis');
var nohm = require(__dirname+'/../lib/nohm').Nohm;
var child_process = require('child_process');

require(__dirname+'/pubsub/Model.js');

var child_path = __dirname+'/pubsub/child.js'

nohm.logError = function (err) {
  if (err) {
    throw new rror(err);
  }
};

// TODO base pub/sub tests.

var after = function (times, fn) {
  return function () {
    if ((times--)==1) {
      fn.apply(this, arguments);
    }
  };
};

var tearDown = function (next) {
  nohm.closePubSub(next);
};

var secondaryClient = redis.createClient();

module.exports = {
  
  'after helper function': function(t) {

    var counter = 0;
  
    var _test = after(3, function () {
      counter += 1;
    });
  
    _test();_test();_test();_test();
  
    t.equal(counter, 1, 'Function has been called a wrong number of times');
    t.done();
  
  },
  
  'set/get pubSub client': function (t) {
    t.expect(3);
    nohm.setPubSubClient(secondaryClient, function (err) {
      t.ok(!err, 'There was an error while subscribing');
      t.same(nohm.getPubSubClient(), secondaryClient, 'Second redis client wasn\'t set properly');
      t.ok(nohm.getPubSubClient().subscriptions, 'Second redis client isn\'t subscribed to anything');
      t.done();
    });
  },
  
  'unsubscribe': function (t) {
    t.expect(1);
    nohm.closePubSub(function (err, client) {
      t.same(client, secondaryClient, 'closePubSub returned a wrong redis client');
      client.end();
      t.done();
    });
  },
  
  'set/get publish bool': function (t) {
    t.expect(4);
    
    var no_publish = nohm.factory('no_publish');
    t.same(no_publish.getPublish(), false, 'model without publish returned true');
    
    var publish = nohm.factory('Tester');
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
        t.same(msg.answer, false, 'PubSub in the child process was already initialized.')
        child.kill();
        t.done();
      }
    };
    child.on('message', checkNohmPubSubNotInitialized);
    child.send({question: question});
  },
  
  'initialized': {
    setUp: function (next) {
      this.child = child_process.fork(child_path, process.argv);
      this.child.on('message', function (msg) {
        if (msg.question === 'initialize' && msg.answer === true) {
          next();
        }
        if (msg.error) {
          throw new Error(msg.error);
        }
      });
      this.child.send({question: 'initialize'});
    },
    
    tearDown: function (next) {
      this.child.kill();
      nohm.closePubSub(function (err, client) {
        client.end();
        next();
      });
    },
    
    'create': function (t) {
      t.expect(5);
      var instance = nohm.factory('Tester');
      instance.p('dummy', 'asdasd');
      
      this.child.send({
        question: 'subscribe',
        args: {
          event: 'create',
          modelName: 'Tester'
        }
      });
      
      this.child.on('message', function (msg) {
        if (msg.question === 'subscribe') {
          t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event?! oO');
          t.same(instance.id, msg.answer.target.id, 'Id from save event wrong');
          t.same(instance.modelName, msg.answer.target.modelName, 'Modelname from save event wrong');
          t.same(instance.allProperties(), msg.answer.target.properties, 'Properties from save event wrong');
          t.done();
        }
      });
      
      instance.save(function (err) {
        t.ok(!err, 'Saving produced an error');
      });
    }
  }
};

// ignored from here on out.

var obj;

exports.creationOnce = function(t) {

  t.expect(5);

  var _done = after(3, function () {
    t.done();
  });

  Tester.subscribeOnce('create', function (payload) {

    var expectedPayload = {
      target: {
        id: obj.id,
        model: 'Tester',
        properties: {
          dummy: 'some string',
          id: obj.id
        }
      }
    };

    t.ok(!!payload, 'Subscriber did not recieved a payload.');
    t.ok(!!payload.target, 'Subscriber did not recieved a payload.target object.');
    t.equal(payload.target.id, obj.id, 'Passed payload has an incorrect ID.');

    t.deepEqual(payload, expectedPayload, "Passed payload is not equal to expected one.");

    _done();
  });

  obj = new Tester();
  obj.p({
    dummy: 'some string'
  });

  obj.save(function(err){
    t.ok(!err, 'There was an error during .save.');
    _done();
  });

  _done();

};

exports.removeOnce = function (t) {

  var _id = obj.id;

  t.expect(5);

  var _done = after(3, function () {
    t.done();
  });

  Tester.subscribe('remove', function (payload) {

    var expectedPayload = {
      target: {
        id: _id,
        model: 'Tester',
        properties: {
          id: 0,
          dummy: 'some string'
        }
      }
    };

    t.ok(!!payload, 'Subscriber did not recieved a payload');
    t.ok(!!payload.target, 'Subscriber did not recieved a payload.target object.');
    t.equal(payload.target.id, _id, 'Passed payload has an incorrect ID.')

    t.deepEqual(payload, expectedPayload, "Passed payload is not equal to expected one.");

    _done();
  });

  obj.remove(function(err){
    t.ok(!err, 'There was an error during .remove.');
    _done();
  });

  _done();

};

exports.silencedUpdate = function (t) {

  t.expect(0);

  var _done = after(2, function () {
    t.done();
  });

  var run = 0;

  obj = new Tester();

  obj.p({dummy: 'some strings'});

  Tester.subscribe('update', function (payload) {
    var msg = run == 1 ? 'first run' : 'second run, listener not unsubscribed';
    t.ok(false, 'The subscriber has run, during silent creation ('+msg+')');
  });

  run = 1;

  obj.save({silent: true}, function () {
    _done();
  });

  setTimeout(function(){

    Tester.unsubscribe('update');

    run = 2;
    obj.p({dummy: 'some other string'});

    obj.save({silent: true}, function () {
      _done();
    });

  }, 100);

};

exports.silencedRemoval = function (t) {
  
  t.expect(0);

  var _done = after(2, function () {
    t.done();
  });

  Tester.subscribe('remove', function (payload) {
    t.ok(false, 'The subscriber has run, during silent removal.')
  });

  obj.remove({silent: true}, function () {
    _done();    
  });

  setTimeout(function () {
    _done();
  }, 100)

};

exports.closePubSub = function (t) {
  t.expect(1);
  nohm.closePubSub(function (client) {
    t.equal(false, client.subscriptions, 'closePubSub() did not unsubcribe from all channels.');
    client.end();
    t.done();
  });
}

