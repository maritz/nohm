
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
		if ((times--)<=1) {
			fn.apply(this, arguments);
		}
	};
};

exports.creationOnce = function(t) {

	var obj;
	t.expect(4);

	var _done = after(2, function () {
		t.done();
	});

	Tester.subscribeOnce('create', function (payload) {
		t.ok(!!payload, 'Subscriber did not recieved a payload.');
		t.ok(!!payload.target, 'Subscriber did not recieved a payload.target object.');
		t.equal(payload.target.id, obj.id, 'Passed payload has an incorrect ID.');
		_done();
	});

	obj = new Tester();
	obj.p({
		dummy: 'some string'
	});

	obj.save(function(err){
		t.ok(!err, 'There was an error during .save.');
		_done();
	})

}

