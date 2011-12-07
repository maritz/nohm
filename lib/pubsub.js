var Nohm = null,
	initialize;

exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  initialize();
};

var async = require('async'),
	EventEmitter = require('events').EventEmitter;
    h = require(__dirname + '/helpers');

initialize = function () {

	/**
	 * We need another client to use Pub Sub features!
	 */

	Nohm.pubsubClient = null;

	/**
	 * Set the second client
	 */

	Nohm.setPubSubClient = function (client) {
		Nohm.pubsubClient = client;
	}

	/**
	 * Return the PubSub Client, if set.
	 */

	Nohm.getPubSubClient = function () {
		return Nohm.pubsubClient;
	}

	// Pattern = _prefix_:channel:_modelname_:_action_

	/**
	 * The pub/sub feature is highly optional; Let derivate methods
	 * like `.subscribe` to call the initialization process. Can be
	 * called manually.
	 * Once called it replaces itself with an empty function to be
	 * sure it's called only once.
	 */

	var noop = function(){};

	Nohm.initializePubSub = function () {

		// Overwrites itself, ASAP
		Nohm.initializePubSub = noop;

		Nohm.pubsubEmitter = new EventEmitter();
		Nohm.pubsubEmitter.setMaxListeners(0);

		var pubSubClient = Nohm.getPubSubClient();
		if (!pubSubClient) {

			Nohm.logError('A second redis client must be specified to use pub/sub methods. Please declare one.')

		} else {

			var pattern = Nohm.prefix.channel + '*:*';

			pubSubClient.psubscribe(pattern,function(){
				//
			})

			pubSubClient.on('pmessage', function(pattern, channel, message){
				var action = channel.slice(Nohm.prefix.channel.length);
				Nohm.pubsubEmitter.emit(action, message);
				console.dir({
					channel: channel,
					message: message
				});
			})
		}

	};

	/**
	 *
	 */

	Nohm.prototype.subscribe = function (action, cb) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.on(this.modelName+':'+action, cb);
	};

	Nohm.prototype.subscribeOnce = function (action, cb) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.once(this.modelName+':'+action, cb);
	};

	Nohm.prototype.unsubscribe = function (action, cb) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.removeListener(this.modelName+':'+action, cb);
	};

	Nohm.prototype.unsubscribeAll = function (action) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.removeAllListeners(this.modelName+':'+action);
	};

	Nohm.shortFormFuncs.push(
		'subscribe', 'subscribeOnce', 'unsubscribe', 'unsubscribeAll'
	);

}

