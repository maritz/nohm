var h = require(__dirname + '/helpers');
var async = require('async');

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
 * Defaults to false, since it's a little faster.
 * @static
 */
Nohm.meta = false; // check if this should be defaulted to true.
Nohm.meta_saved_models = [];

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
Nohm.model = function (name, options) {
  var obj = function (id, cb) {
    this.init(name, options);
    // if this is changed, check if the factory needs to be changed as well!
    if(typeof(id) !== 'undefined' && typeof(cb) === 'function') {
      this.load(id, cb);
    }
  };
  obj.prototype = new Nohm();

  // this creates a few functions for short-form like: SomeModel.load(1, function (err, props) { /* `this` is someModelInstance here */ });
  var shortFormFuncs = ['load', 'find', 'save', 'sort', 'subscribe', 'subscribeOnce', 'unsubscribe'];
  shortFormFuncs.forEach(function (val) {
    obj[val] = function () {
      var instance = new obj();
      instance[val].apply(instance, Array.prototype.slice.call(arguments, 0));
    };
  });

  // special short form for removal because we first need to set the id on the instance
  obj.remove = function (id, cb) {
    var instance = new obj();
    instance.id = id;
    instance.remove(cb);
  };

  models[name] = obj;

  return obj;
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
  return this.client || Nohm.client;
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

Nohm.prototype.init = function (name, options) {
  if ( ! name )
    this.logError('When creating a new model you have to provide a name!');

  if (typeof(options.client) === 'undefined' && Nohm.client === null)
    return Nohm.logError('Did not find a viable redis client in Nohm or the model: '+name) && false;

  if (typeof(options.client) !== 'undefined') {
    this.client = options.client;
  }

  this.modelName = name;
  this.idGenerator = options.idGenerator || 'default';

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

        if ( Nohm.meta && ! Nohm.meta_saved_models.hasOwnProperty(this.modelName)) {
          // try saving the meta data of this model
          var metaargs = [Nohm.prefix.meta + this.modelName, p, JSON.stringify(this.properties[p])];
          this.getClient().hmset(metaargs);
        }
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

