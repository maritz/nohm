var redis = require('redis');
var nohm = require(__dirname+'/../lib/nohm').Nohm;
var child_process = require('child_process');

require(__dirname+'/pubsub/Model.js');

var child_path = __dirname+'/pubsub/child.js';

var after = function (times, fn) {
  return function () {
    if ((--times) <= 0) {
      fn.apply(this, arguments);
    }
  };
};

var error_callback = function (t) {
  return function (err) {
    if (err)
      console.log(arguments);
    t.ok(!err, 'Callback received an error');
  };
};

var secondaryClient = redis.createClient();

module.exports = {
  
  'after helper function': function(t) {

    var counter = 0;
  
    var _test = after(3, function () {
      counter += 1;
    });
  
    _test();_test();_test();
  
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
        t.same(msg.answer, false, 'PubSub in the child process was already initialized.');
        child.kill();
        t.done();
      }
    };
    child.on('message', checkNohmPubSubNotInitialized);
    child.send({question: question});
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
        child.send(request);
        child.on('message', function (msg) {
          if (msg.question === request.question) {
            callback(msg.answer);
          }
        });
      };
      child.send({question: 'initialize'});
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
      instance.p('dummy', 'create');
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'create',
          modelName: 'Tester'
        }
      }, function (answer) {
        t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
        t.same(instance.id, answer.target.id, 'Id from create event wrong');
        t.same(instance.modelName, answer.target.modelName, 'Modelname from create event wrong');
        t.same(instance.allProperties(), answer.target.properties, 'Properties from create event wrong');
        t.done();
      });
      
      instance.save(error_callback(t));
    },
    
    'update': function (t) {
      t.expect(7);
      var instance = nohm.factory('Tester');
      instance.p('dummy', 'update');
      var diff;
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'update',
          modelName: 'Tester'
        }
      }, function (answer) {
        t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
        t.same(instance.id, answer.target.id, 'Id from update event wrong');
        t.same(instance.modelName, answer.target.modelName, 'Modelname from update event wrong');
        t.same(instance.allProperties(), answer.target.properties, 'Properties from update event wrong');
        t.same(diff, answer.target.diff, 'Properties from update event wrong');
        t.done();
      });
      
      instance.save(function (err) {
        error_callback(t)(err);
        instance.p('dummy', 'updatededed');
        diff = instance.propertyDiff();
        instance.save(error_callback(t));
      });
    },
    
    'save': function (t) {
      t.expect(10);
      var instance = nohm.factory('Tester');
      instance.p('dummy', 'save');
      
      
      var counter = 0;      
      var props = [];
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'save',
          modelName: 'Tester'
        }
      }, function (answer) {
        t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
        t.same(instance.id, answer.target.id, 'Id from save event wrong');
        t.same(instance.modelName, answer.target.modelName, 'Modelname from save event wrong');
        t.same(props[counter], answer.target.properties, 'Properties from save event wrong');
        counter++;
        if (counter >= 2) {
          t.done();
        }
      });
      
      instance.save(function (err) {
        error_callback(t)(err);
        props.push(instance.allProperties());
        instance.p('dummy', 'save_the_second');
        props.push(instance.allProperties());
        instance.save(error_callback(t));
      });
    },
    
    'remove': function (t) {
      t.expect(6);
      var instance = nohm.factory('Tester');
      instance.p('dummy', 'remove');
      var old_id;
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'remove',
          modelName: 'Tester'
        }
      }, function (answer) {
        t.same(instance.id, 0, 'ID was not reset properly before the child returned the event.');
        t.same(old_id, answer.target.id, 'Id from remove event wrong');
        t.same(instance.modelName, answer.target.modelName, 'Modelname from remove event wrong');
        t.same(instance.allProperties(), answer.target.properties, 'Properties from remove event wrong');
        t.done();
      });
      
      instance.save(function (err) {
        error_callback(t)(err);
        old_id = instance.id;
        instance.remove(error_callback(t));
      });
    },
    
    'link': function (t) {
      t.expect(9);
      var instance_child = nohm.factory('Tester');
      var instance_parent = nohm.factory('Tester');
      instance_child.p('dummy', 'link_child');
      instance_parent.p('dummy', 'link_parent');
      instance_child.link(instance_parent);      
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'link',
          modelName: 'Tester'
        }
      }, function (answer) {
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
      
      instance_child.save(error_callback(t));
    },
    
    'unlink': function (t) {
      t.expect(10);
      var instance_child = nohm.factory('Tester');
      var instance_parent = nohm.factory('Tester');
      instance_child.p('dummy', 'unlink_child');
      instance_parent.p('dummy', 'unlink_parent');
      instance_child.link(instance_parent);
      
      this.child.ask({
        question: 'subscribe',
        args: {
          event: 'unlink',
          modelName: 'Tester'
        }
      }, function (answer) {
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
      
      instance_child.save(function (err) {
        error_callback(t)(err);
        instance_child.unlink(instance_parent);
        instance_child.save(error_callback(t))
      });
    },
    
    'createOnce': function (t) {
      // because testing a once event is a pain in the ass and really doesn't have many ways it can fail if the on method on the same event works, we only do on once test.
      t.expect(7);
      var instance = nohm.factory('Tester');
      instance.p('dummy', 'create_once');
      var once_done = 0;
      
      this.child.ask({
        question: 'subscribeOnce',
        args: {
          event: 'create',
          modelName: 'Tester'
        }
      }, function (answer) {
        once_done++;
        t.ok(instance.id.length > 0, 'ID was not set properly before the child returned the event.');
        t.same(instance.id, answer.target.id, 'Id from createOnce event wrong');
        t.same(instance.modelName, answer.target.modelName, 'Modelname from createOnce event wrong');
        t.same(instance.allProperties(), answer.target.properties, 'Properties from createOnce event wrong');
        
        var instance_inner = nohm.factory('Tester');
        instance_inner.p('dummy', 'create_once_again');
        instance_inner.save(error_callback(t));
        
        setTimeout(function () {
          t.same(once_done, 1, 'subscribeOnce called the callback more than once.');
          t.done();
        }, 150); // this is fucked up :(
      });
      
      instance.save(error_callback(t));
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

