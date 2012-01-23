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
  } else if (pub_sub_client.subscriptions === true) {
    // already in pubsub mode, don't need to initialize it again.
    if (typeof(callback) === 'function') {
      callback();
    }
    return;
  }

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
    pub_sub_event_emitter.emit(modelName+':all', action, payload);

  });
};

var initialize = function () {

  /**
   * Set the pubSub client.
   * 
   * @param {Object} client Redis client to use. This client will be set to pubSub and cannot be used for normal commands after that.
   */
  Nohm.setPubSubClient = function (client, callback) {
    pub_sub_client = client;
    initializePubSub(callback);
  };

  /**
   * Return the PubSub Client, if set.
   */
  Nohm.getPubSubClient = function () {
    return pub_sub_client;
  };

  /**
   * Unsubscribes from the nohm redis pubsub channel.
   * @param {Function} callback Called after the unsubscibe. Parameters: redisClient
   */
  Nohm.closePubSub = function closePubSub (callback) {
    if (pub_sub_client.subscriptions === true) {
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

  // This populates the diff property for `change` events.
  messageComposers.change = function changeComposer (action, diff) {
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
  
  // Actually only the `action` argument must be declared here, it's the composers
  // duty to define its signature. I put model here to clarify that `action`
  // iself tells nothing about the event.
  Nohm.prototype.fireEvent = function (action) {
    var channel;
    var composer;
    var payload;
    var supported;
    
    if ( ! this.getPublish() ) {
      // global or model specific setting for publishing events is false.
      return false;
    }

    if (supportedActions.indexOf(action) < 0) {
      supported = supportedActions.join(', ');
      Nohm.logError(
        'Cannot fire an unsupported action. Was "' + action + '" ' +
        'and must be one of ' + supported
        );
      return false;
    }

    channel = this.modelName + ':' + action;
    composer = messageComposers[action] || messageComposers.defaultComposer;

    payload = composer.apply(this, arguments);

    publish(channel, payload);
  };  
  
  Nohm.setPublish = function (bool) {
    do_publish = bool;
  }
  
  Nohm.prototype.getPublish = function () {
    if (this.hasOwnProperty('publish')) {
      return this.publish;
    }
    return do_publish;
  };

  Nohm.prototype.subscribe = function (action, callback) {
    var self = this;
    initializePubSub(function () {
      pub_sub_event_emitter.on(self.modelName+':'+action, callback);
    });
  };

  Nohm.prototype.subscribeOnce = function (action, callback) {
    var self = this;
    initializePubSub(function () {
      pub_sub_event_emitter.once(self.modelName+':'+action, callback);
    });
  };

  Nohm.prototype.unsubscribe = function (action, callback) {
    var self = this;
    initializePubSub(function () {
      if (! callback) {
        pub_sub_event_emitter.removeAllListeners(self.modelName+':'+action);
      } else {
        pub_sub_event_emitter.removeListener(self.modelName+':'+action, callback);
      }
    });
  };

  Nohm.shortFormFuncs.push(
    'subscribe', 'subscribeOnce', 'unsubscribe', 'unsubscribeAll'
  );

};

