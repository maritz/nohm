var sys = require('sys')
  , Class = require('class').Class
  , redis = require('redis-client').createClient();

/**
 * Model Class ;)
 * 
 * Note: properties/methods starting with __ are for internal use and should not be called from the outside. Crockford says this is bad (and it somewhat really is), but I don't care right now. Maybe change it sometime. :P
 **/
var Model = new Class({
  properties: {
  },
  
  modelName: 'Model',
  
  __inDB: false, // whether the model instance has been saved to db yet.
  
  constructor: function () {
    this.p = this.prop = this.property;
    
    // initialize the properties
    for (var p in this.properties) {
      if (!this.properties[p].value)
        this.properties[p].value = null;
    }
  },
  
  save: function (callback) {
    if (this.__isEmpty() && !this.__inDB)
      return 0;
    else if (this.__inDB)
      this.__delete(callback); // hmm... really? i don't know... maybe just explicit deletes would be a better idea
    
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
    var validation;
    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' + key + '" of object "' + this.modelName + '".'; 
    }
    if (typeof val === 'undefined') {
      return this.properties[key].value;
    } else { 
      if (validate) {
        validation = this.__validateProperty(key, val);
        if (!validation.result) {
          return validation;
        }
      }
      // TODO: check whether the type is compatible first and do some basic type casting if not. mybe do some acceptJson behaviour for the properties
      this.properties[key].value = val;
      return true;
    }
  }
  
});

exports.Model = Model;
