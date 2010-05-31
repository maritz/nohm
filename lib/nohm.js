var sys = require('sys')
, Class = require('class').Class
, redis = require('redis-client').createClient();

/**
 * Model Class ;)
 * 
 * Note: properties/methods starting with __ are for internal use and should not be called from the outside. Crockford says this is bad (and it somewhat really is), but I don't care right now. Maybe change it sometime. :P
 **/

var ModelClass = {
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
      this.errors[p] = [];
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

  remove: function (callback) {
    sys.debug('woot? why would you delete me?' + sys.inspect(this.properties));
    if (typeof callback === 'function')
      callback(err, id);
  },

  property: function (key, val, validate) {
    var tmp, old;

    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' + key + '" of object "' + this.modelName + '".'; // TODO: mybe implement a custom exception object that has stuff like loggers and such
    }
    tmp = this.properties[key];
    if (typeof val === 'undefined') {
      return tmp.value;
    } else if (val !== tmp.value) {
      old = tmp.value;
      tmp.value = this.__cast(key, val);
      if (validate) {
        if (!this.valid(key)) {
          tmp.value = old
          return false;
        }
      }
      if (val === tmp.__oldValue) {
        tmp.__updated = false;
      } else {
        tmp.__updated = true;
      }
    }
    return true;
  },

  __cast: function (key, value) {
    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' + key + '" of object "' + this.modelName + '".'; // TODO: mybe implement a custom exception object that has stuff like loggers and such
    }
    // TODO: implement behaviours after casting
    var type = this.properties[key].type;
    switch (type) {
      case 'string':
        return (!value || value === true || typeof value === 'Object')
        ? ''
        : '' + value;
      case 'integer':
        return (+value);
      default:
        return value;
    }
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
        if (!this.__validateProperty(p)) {
          valid = false;
        }
      }
    }
    return valid;
  },

  __validateProperty: function (p) {
    if (!p || !this.properties[p]) {
      throw 'Trying to validate undefined property or accessing __validateField without giving a property';
    }
    if (!this.properties[p].validations) {
      return true;
    }
    var value = this.properties[p].value,
    validations = this.properties[p].validations,
    errors = this.errors; // fight the scope!
    return validations.every(function (i) {
      var valid,
      errorName = '';
      if (typeof i === 'function') {
        valid = i(value);
        errorName = 'custom';
      } else if (typeof i === 'string') {
        if (!ModelClass.__validations[i]) {
          throw 'Trying to access unavailable validator.';
        }
        valid = ModelClass.__validations[i](value, []);
        errorName = i;
      } else if (i instanceof Array) {
        if (typeof i[0] === 'function') {
          valid =  i[0](value, i.slice(1) || []);
        }
        if (!ModelClass.__validations[i[0]]) {
          throw 'Trying to access unavailable validator.';
        }
        valid = ModelClass.__validations[i[0]](value, i.slice(1));
        errorName = i[0];
      }
      if (!valid) {
        errors[p].push(errorName);
      }
      return !!valid;
    });
  },

  __validations: {
    // most of these are copied from the jquery validation plugin http://code.google.com/p/bassistance-plugins/source/browse/trunk/plugins/validate/jquery.validate.js

    /**
     * Make sure a value is not empty.
     */
    notEmpty: function (value) {
      return (value && value !== true)
    },

    /**
     * Make sure a value is of at least a given length (params[0]) or is optional (params[1]) and empty
     */
    minLength: function(value, params) {
      return (params[1] && !value) || ('' + value).trim().length >= params[0];
    },

    /**
     * Make sure a value is of at most a given length (params[0])
     */
    maxLength: function(value, params) {
      return ('' + value).trim().length <= params[0];
    },

    /**
     * Make sure a value is of at least a given value (params[0])  (pun intended :P ) or is optional (params[1]) and zero
     */
    min: function (value, params) {
      return (params[1] && value === 0) || (+value) >= params[0];
    },

    /**
     * Make sure a value is of at most a given value (params[0])
     */
    max: function (value, params) {
      return (+value) <= params[0];
    },

    /**
     * Make sure a value is a valid email adress or empty if it's optional (params[0])
     */
    email: function (value, params) {
      return (!value && params[0]) || /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i.test(value);
    },

    /**
     * Make sure a value is a valid url or empty if it's optional (params[0])
     */
    url: function (value, params) {
      // the fuck is this?
      // well, it's copied from jqueries validation plugin and i blindly trust them.
      return (!value && params[0]) || /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value)
    },

    /**
     * Make sure a value is a date that the Date object can feed on or is optional (params[0]) and empty
     */
    date: function(value, params) {
      return (params[0] && !value) || !/Invalid|NaN/.test(new Date(value));
    },

    /**
     * Make sure a value is a valid ISO Date (YYYY-MM-DD) or is optional (params[0]) and empty
     */
    dateISO: function(value, params) {
      return (params[0] && !value) || /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(value);
    },

    /**
     * Make sure a value is a valid number string or is optional (params[0]) and empty
     */
    number: function(value, params) {
      return (params[0] && !value) || /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value);
    },

    /**
     * Make sure a value is a valid (german) number string or is optional (params[0]) and empty
     *
     * German number strings have . and , changed... :(
     */
    numberGerman: function(value, params) {
      return (params[0] && !value) || /^-?(?:\d+|\d{1,3}(?:.\d{3})+)(?:\,\d+)?$/.test(value);
    },

    /**
     * Make sure a value is a valid (universal) number string or is optional (params[0]) and empty
     *
     * Checks if it's the normal format, if it's not it checks for the German format.
     */
    numberUniversal: function(value, params) {
      return (params[0] && !value) || this.__validations.number(value) || this.__validations.numbeGerman(value);
    },

    /**
     * Please don't use this. Cast your property to an integer.
     *
     * The only valid use of this is a string of so many digits that an int can't hold it anymore. Why would you want to do that?
     */
    digits: function(value, params) {
      return (params[0] && !value) || /^\d+$/.test(value);
    }
  }
  
};


exports.Model = new Class(ModelClass);
