var sys = require('sys')
, Class = require('class').Class
, redis = require('redis-client').createClient();

/**
 * Model Class ;)
 * 
 * Note: properties/methods starting with __ are for internal use and should not be called from the outside. Crockford says this is bad (and it somewhat really is), but I don't care right now. Maybe change it sometime. :P
 **/

var Model = {
  properties: {},

  modelName: 'Model', // used in thrown exceptions only

  __inDB: false, // whether the model instance has been saved to db yet.

  errors: {},

  constructor: function () {
    var tmp; // micro-optimizing ftw :/
    this.p = this.prop = this.property; // create short calls

    // initialize the properties
    for (var p in this.properties) {
      tmp = this.properties[p];
      if (!tmp.value)
        this.property(p, null); // this ensures typecasing/behaviours
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
  },

  allProperties: function (json) {
    var props = {};
    for (var p in this.properties) {
      props[p] = this.properties[p].value;
    }
    return json ? JSON.stringify(props) : props;
  },

  valid: function (key) {
    var valid = true;
    for (p in this.properties) {
      if (!key || key === p) {
        if (!this.__validateField(p))
          valid = false;
      }
    }
    return valid;
  },

  __validateField: function (p) {
    if (!p || !this.properties[p]) {
      throw 'Trying to validate undefined property or accessing __validateField without giving a property';
    }
    if (!this.properties[p].validations) {
      return true;
    }
    var value = this.properties[p].value,
    validations = this.properties[p].validations;
    return validations.every(function (i) {
      if (typeof i === 'function') {
        return i(value);
      } else if (typeof i === 'string') {
        if (!Model.__validations[i]) {
          throw 'Trying to access unavailable validator.';
        }
        return Model.__validations[i](value);
      } else if (typeof i === 'object' && i.rule) {
        if (typeof i.rule === 'function') {
         return  i.rule(value, i.param);
        }
        if (!Model.__validations[i.rule]) {
          throw 'Trying to access unavailable validator.';
        }
	return Model.__validations[i.rule](value, i.param);
      }
    });
  },

  __validations: {

    notempty: function (value) {
      return (value && value !== true)
    },

    email: function (value) {
      // the fuck is this?
      // well, it's copied from jqueries validation plugin
      return /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i.test(value);
    }
  }
  
};

exports.Model = new Class(Model);
