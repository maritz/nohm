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

	var actionSplitter = /([^:]+)/g; // /([^:]+):([^:]+):?(.*)$/i;

	/**
	 * The pub/sub feature is highly optional; Let derivate methods
	 * like `.subscribe` to call the initialization process. Can be
	 * called manually.
	 * Once called it replaces itself with an empty function to be
	 * sure it's called only once.
	 */

	Nohm.pubsubEmitter = null;
	Nohm.initializePubSub = function () {

		// Overwrites itself, ASAP
		Nohm.initializePubSub = function(){};

		Nohm.pubsubEmitter = new EventEmitter();
		Nohm.pubsubEmitter.setMaxListeners(0);

		var pubSubClient = Nohm.getPubSubClient();
		if (!pubSubClient) {

			Nohm.logError('A second redis client must be specified to use pub/sub methods. Please declare one.')

		} else {

			var pattern = Nohm.prefix.channel + '*:*';

			pubSubClient.psubscribe(pattern,function(){
				//
			});

			pubSubClient.on('pmessage', function(pattern, channel, message){

				var EE = Nohm.pubsubEmitter;

				var suffix = channel.slice(Nohm.prefix.channel.length);

				var parts = suffix.match(actionSplitter);

				if (!parts) {
					Nohm.logError("An erroneus channel has been captured.");
					return;
				}

				var modelName = parts[0];
				var action = parts[1];
				var rest = parts.splice(2); // not used

				var payload = {};

				try {
					payload = JSON.parse(message);
				} catch (e) {
					Nohm.logError('A published message is not valid JSON. Was : "'+message+'"')
					return;
				}

				EE.emit(modelName+':'+action, payload);
				EE.emit(modelName+':all', action, payload);

			});
		}

	};

	/**
	 *
	 */

	var supportedActions = [ 'create', 'update', 'change', 'remove', 'link' ];

	var messageComposers = {

		// The default (base) message creator
		default: function (model, action) {
			var result = {
				target: {
					id: model.id,
					properties: model.allProperties()
				}
			};
			return result;
		},

		// This populates the diff property for `change` events.
		change: function (model, action, diff) {
			var result = messageComposers.default.apply(this, arguments);
			result.target.diff = diff;
			return result;
		},

		// This sets the id and properties
		remove: function (model, action, id) {
			var result = messageComposers.default.apply(this, arguments);
			result.target.id = id;
			return result;
		},
	};

	Nohm.fire = function (model, action) {
		if (supportedActions.indexOf(action) < 0) {
			var supp = supportedActions.join(', ')
			Nohm.logError('Cannot fire an unsupported action. Was "' + action + '" and must be one of ' + supp );
			return false;
		}

		var suffix = model.modelName + ':' + action,
			client = Nohm.client,
			composer = messageComposers[action] || messageComposers.default;

		var message = composer.apply(model, arguments);

		client.publish(Nohm.prefix.channel+suffix, JSON.stringify(message));
	};

	/**
	 *
	 */

	Nohm.prototype.subscribe = function (action, callback) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.on(this.modelName+':'+action, callback);
	};

	Nohm.prototype.subscribeOnce = function (action, callback) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.once(this.modelName+':'+action, callback);
	};

	Nohm.prototype.unsubscribe = function (action, callback) {
		Nohm.initializePubSub();
		if (callback == null) {
			Nohm.pubsubEmitter.removeAllListener(this.modelName+':'+action);
		} else {
			Nohm.pubsubEmitter.removeListener(this.modelName+':'+action, callback);
		}
	};

	Object.defineProperty( Nohm.prototype, 'silent', {
		get: function () {
			this.__silent = true;
			return this;
		},
		set: function () {},
		configurable: true,
		enumerable: false
	})

	/*
	Nohm.prototype.unsubscribeAll = function (action) {
		Nohm.initializePubSub();
		Nohm.pubsubEmitter.removeAllListeners(this.modelName+':'+action);
	};
	*/

	Nohm.shortFormFuncs.push(
		'subscribe', 'subscribeOnce', 'unsubscribe', 'unsubscribeAll'
	);

}

