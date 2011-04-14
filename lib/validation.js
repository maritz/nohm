var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');

/**
 *  Check if one or all propert(y/ies) are valid.
 * @see Validators
 */
exports.valid = function valid(key, setDirectly) {
  var validbool = true,
  p,
  self = this,
  noKeySpecified = !key || typeof(key) === 'function',
  callback = h.getCallback(arguments);
  for (p in this.properties) {
    if (noKeySpecified || key === p) {
      if (!this.__validateProperty(p)) {
        validbool = false;
      }
    }
  }
  if (typeof callback === 'function') {
    // if the object isn't valid to begin with, we don't set the uniques and just check them
    setDirectly = validbool ? !!setDirectly : false;
    
    // if there is no valid callback, there is no good reason to call an async function.
    // TODO: determine whether this is true. if setDirectly is true then calling it
    // without a callback could have some use. (like blocking uniques :/)
    this.__checkUniques(setDirectly, function (success) {

      if (!key && !success) {
        validbool = false;
      } else if (key && !success) {
        validbool = !!self.errors[key];
      }
      callback(validbool);
    });
  }
  return validbool;
};

/**
 *  Check whether all properties marked as unique have a value that is not set in the database yet.
 *  If setDirectly is set, it will occupy the unique in the db directly.
 *  Use setDirectly if you're saving the object to prevent race-conditions.
 */
exports.__checkUniques = function __checkUniques(setDirectly, saveCallback) {
  /*
   * This is a bit of a fuckup...
   * This code essentially creates an object with functions (client checks) that will run in parrallel and when all those are done a final check of the client returns is done.
   */
  setDirectly = setDirectly || false;
  var functions = {},
  tmp = this.properties,
  self = this,
  i = 0,
  finalArgs = [],
  initArgs = [],
  tmpUniques = [],
  success = true,
  p, doit,
  client = self.getClient(),
  uniqueLocker = function uniqueLocker(propName, callback) {
    if (tmp[propName].unique === true && tmp[propName].value !== '' && (tmp[propName].__updated || self.id === null)) {
      var checkCallback = function (err, value) {
        if (setDirectly && value) {
          tmpUniques.push(Nohm.prefix.unique + self.modelName + ':' + propName + ':' + self.p(propName));
        }
        if (!setDirectly) {
          // client.exists returns 1 if the value exists, client.setnx returns 1 if the value did not exist.
          // what we pass to the callback is whether the property has a unique value or if it already exists.
          // that means if we used exists we have to use the opposite of the returned value.
          value = !value;
        }
        callback(err, {
          p: propName,
          unique: value
        });
      };
      
      if (setDirectly) {
        /*
         * We lock the unique value here if it's not locked yet, then later remove the old uniquelock when really saving it. (or we free the unique slot if we're not saving)
         */
        client.setnx(Nohm.prefix.unique + self.modelName + ':' + propName + ':' + self.p(propName), self.id, checkCallback);
      } else {
        client.exists(Nohm.prefix.unique + self.modelName + ':' + propName + ':' + self.p(propName), checkCallback);
      }
    } else {
      callback(null, null);
    }
  };
  if (setDirectly && !self.id) {
    Nohm.logError('Checking AND setting uniques without having an id set. self:' + require('util').inspect(self));
  }
  
  async.map(Object.keys(tmp), uniqueLocker, function (err, arr) {
    if (Array.isArray(arr) && arr.length > 0) {
      arr.forEach(function(val) {
        if (val && ! val.unique) {
          self.errors[val.p].push('notUnique');
          success = false;
        }
      });
    }
    
    if (setDirectly && ! success) {
      if (Array.isArray(tmpUniques) && tmpUniques.length > 0) {
        tmpUniques.forEach(function(val) {
          // delete tmp unique locks since the new values won't be saved.
          client.del(val, self.logError);
        });
      }
    }
    saveCallback(success);
  });
};

/**
 *  Set the real id of the unique values.
 */
exports.__setUniqueIds = function __setUniqueIds(id, cb) {
  var p,
  self = this,
  args = [];
  for (p in this.properties) {
    if (this.properties.hasOwnProperty(p) && this.properties[p].unique) {
      args.push(Nohm.prefix.unique + this.modelName + ':' + p + ':' + this.p(p));
      args.push(id);
    }
  }
  if (args.length > 0) {
    this.getClient().mset(args, cb);
  } else {
    cb();
  }
};

/**
 *  Validates a given property.
 */
exports.__validateProperty = function __validateProperty(p) {
  if (!p || !this.properties[p]) {
    throw 'Trying to validate undefined property or accessing __validateProperty without giving a property';
  }
  if (!this.properties[p].validations) {
    return true;
  }
  var value = this.properties[p].value,
  validations = this.properties[p].validations,
  self = this;
  this.errors[p] = [];
  
  return validations.every(function (i) {
    var valid,
    errorName = '';
    if (typeof i === 'function') {
      var funcName = i.toString().match(/^function ([\w]*)[\s]?\(/);
      valid = i(value);
      errorName = 'custom_'+ (funcName[1] ? funcName[1] : p);
    } else if (typeof i === 'string') {
      if (!validators[i]) {
        throw 'Trying to access unavailable validator.';
      }
      valid = validators[i](value, []);
      errorName = i;
    } else if (i instanceof Array) {
      if (typeof i[0] === 'function') {
        valid =  i[0](value, i.slice(1) || []);
      }
      if (!validators[i[0]]) {
        throw 'Trying to access unavailable validator.';
      }
      valid = validators[i[0]](value, i.slice(1));
      errorName = i[0];
    }
    if (!valid) {
      self.errors[p].push(errorName);
    }
    return !!valid;
  });
};

var urlRegexp = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
emailRegexp = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i;

/**
 * @namespace Validators
 */
var validators = {
  // most of these are copied from the jquery validation plugin http://code.google.com/p/bassistance-plugins/source/browse/trunk/plugins/validate/jquery.validate.js

  /**
   * Make sure a value is not empty.
   */
  notEmpty: function notEmpty(value) {
    return (value && value !== true);
  },

  /**
   * Make sure a value is of at least a given length (params[0]) or is optional (params[1]) and empty
   */
  minLength: function minLength(value, params) {
    return (params[1] && !value) || ('' + value).trim().length >= params[0];
  },

  /**
   * Make sure a value is of at most a given length (params[0])
   */
  maxLength: function maxLength(value, params) {
    return ('' + value).trim().length <= params[0];
  },

  /**
   * Make sure a value is of at least a given value (params[0])  (pun intended :P ) or is optional (params[1]) and zero
   */
  min: function min(value, params) {
    return (params[1] && value === 0) || (+value) >= params[0];
  },

  /**
   * Make sure a value is of at most a given value (params[0])
   */
  max: function max(value, params) {
    return (+value) <= params[0];
  },

  /**
   * Make sure a value is a valid email adress or empty if it's optional (params[0])
   */
  email: function email(value, params) {
    return (!value && params[0]) || emailRegexp.test(value);
  },

  /**
   * Make sure a value is a valid url or empty if it's optional (params[0])
   */
  url: function url(value, params) {
    // the fuck is this? (the regex that is now at the start of this file :P )
    // well, it's copied from jqueries validation plugin and i blindly trust them.
    return (!value && params[0]) || urlRegexp.test(value);
  },

  /**
   * Make sure a value is a date that the Date object can feed on or is optional (params[0]) and empty
   */
  date: function date(value, params) {
    return (params[0] && !value) || !/Invalid|NaN/.test(new Date(value));
  },

  /**
   * Make sure a value is a valid ISO Date (YYYY-MM-DD) or is optional (params[0]) and empty
   */
  dateISO: function dateISO(value, params) {
    return (params[0] && !value) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(value);
  },

  /**
   * Make sure a value is a valid US number (thousands seperator comma, decimal seperator point) string or is optional (params[0]) and empty
   */
  numberUS: function numberUS(value, params) {
    return (params[0] && !value) || /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value);
  },

  /**
   * Make sure a value is a valid EU number (thousands seperator point, decimal seperator comma) string or is optional (params[0]) and empty
   */
  numberEU: function numberEU(value, params) {
    return (params[0] && !value) || /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:\,\d+)?$/.test(value);
  },

  /**
   * Make sure a value is a valid SI number (thousands seperator space, decimal seperator point or comma) string or is optional (params[0]) and empty
   */
  numberSI: function numberSI(value, params) {
    return (params[0] && !value) || /^-?(?:\d+|\d{1,3}(?: \d{3})+)(?:[\,\.]\d+)?$/.test(value);
  },

  /**
   * Make sure a value is a valid (SI, US or EU) number string or is optional (params[0]) and empty
   */
  number: function number(value, params) {
    return (params[0] && !value) || this.numberSI(value, []) || this.numberUS(value, []) || this.numberEU(value, []); // could add asian number formats. anyone? :D
  },

  /**
   * Please don't use this. Cast your property to an integer.
   *
   * The only valid use of this is a string of so many digits that an int can't hold it anymore. Why would you want to do that?
   */
  digits: function digits(value, params) {
    return (params[0] && !value) || /^\d+$/.test(value);
  }
}