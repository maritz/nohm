var h = require(__dirname + '/helpers');
var async = require('async');
var crypto = require('crypto');
var traverse = require('traverse');

/**
 * The Nohm object used for some general configuration and model creation.
 * @namespace Nohm
 * @exports exports as Nohm
 */
function Nohm () {
}

/**
 * The redis prefixed key object.
 * Defaults to prefixing with 'nohm' which then creates keys like 'nohm:idsets:someModel'.
 * @static
 */
Nohm.prefix = h.getPrefix('nohm');

/**
 * The property types that get indexed in a sorted set.
 * This should not be changed since it can invalidate already existing data.
 * @static
 */
Nohm.indexNumberTypes = ['integer', 'float', 'timestamp'];

/**
 * The current global nohm redis client
 * @static
 */
Nohm.client = null;

/**
 * Whether to store the meta values about models.
 * This is used for example by the admin app.
 * Defaults to true.
 * @static
 */
Nohm.meta = true;

/**
 * Model cache
 */
var models = {};

/**
 * Creates and returns a new model with the given name and options.
 * @param {String} Name Name of the model. This needs to be unique and is used in data storage. Thus <b>changing this will invalidate existing data</b>!
 * @param {Object} Option This is an object containing the actual model definitions. These are: properties, methods (optional) and the client (optional) to be used.
 * @static
 */
Nohm.model = function (name, options, temp) {
  if ( ! name ) {
    this.logError('When creating a new model you have to provide a name!');
  }
  
  var obj = function (id, cb) {
    this.init(options);
    // if this is changed, check if the factory needs to be changed as well!
    if(typeof(id) !== 'undefined' && typeof(cb) === 'function') {
      this.load(id, cb);
    }
  };
  obj.prototype = new Nohm();
  
  obj.prototype.modelName = name;

  obj.prototype.idGenerator = options.idGenerator || 'default';
  
  var meta = {
    inDb: false
  };
  meta.properties = options.properties;
  meta.version = _meta_version(meta.properties, obj);
  
  obj.prototype.meta = meta;
  
  // this creates a few functions for short-form like: SomeModel.load(1, function (err, props) { /* `this` is someModelInstance here */ });
  var shortFormFuncs = ['load', 'find', 'findAndLoad', 'save', 'sort', 'subscribe', 'subscribeOnce', 'unsubscribe'];
  shortFormFuncs.forEach(function (val) {
    obj[val] = function () {
      var instance = new obj();
      instance[val].apply(instance, Array.prototype.slice.call(arguments, 0));
      return instance;
    };
  });

  // special short form for removal because we first need to set the id on the instance
  obj.remove = function (id, cb) {
    var instance = new obj();
    instance.id = id;
    instance.remove(cb);
  };

  if ( ! temp) {
    models[name] = obj;
  }

  return obj;
};

var _meta_version = function (properties, obj) {
  var hash = crypto.createHash('sha1');
  
  hash.update(JSON.stringify(properties));
  hash.update(JSON.stringify(obj.prototype.modelName));
  hash.update(obj.prototype.idGenerator.toString());
  
  return hash.digest('hex');
};

/**
 * Factory to produce instances of models
 * 
 * @param {String} name Name of the model (as given to Nohm.model())
 * @param {Number} [id] Id to be loaded. This requires the callback.
 * @param {Function} [callback] Called when the user is loaded from the db.
 * @returns {ModelInstance} Returns the new model instance
 * @static
 */
Nohm.factory = function factory(name, id, callback) {
  if ( ! models.hasOwnProperty(name)) {
    Nohm.logError('Trying to instantiate inexistant model: '+name);
    return false;
  }
  var obj = new models[name]();
  if(typeof(id) !== 'undefined' && typeof(callback) === 'function') {
    obj.id = id;
    obj.load(id, callback);
  }
  return obj;
};

/**
 * Gets all registered models.
 * 
 * @returns {Object} Object containing all registered models
 * @static
 */
Nohm.getModels = function getModels() {
  return models;
};

/**
 * This function is used whenever an error occurs in nohm.
 * You can override this to whatever you want.
 * By default it only does a console.dir(errorObject);
 * @static
 */
Nohm.logError = function logError(err) {
  if (err) {
    console.dir({
      name: "Nohm Error",
      message: err
    });
  }
};

/**
 * Set the Nohm global redis client.
 * Note: this will not affect models that have a client set on their own.
 * @static
 */
Nohm.setPrefix = function (prefix) {
  Nohm.prefix = h.getPrefix(prefix);
};

/**
 * Set the Nohm global redis client.
 * Note: this will not affect models that have a client set on their own.
 * @static
 */
Nohm.setClient = function (client) {
  Nohm.client = client;
  if ( ! client.connected) {
    Nohm.logError('Warning: setClient() received a redis client that is not connected yet. Consider waiting for an established connection before setting it.');
  }
};


Nohm.__validators = {};
var __extraValidators = [];
/**
 * Set some extra validator files. These will also be exported to the browser via connect middleware if used.
 * @static
 */
Nohm.setExtraValidations = function (files) {
  if ( ! Array.isArray(files)) {
    files = [files];
  }
  files.forEach(function (path) {
    if (__extraValidators.indexOf(path) === -1) {
      __extraValidators.push(path);
      var validators = require(path);
      Object.keys(validators).forEach(function (name) {
        Nohm.__validators[name] = validators[name];
      });
    }
  });
};

Nohm.getExtraValidatorFileNames = function () {
  return __extraValidators;
};

// prototype methods:

/**
 * Returns the key needed to retreive a hash (properties) of an instance.
 * @param {Number} id Id of the model instance.
 */
Nohm.prototype.getHashKey = function (id) {
  return Nohm.prefix.hash + this.modelName + ':' + id;
};

/**
 * Returns the client of either the model (if set) or the global Nohm object.
 */
Nohm.prototype.getClient = function () {
  var client = this.client || Nohm.client;
  if ( ! client.connected) {
    Nohm.logError('Warning: Tried accessing a redis client that is not connected to a database. The redis client should buffer the commands and send them once connected. But if it can\'t connect they are lost.');
  }
  return client;
};

var addMethods = function (methods) {
  for (var name in methods) {
    if (methods.hasOwnProperty(name) && typeof(methods[name]) === 'function') {
      if (this[name]) {
        this['_super_'+name] = this[name];
      }
      this[name] = methods[name].bind(this);
    }
  }
};

Nohm.prototype.init = function (options) {
  if (typeof(options.client) === 'undefined' && Nohm.client === null) {
    Nohm.logError('Did not find a viable redis client in Nohm or the model: '+this.modelName);
    return false;
  }
  
  if ( ! this.meta.inDb) {
    __updateMeta.call(this, options.metaCallback);
  }

  if (typeof(options.client) !== 'undefined') {
    this.client = options.client;
  }

  this.properties = {};
  this.errors = {};

  // initialize the properties
  if (options.hasOwnProperty('properties')) {
    
    for (var p in options.properties) {
      if (options.properties.hasOwnProperty(p)) {
        this.properties[p] = h.$extend(true, {}, options.properties[p]); // deep copy
        var defaultValue = options.properties[p].defaultValue || 0;
        if (typeof(defaultValue) === 'function') {
          defaultValue = defaultValue();
        }
        if (typeof(options.properties[p].type) === 'function') {
          // behaviours should not be called on initialization
          this.properties[p].value = defaultValue;
        } else {
          this.property(p, defaultValue); // this ensures typecasing
        }
        this.__resetProp(p);
        this.errors[p] = [];
      }
    }
  }
  
  if (options.hasOwnProperty('methods')) {
    addMethods.call(this, options.methods);
  }

  if (options.hasOwnProperty('publish')) {
    this.publish = options.publish;
  }

  this.relationChanges = [];

  this.id = null;
  this.__inDB = false;
  this.__loaded = false;
};



var __updateMeta = function (callback) {
  if ( ! Nohm.meta) {
    return false;
  }
  
  if (typeof(callback) !== 'function') {
    callback = function () {};
  }
  
  var self = this;
  
  var version_key = Nohm.prefix.meta.version + this.modelName;
  var idGenerator_key = Nohm.prefix.meta.idGenerator + this.modelName;
  var properties_key = Nohm.prefix.meta.properties + this.modelName;
  var properties = traverse(self.meta.properties).map(function (x) { 
    if (typeof x === 'function') {
      return String(x);
    } else {
      return x;
    }
  });
  
  this.getClient().get(version_key, function (err, db_version) {
    if (err) {
      Nohm.logError(err);
      callback(err);
    } else if (self.meta.version !== db_version) {
      async.parallel({
        version: function (next) {
          self.getClient().set(version_key, self.meta.version, next);
        },
        idGenerator: function (next) {
          self.getClient().set(idGenerator_key, self.idGenerator.toString(), next);
        },
        properties: function (next) {
          self.getClient().set(properties_key, JSON.stringify(properties), next);
        }
      }, function (err) {
        if (err) {
          Nohm.logError(err);
          callback(err, self.meta.version);
        } else {
          self.meta.inDb = true;
          callback(null, self.meta.version);
        }
      });
    } else {
      self.meta.inDb = true;
      callback(null, self.meta.version);
    }
  });
};

/**
 * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
 * 
 * Deletes any keys from the db that start with nohm prefixes.
 * 
 * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
 * 
 * @param {Object} [redis] You can specify the redis client to use. Default: Nohm.client
 * @param {Function} [callback] Called after all keys are deleted.
 */
Nohm.purgeDb = function (redis, callback) {
  callback = h.getCallback(arguments);
  redis = typeof(redis) !== 'function' || Nohm.client;
  var delKeys = function (prefix, next) {
    redis.keys(prefix+'*', function (err, keys) {
      if (err || keys.length === 0) {
        next(err);
      } else {
        keys.push(next);
        redis.del.apply(redis, keys);
      }
    });
  };
  var deletes = [];
  
  Object.keys(Nohm.prefix).forEach(function (key) {
    deletes.push(async.apply(delKeys, Nohm.prefix[key]));
  });
  
  async.series(deletes, function (err) {
    callback(err);
  });
};

var moduleNames = ['properties', 'retrieve', 'validation', 'store', 'relations', 'connectMiddleware', 'pubsub'],
    modules = {};

moduleNames.forEach(function (name) {
  // first integrate all the modules
  modules[name] = require(__dirname+'/'+name);
  h.prototypeModule(Nohm, modules[name]);
});
moduleNames.forEach(function (name) {
  // then give them the complete Nohm.
  if (typeof(modules[name].setNohm) !== 'undefined')
    modules[name].setNohm(Nohm);
});

exports.Nohm = Nohm;
