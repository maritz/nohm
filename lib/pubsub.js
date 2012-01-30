var Nohm = null;

exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  initialize();
};

var EventEmitter = require('events').EventEmitter;
var h = require(__dirname + '/helpers');


/**
 * Seperate redis client for pubSub.
 */
var pub_sub_client = false;

var pub_sub_all_pattern = false;

var pub_sub_event_emitter = false;

var do_publish = false;

var is_subscribed = false;

/**
 *  Publish something on the nohm client.
 */
var publish = function (channel, payload, parse) {
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

var initializePubSub = function initializePubSub (callback) {
    
  if (!pub_sub_client) {
    return Nohm.logError('A second redis client must be specified to use pub/sub methods. Please declare one.');
  } else if (is_subscribed === true) {
    // already in pubsub mode, don't need to initialize it again.
    if (typeof(callback) === 'function') {
      callback();
    }
    return;
  }
  
  is_subscribed = true;
  
  pub_sub_all_pattern = Nohm.prefix.channel + '*:*';
  pub_sub_event_emitter = new EventEmitter();
  pub_sub_event_emitter.setMaxListeners(0);

  pub_sub_client.psubscribe(pub_sub_all_pattern, callback);

  pub_sub_client.on('pmessage', function(pattern, channel, message){
    var modelName;
    var action;
    var payload;
    var suffix = channel.slice(Nohm.prefix.channel.length);
    var parts = suffix.match(/([^:]+)/g); // Pattern = _prefix_:channel:_modelname_:_action_

    if (!parts) {
      Nohm.logError("An erroneous channel has been captured.");
      return;
    }

    modelName = parts[0];
    action = parts[1];

    payload = {};

    try {
      payload = message ? JSON.parse(message) : {};
    } catch (e) {
      Nohm.logError('A published message is not valid JSON. Was : "'+message+'"');
      return;
    }
  
    pub_sub_event_emitter.emit(modelName+':'+action, payload);
    //pub_sub_event_emitter.emit(modelName+':all', action, payload);

  });
};

var initialize = function () {

  /**
   * Set the pubSub client and initialize the subscriptions and event emitters.
   * 
   * @param {Object} client Redis client to use. This client will be set to pubSub and cannot be used for normal commands after that.
   * @param {Function} callback Called after the provided redis client is subscribed to the necessary channels.
   */
  Nohm.setPubSubClient = function (client, callback) {
    pub_sub_client = client;
    Nohm.closePubSub(function () {
      initializePubSub(callback);
    });
  };

  /**
   * Return the PubSub Client, if set.
   */
  Nohm.getPubSubClient = function () {
    return pub_sub_client;
  };

  /**
   * Unsubscribes from the nohm redis pubsub channel.
   * 
   * @param {Function} callback Called after the unsubscibe. Parameters: redisClient
   */
  Nohm.closePubSub = function closePubSub (callback) {
    if (is_subscribed === true) {
      is_subscribed = false;
      pub_sub_client.punsubscribe(pub_sub_all_pattern, function () {
        callback(null, pub_sub_client);
      });
    } else {
      callback(null, pub_sub_client);
    }
  };

 

  var messageComposers = {

    // The default (base) message creator
    defaultComposer: function defaultComposer (action) {
      return {
        target: {
          id: this.id,
          modelName: this.modelName,
          properties: this.allProperties()
        }
      };
    }

  };

  // This populates the diff property for `save` and `update` events.
  messageComposers.save = messageComposers.update = function changeComposer (action, diff) {
    var result = messageComposers.defaultComposer.apply(this, arguments);
    result.target.diff = diff;
    return result;
  };

  // This sets the id and properties
  messageComposers.remove = function removeComposer (action, id) {
    var result = messageComposers.defaultComposer.apply(this, arguments);
    result.target.id = id;
    return result;
  };

  messageComposers.link = messageComposers.unlink = function relationComposer (action, parent, relationName) {
    var result = {};
    result.child = messageComposers.defaultComposer.call(this, action).target;
    result.parent = messageComposers.defaultComposer.call(parent, action).target;
    result.relation = relationName;
    return result;
  };


  var supportedActions = [ 'create', 'update', 'save', 'remove', 'unlink', 'link' ];
  
  /**
   * Fires an event to be published to the redis db by the internal publisher.
   * 
   * @param {String} event Name of the event to be published. Allowed are: [ 'create', 'update', 'save', 'remove', 'unlink', 'link' ]
   */
  Nohm.prototype.fireEvent = function (event) {
    var channel;
    var composer;
    var payload;
    var supported;
    
    if ( ! this.getPublish() ) {
      // global or model specific setting for publishing events is false.
      return false;
    }

    if (supportedActions.indexOf(event) < 0) {
      supported = supportedActions.join(', ');
      Nohm.logError(
        'Cannot fire an unsupported action. Was "' + event + '" ' +
        'and must be one of ' + supported
        );
      return false;
    }

    channel = this.modelName + ':' + event;
    composer = messageComposers[event] || messageComposers.defaultComposer;

    payload = composer.apply(this, arguments);
    publish(channel, payload);
  };  
  
  /**
   * Set global boolean to publish events or not.
   * By default publishing is disabled globally.
   * The model-specific setting overwrites the global setting.
   * 
   * @param {Boolean} publish Whether nohm should publish its events.
   */
  Nohm.setPublish = function (publish) {
    do_publish = !!publish;
  }
  
  /**
   * Get the model-specific status of whether event should be published or not.
   * If no model-specific setting is found, the global setting is returned.
   * 
   * @returns {Boolean} True if this model will publish its events, False if not.
   */
  Nohm.prototype.getPublish = function () {
    if (this.hasOwnProperty('publish')) {
      return !!this.publish;
    }
    return do_publish;
  };

  /**
   * Subscribe to events of nohm models.
   * 
   * @param {String} event_name Name of the event to be listened to. Allowed are: [ 'create', 'update', 'save', 'remove', 'unlink', 'link' ]
   * @param {Function} callback Called every time an event of the provided name is published on this model.
   */
  Nohm.prototype.subscribe = function (event_name, callback) {
    var self = this;
    initializePubSub(function () {
      pub_sub_event_emitter.on(self.modelName+':'+event_name, callback);
    });
  };


  /**
   * Subscribe to an event of nohm models only once.
   * 
   * @param {String} event_name Name of the event to be listened to. Allowed are: [ 'create', 'update', 'save', 'remove', 'unlink', 'link' ]
   * @param {Function} callback Called once when an event of the provided name is published on this model and then never again.
   */
  Nohm.prototype.subscribeOnce = function (event_name, callback) {
    var self = this;
    initializePubSub(function () {
      pub_sub_event_emitter.once(self.modelName+':'+event_name, callback);
    });
  };

  /**
   * Unsubscribe from a nohm model event.
   * 
   * @param {String} event_name Name of the event to be unsubscribed from. Allowed are: [ 'create', 'update', 'save', 'remove', 'unlink', 'link' ]
   * @param {Function} fn Function to unsubscribe. If none is provided all subscriptions of the given event are unsubscribed!
   */
  Nohm.prototype.unsubscribe = function (event_name, fn) {
    if (pub_sub_event_emitter !== false) {
      if (! fn) {
        pub_sub_event_emitter.removeAllListeners(self.modelName+':'+event_name);
      } else {
        pub_sub_event_emitter.removeListener(self.modelName+':'+event_name, fn);
      }
    }
  };

};

