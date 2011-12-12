
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

		var EE, pubSubClient;

		// Overwrites itself, ASAP
		Nohm.initializePubSub = function(){};

		Nohm.pubsubEmitter = new EventEmitter();
		Nohm.pubsubEmitter.setMaxListeners(0);

		pubSubClient = Nohm.getPubSubClient();

		if (!pubSubClient) {

			Nohm.logError('A second redis client must be specified to use pub/sub methods. Please declare one.')

		} else {

			var pattern = Nohm.prefix.channel + '*:*';

			pubSubClient.psubscribe(pattern,function(){
				//
			});

			pubSubClient.on('pmessage', function(pattern, channel, message){

				var modelName, action, rest, payload,
					EE = Nohm.pubsubEmitter,
					suffix = channel.slice(Nohm.prefix.channel.length),
					parts = suffix.match(actionSplitter);

				if (!parts) {
					Nohm.logError("An erroneus channel has been captured.");
					return;
				}

				modelName = parts[0];
				action = parts[1];
				rest = parts.splice(2); // not used

				payload = {};

				try {
					payload = message ? JSON.parse(message) : {};
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
		default: function defaultComposer (action, model) {
			var result = {
				target: {
					id: model.id,
					properties: model.allProperties()
				}
			};
			return result;
		},

		// This populates the diff property for `change` events.
		change: function changeComposer (action, model, diff) {
			var result = messageComposers.default.apply(this, arguments);
			result.target.diff = diff;
			return result;
		},

		// This sets the id and properties
		remove: function removeComposer (action, model, id) {
			var result = messageComposers.default.apply(this, arguments);
			result.target.id = id;
			return result;
		},
	};

	// Actually only the `action` argument must be declared here, Is the composer
	// duty to define its signature. I put model here to clarify that `action`
	// iself tells nothing about the event.

	Nohm.fire = function (action, model) {

		if (typeof model === 'string') {
			// Temporary
			Nohm.logError("Swap arguments! (Nohm.fire)");
		}

		var channel, composer, payload, supported;

		if (supportedActions.indexOf(action) < 0) {
			supported = supportedActions.join(', ')
			Nohm.logError(
				'Cannot fire an unsupported action. Was "' + action + '" ' +
				'and must be one of ' + supported
			);
			return false;
		}

		channel = model.modelName + ':' + action;
		composer = messageComposers[action] || messageComposers.default;

		payload = composer.apply(model, arguments);

		Nohm.publish(channel, payload);
	};

	Nohm.publish = function (channel, payload, parse) {

		var message;
		
		if (parse || typeof payload !== 'string') {
			message = JSON.stringify(payload);
		}

		client = Nohm.client;

		if (!client) {
			Nohm.logError("No client specified. Please provide one,");
			return;
		}

		if (!client.publish) {
			Nohm.logError("Specified client does not support pubsub.");
			return;
		}

		client.publish( Nohm.prefix.channel + channel, message );
	}

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

