
var redis = require('redis');
var util = require('util');
var args = require(__dirname+'/testArgs.js');

var nohm = require(__dirname+'/../lib/nohm').Nohm;
var primaryClient = nohm.client;
var secondaryClient = redis.createClient();

nohm.setPubSubClient(secondaryClient);

var Tester = nohm.model('Tester', {
  properties: {
    dummy: {
      type: 'string'
    }
  }
});

// TODO base pub/sub tests.

var after = function (times, fn) {
  return function () {
    if ((times--)==1) {
      fn.apply(this, arguments);
    }
  };
};

exports.afterLimiter = function(t) {

  var counter = 0;

  var _test = after(3, function () {
    counter += 1;
  });

  _test(); _test(); _test(); _test();

  t.equal(counter, 1, 'Function has been called a wrong number of times');
  t.done();

};

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

exports.silencedCreation = function (t) {

  t.expect(0);

  var _done = after(2, function () {
    t.done();
  });

  var run = 0;

  obj = new Tester();

  obj.p({ dummy: 'some strings' });

  Tester.subscribe('create', function (payload) {
    var msg = run == 1 ? 'first run' : 'second run, listener not unsubscribed';
    t.ok(false, 'The subscriber has run, during silenced actions ('+msg+')');
  });

  run = 1;

  obj.save({ silent: true }, function () {
    _done();
  });

  setTimeout(function(){

    Tester.unsubscribe('create');

    run = 2;
    obj.p({ dummy: 'some other string' });

    obj.save({ silent: true }, function () {
      _done();
    });

  }, 500);

};

