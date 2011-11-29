(function (exports, undefined) {

var regexps = exports.regexps = {
  url: /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
  email: /^.+@.+\..+/i
};

/**
 * @namespace Validators
 */
var validators = exports.validators = {
  // most of these are copied from the jquery validation plugin http://code.google.com/p/bassistance-plugins/source/browse/trunk/plugins/validate/jquery.validate.js

  /**
   * Make sure a value is not empty.
   */
  notEmpty: function notEmpty(value, options, callback) {
    if (typeof(value) === 'string'  && options.trim) {
      value = value.trim();
    }
    callback(!!value);
  },
  
  /**
   * String length must be between options.min (default 0) and options.max (default positive infinity).
   */
  length: function length(value, options, callback) {
    if (options.trim) {
      ('' + value).trim();
    }
    
    var min = value.length >= (options.min || 0);
    var max = value.length <= (options.max || Number.POSITIVE_INFINITY);
    callback(min && max);
  },

  /**
   * Make sure a number value is between (inclusive) options.min (default: 0) and options.max (default: POSITIVE_INFINITY)
   */
  minMax: function minMax(value, options, callback) {
    value = +value;
    
    var min = value >= (options.min || 0);
    var max = value <= (options.max || Number.POSITIVE_INFINITY);
    callback(min && max);
  },

  /**
   * Make sure a value is a valid email adress.
   */
  email: function email(value, options, callback) {
    callback(regexps.email.test(value));
  },

  /**
   * Make sure a value is a valid url.
   */
  url: function url(value, options, callback) {
    callback(regexps.url.test(value));
  },

  /**
   * Make sure a value is a date that the Date object can parse.
   * Can be optional.
   */
  date: function date(value, options, callback) {
    callback(!/Invalid|NaN/.test(new Date(value)));
  },

  /**
   * Make sure a value is a valid ISO Date (YYYY-MM-DD) or is optional (params[0]) and empty
   */
  dateISO: function dateISO(value, options, callback) {
    callback(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(value));
  },

  /**
   * Make sure a value is a valid US number (thousands seperator comma, decimal seperator point) string or is optional (params[0]) and empty
   */
  numberUS: function numberUS(value, options, callback) {
    callback(/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value));
  },

  /**
   * Make sure a value is a valid EU number (thousands seperator point, decimal seperator comma) string or is optional (params[0]) and empty
   */
  numberEU: function numberEU(value, options, callback) {
    callback(/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:\,\d+)?$/.test(value));
  },

  /**
   * Make sure a value is a valid SI number (thousands seperator space, decimal seperator point or comma) string or is optional (params[0]) and empty
   */
  numberSI: function numberSI(value, options, callback) {
    callback(/^-?(?:\d+|\d{1,3}(?: \d{3})+)(?:[\,\.]\d+)?$/.test(value));
  },

  /**
   * Make sure a value is a valid (SI, US or EU) number string or is optional (params[0]) and empty
   */
  number: function number(value, options, callback) {
    callback(/^-?(?:\d+|\d{1,3}(?:[ ,\.]\d{3})+)(?:[\,\.]\d+)?$/.test(value));
  },

  /**
   * Please don't use this. Cast your property to an integer.
   *
   * The only valid use of this is a string of so many digits that an int can't hold it anymore. Why would you want to do that?
   */
  digits: function digits(value, options, callback) {
    callback(/^\d+$/.test(value));
  },

  /**
   * Test if the value is alphanumeric or optional (params[0]) and empty
   */
  alphanumeric: function alphanumeric(value, options, callback) {
    callback(/^[\w]+$/.test(value));
  },

  /**
   * Test if the value matches the provided regexp or optional (params[0]) and empty
   */
  regexp: function regexp(value, options, callback) {
    if (options.regex instanceof RegExp) {
      callback(options.regex.test(value));
    } else {
      callback(new RegExp(options.regex).test(value));
    }
  }
};

if (typeof(window) !== 'undefined' && typeof(nohmValidationsNamespaceName) !== 'undefined') {
  // we're in a browser and have a defined namespace
  var nohm = window[nohmValidationsNamespaceName];
  
  // get extra validators
  for (var i in nohm.extraValidations) {
    for (var name in nohm.extraValidations[i]) {
      if (nohm.extraValidations[i].hasOwnProperty(name)) {
        validators[name] = nohm.extraValidations[i][name];
      }
    }
  }
  
  
  var validateProperty = function (key, value, validations, cb) {
    var options = {
      optional: false,
      trim: true
    };
    
    var funcs = [];
    
    var wrap = function (func, options, name) {
      funcs.push(function () {
        if (options.optional && !value) {
          return cb(key, true);
        }
        func(value, options, function (result) {
          cb(key, result, name);
        });
      });
    };
    
    for (var i = 0, len = validations.length; i < len; i++) {
      var val = validations[i];
      
      if (typeof val === 'string') {
        // simple string
        if ( ! validators[val]) {
          throw new Error('Trying to access unavailable validator.');
        }
        wrap(validators[val], options, val);
      } else if (val instanceof Array && val.length > 0) {
        /* 
        array containing string and options: 
        [ 'someValidtaor', {
            someOption: false
          }
        ]
        */
        if ( ! validators[val[0]]) {
          throw new Error('Trying to access unavailable validator.');
        }
        var localOptions = $extend(true, {}, options, val[1]);
        wrap(validators[val[0]], localOptions, val[0]);
      } else {
        throw new Error('Invalid validation definition for property "'+key+'":'+val);
      }
    }
    
    return funcs;
    
  };
  
  nohm.nohmValidations = validators;
  nohm.validate = function (modelName, data, callback) {
    if (typeof(modelName) === 'undefined' || typeof(data) === 'undefined' || typeof(callback) !== 'function') {
      throw new Error('Invalid input passed to nohm validate() function. Needs a modelname, a data object and a callback.');
    }
    
    if ( ! nohm.models.hasOwnProperty(modelName)) {
      throw new Error('Invalid modelName passed to nohm or model was not properly exported.');
    }
    
    var model = nohm.models[modelName];
    var errors = {};
    var failed = false;
    var dispatched = 0;
    var doneCount = 0;
    var funcs = [];
    var validCallback = function (key, valid, errorName) {
      if ( ! valid) {
        failed = true;
        if ( ! errors.hasOwnProperty(key)) {
          errors[key] = [];
        }
        errors[key].push(errorName);
      }
      if (++doneCount >= dispatched) {
        done();
      }
    };
    var done = function () {
      done = function() {}; // just to be sure :D
      callback(!failed, errors);
    };
    for (var key in data) {
      if (data.hasOwnProperty(key) && model.hasOwnProperty(key)) {
        var innerFuncs = validateProperty(key, data[key], model[key], validCallback);
        for (var len = innerFuncs.length, i = 0; i < len; i++) {
          funcs.push(innerFuncs[i]);
        }
      }
    }
    dispatched = funcs.length;
    if (dispatched === 0) {
      return done();
    }
    for (var i = 0; i < dispatched; i++) {
      if (typeof(funcs[i]) === 'function') {
        funcs[i](); // this makes sure we first know how many funcs we have before we call them, thus not calling done() too early if all validators are instant
      } else {
        throw new Error('There were invalid validators');
      }
    }
  };
  
  
  /**
   * This extends an object with x other objects.
   * @see http://api.jquery.com/jQuery.extend/
   */
  var $extend = function() {
    var options, name, src, copy, copyIsArray, clone,
    target = arguments[0] || {},
    i = 1,
    length = arguments.length,
    deep = false;
    
    // Handle a deep copy situation
    if ( typeof target === "boolean" ) {
      deep = target;
      target = arguments[1] || {};
      // skip the boolean and the target
      i = 2;
    }
    
    // Handle case when target is a string or something (possible in deep copy)
    if ( typeof target !== "object" && typeof(target) == 'function') {
      target = {};
    }
    
    for ( ; i < length; i++ ) {
      // Only deal with non-null/undefined values
      if ( (options = arguments[ i ]) !== null ) {
      // Extend the base object
        for ( name in options ) {
          if (options.hasOwnProperty(name)) { 
            src = target[ name ];
            copy = options[ name ];
    
            // Prevent never-ending loop
            if ( target === copy ) {
              continue;
            }
      
            // Recurse if we're merging plain objects or arrays
            if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = Array.isArray(copy)) ) ) {
              if ( copyIsArray ) {
                copyIsArray = false;
                clone = src && Array.isArray(src) ? src : [];
      
              } else {
                clone = src && isPlainObject(src) ? src : {};
              }
      
              // Never move original objects, clone them
              target[ name ] = Helper.$extend( deep, clone, copy );
      
            // Don't bring in undefined values
            } else if ( copy !== undefined ) {
              target[ name ] = copy;
            }
          }
        }
      }
    }
  
    // Return the modified object
    return target;
  };
  
  // from jquery as well
  var isPlainObject = function( obj ) {

    // Not own constructor property must be Object
    if ( obj.constructor &&
      !obj.hasOwnProperty("constructor") &&
      !obj.constructor.prototype.hasOwnProperty("isPrototypeOf") ) {
      return false;
    }
    
    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    
    var key;
    for ( key in obj ) {}
    
    return key === undefined ||  obj.hasOwnProperty(key);
  };
}

})(typeof(exports) === 'undefined'? {} : exports);
