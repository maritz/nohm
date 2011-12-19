
var Nohm = null,
initialize;

exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  initialize();
};

var EventEmitter = require('events').EventEmitter;
var h = require(__dirname + '/helpers');

initialize = function () {

  /**
   * Seperate redis client for pubSub.
   */
  Nohm.pubsubClient = null;

  /**
   * Set the pubSub client.
   * 
   * @param {Object} client Redis client to use. This client will be set to pubSub and cannot be used for normal commands after that.
   */
  Nohm.setPubSubClient = function (client) {
    Nohm.pubsubClient = client;
  };

  /**
   * Return the PubSub Client, if set.
   */
  Nohm.getPubSubClient = function () {
    return Nohm.pubsubClient;
  };

  /**
   * Unsubscribes from the nohm redis pubsub channel.
   * @param {Function} callback Called after the unsubscibe. Parameters: redisClient
   */
  Nohm.closePubSub = function closePubSub (callback) {
    var client = Nohm.getPubSubClient();
    if (client.subscriptions === true) {
      client.punsubscribe(Nohm.prefix.channel + '*:*', function () {
        callback(client);
      });
    } else {
      callback(client);
    }
  };

  /**
   * The pub/sub feature is highly optional; Let derivate methods
   * like `.subscribe` to call the initialization process. Can be
   * called manually.
   */

  Nohm.pubsubEmitter = new EventEmitter();
  Nohm.pubsubEmitter.setMaxListeners(0);

  Nohm.initializePubSub = function initializePubSub () {
    var pubSubClient = Nohm.getPubSubClient();
    
    if (!pubSubClient) {
      return Nohm.logError('A second redis client must be specified to use pub/sub methods. Please declare one.');
    } else if (pubSubClient.subscriptions === true) {
      return; // already in pubsub mode, don't need to initialize it again.
    }

    var pattern = Nohm.prefix.channel + '*:*';

    pubSubClient.psubscribe(pattern);

    pubSubClient.on('pmessage', function(pattern, channel, message){

      var modelName;
      var action;
      var rest;
      var payload;
      var EE = Nohm.pubsubEmitter;
      var suffix = channel.slice(Nohm.prefix.channel.length);
      var parts = suffix.match(/([^:]+)/g); // Pattern = _prefix_:channel:_modelname_:_action_

      if (!parts) {
        Nohm.logError("An erroneous channel has been captured.");
        return;
      }

      modelName = parts[0];
      action = parts[1];
      rest = parts.splice(2); // not used

      payload = {};

      try {
        payload = message ? JSON.parse(message) : {};
      } catch (e) {
        Nohm.logError('A published message is not valid JSON. Was : "'+message+'"');
        return;
      }

      EE.emit(modelName+':'+action, payload);
      EE.emit(modelName+':all', action, payload);

    });

  };

  var messageComposers = {

    // The default (base) message creator
    defaultComposer: function defaultComposer (action, model) {
      return {
        target: {
          id: model.id,
          model: model.modelName,
          properties: model.allProperties()
        }
      };
    }

  };

  // This populates the diff property for `change` events.
  messageComposers.change = function changeComposer (action, model, diff) {
    var result = messageComposers.defaultComposer.apply(this, arguments);
    result.target.diff = diff;
    return result;
  };

  // This sets the id and properties
  messageComposers.remove = function removeComposer (action, model, id) {
    var result = messageComposers.defaultComposer.apply(this, arguments);
    result.target.id = id;
    return result;
  };

  messageComposers.link = messageComposers.unlink = function relationComposer (action, child, parent, relationName) {
    var result = {};
    result.child = messageComposers.defaultComposer.call(child, action, child).target;
    result.parent = messageComposers.defaultComposer.call(parent, action, parent).target;
    result.relation = relationName;
    return result;
  };


  var supportedActions = [ 'create', 'update', 'change', 'remove', 'unlink', 'link' ];
  
  // Actually only the `action` argument must be declared here, Is the composer's
  // duty to define its signature. I put model here to clarify that `action`
  // iself tells nothing about the event.
  Nohm.fire = function (action, model) {
    var channel;
    var composer;
    var payload;
    var supported;

    if (supportedActions.indexOf(action) < 0) {
      supported = supportedActions.join(', ');
      Nohm.logError(
        'Cannot fire an unsupported action. Was "' + action + '" ' +
        'and must be one of ' + supported
        );
      return false;
    }

    channel = model.modelName + ':' + action;
    composer = messageComposers[action] || messageComposers.defaultComposer;

    payload = composer.apply(model, arguments);

    Nohm.publish(channel, payload);
  };

  Nohm.publish = function (channel, payload, parse) {
    var message;
    var client = Nohm.client;
    
    if (parse || typeof payload !== 'string') {
      message = JSON.stringify(payload);
    }

    if (!client) {
      Nohm.logError("No redis client specified. Please provide one (Nohm.setClient()).");
    } else if (!client.publish) {
      Nohm.logError("Specified client does not support pubsub.");
    } else {
      client.publish( Nohm.prefix.channel + channel, message );
    }
  };


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
    if (! callback) {
      Nohm.pubsubEmitter.removeAllListeners(this.modelName+':'+action);
    } else {
      Nohm.pubsubEmitter.removeListener(this.modelName+':'+action, callback);
    }
  };

  Nohm.shortFormFuncs.push(
    'subscribe', 'subscribeOnce', 'unsubscribe', 'unsubscribeAll'
    );

};

