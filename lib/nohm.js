var sys = require('sys')
, Class = require('class').Class
, redis = require('redis-client').createClient();

/**
 * Model Class ;)
 * 
 * Note: properties/methods starting with __ are for internal use and should not be called from the outside. Crockford says this is bad (and it somewhat really is), but I don't care right now. Maybe change it sometime. :P
 **/
var Model = new Class({
  properties: {},
  
  modelName: 'Model', // used in thrown exceptions only
  
  __inDB: false, // whether the model instance has been saved to db yet.
  
  constructor: function () {
    var tmp; // micro-optimizing ftw :/
    this.p = this.prop = this.property; // create short calls
    
    // initialize the properties
    for (var p in this.properties) {
      tmp = this.properties[p];
      if (!tmp.value)
        tmp.value = null;
      tmp.__updated = false;
      tmp.__oldValue = tmp.value;
      this.properties[p] = tmp;
    }
  },
  
  save: function (callback) {
    if (this.__isEmpty() && !this.__inDB)
      return 0;
    else if (this.__inDB) // empty but already proven to be in the db
      this.__delete(callback); // hmm... really? i don't know... maybe just explicit deletes would be the better way
    
    if (!this.__inDB) {
      this.__create(callback);
    } else {
      this.__update(callback);
    }
  },
  
  __create: function (callback) {
    sys.debug('creating the shit out of this!' + sys.inspect(this.properties));
    if (typeof callback === 'function')
      callback(err, id); 
  },
  
  __update: function (callback) {
    sys.debug('just an update. move along!' + sys.inspect(this.properties));
    if (typeof callback === 'function')
      callback(err, id);
  },
  
  __delete: function (callback) {
    sys.debug('woot? why would you delete me?' + sys.inspect(this.properties));
    if (typeof callback === 'function')
      callback(err, id);
  },
  
  property: function (key, val, validate) {
    var validation, tmp;
    
    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' + key + '" of object "' + this.modelName + '".'; // TODO: mybe implement a custom exception object that has stuff like loggers and such
    }
    tmp = this.properties[key];
    if (typeof val === 'undefined') {
      return tmp.value;
    } else if (val !== tmp.value) {
      if (validate && val !== tmp.__oldValue) { // if it's the same as the original (either from db or scratch) it is assumed to be valid by default! TODO: if performance isn't an issue at all, remove this
        validation = this.__validateProperty(key, val);
        if (!validation.result) {
          return validation;
        }
      }
      // TODO: check whether the type is compatible first and do some basic type casting if not. mybe do some acceptJson behaviour for the properties
      tmp.value = val;
      if (val === tmp.__oldValue) {
        tmp.__updated = false;
      } else {
        tmp.__updated = true;
      }
    }
    return true;
  },

  propertyDiff: function (key) {
    var diff = [];
    if (key && !this.properties[key]) {
      throw 'Invalid key specified for diffProperty';
    }

    for (var p in this.properties) {
      if (!key || p === key) {
        if (this.properties[p].__updated) {
          diff.push( {
            key: p,
            before: this.properties[p].__oldValue,
            after: this.properties[p].value
          });
        }
      }
    }
    return diff;
  },

  propertyReset: function (key) {
    if (key && !this.properties[key]) {
      throw 'Invalid key specified for diffProperty';
    }

    for (var p in this.properties) {
      if (!key || p === key) {
        this.properties[p].__updated = false;
        this.properties[p].value = this.properties[p].__oldValue;
      }
    }
    return true;
  }

});

exports.Model = Model;
