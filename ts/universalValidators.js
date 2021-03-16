// eslint-disable-next-line no-shadow-restricted-names
((exports, undefined) => {

  const regexps = exports.regexps = {
    email: /^.+@.+\..+/i,
    // eslint-disable-next-line
    url: /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
  };


  /**
   * @namespace Validators
   */
  const validators = exports.validators = {
    // most of these are copied from the jquery validation plugin
    // http://code.google.com/p/bassistance-plugins/source/browse/trunk/plugins/validate/jquery.validate.js

    /**
     * Test if the value is alphanumeric or optional (params[0]) and empty
     * @memberof Validators
     */
    alphanumeric: function alphanumeric(value) {
      return Promise.resolve(/^[\w]+$/.test(value));
    },

    /**
     * Make sure a value is a date that the Date object can parse.
     * Can be optional.
     * @memberof Validators
     */
    date: function date(value) {
      return Promise.resolve(!/Invalid|NaN/.test((new Date(value)).toString()));
    },

    /**
     * Make sure a value is a valid ISO Date (YYYY-MM-DD) or is optional (params[0]) and empty
     * @memberof Validators
     */
    dateISO: function dateISO(value) {
      return Promise.resolve(/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(value));
    },

    /**
     * Makes sure a string consists of only numeric digits.
     * @memberof Validators
     */
    digits: function digits(value) {
      return Promise.resolve(/^\d+$/.test(value));
    },

    /**
     * Make sure a value is a valid email adress.
     * @memberof Validators
     */
    email: function email(value) {
      return Promise.resolve(regexps.email.test(value));
    },

    /**
     * String length must be between options.min (default 0) and options.max (default positive infinity).
     * @memberof Validators
     */
    length: function length(value, options) {
      if (options.trim) {
        ('' + value).trim();
      }

      const min = value.length >= (options.min || 0);
      const max = value.length <= (options.max || Number.POSITIVE_INFINITY);
      return Promise.resolve(min && max);
    },

    /**
     * Make sure a number value is between (inclusive) options.min (default: 0)
     * and options.max (default: POSITIVE_INFINITY)
     * @memberof Validators
     */
    minMax: function minMax(value, options) {
      value = +value;

      const min = value >= (options.min || 0);
      const max = value <= (options.max || Number.POSITIVE_INFINITY);
      return Promise.resolve(min && max);
    },

    /**
     * Make sure a value is not empty. Any falsy value is considered empty (including 0).
     * use minMax for number types instead!
     * @memberof Validators
     */
    notEmpty: function notEmpty(value, options) {
      if (typeof (value) === 'string' && options.trim) {
        value = value.trim();
      }
      return Promise.resolve(!!value);
    },

    /**
     * Make sure a value is a valid (SI, US or EU) number string or is optional (params[0]) and empty
     * @memberof Validators
     */
    number: function number(value) {
      return Promise.resolve(/^-?(?:\d+|\d{1,3}(?:[ ,.]\d{3})+)(?:[,.]\d+)?$/.test(value));
    },

    /**
     * Make sure a value is a valid EU number (thousands seperator point, decimal seperator comma)
     * string or is optional (params[0]) and empty
     * @memberof Validators
     */
    numberEU: function numberEU(value) {
      return Promise.resolve(/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(value));
    },

    /**
     * Make sure a value is a valid SI number (thousands seperator space, decimal seperator point or comma)
     * string or is optional (params[0]) and empty
     * @memberof Validators
     */
    numberSI: function numberSI(value) {
      return Promise.resolve(/^-?(?:\d+|\d{1,3}(?: \d{3})+)(?:[,.]\d+)?$/.test(value));
    },

    /**
     * Make sure a value is a valid US number (thousands seperator comma, decimal seperator point)
     * string or is optional (params[0]) and empty
     * @memberof Validators
     */
    numberUS: function numberUS(value) {
      return Promise.resolve(/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value));
    },

    /**
     * Test if the value matches the provided regexp or optional (params[0]) and empty
     * @memberof Validators
     */
    regexp: function regexp(value, options) {
      if (options.regex instanceof RegExp) {
        return Promise.resolve(options.regex.test(value));
      } else {
        return Promise.reject(new Error('Option for regexp validation was not a RegExp object.'));
      }
    },

    /**
     * Make sure a value is a valid url.
     * @memberof Validators
     */
    url: function url(value) {
      return Promise.resolve(regexps.url.test(value));
    },
  };

  // while there are tests for the browser validations, they depend on vm.runInNewContext.
  // this creates a sandboxed environment that currently cannot be properly analysed for coverage.
  // see ../test/middlewareTests.js for the tests
  // see https://github.com/istanbuljs/nyc/issues/371 for details on
  /* istanbul ignore if */
  if (typeof (window) !== 'undefined' && typeof (nohmValidationsNamespaceName) !== 'undefined') {
    // we're in a browser and have a defined namespace
    // eslint-disable-next-line
    const nohm = window[nohmValidationsNamespaceName];

    // get extra validators
    for (var i in nohm.extraValidations) {
      if (Object.prototype.hasOwnProperty.call(nohm.extraValidations, i)) {
        for (var name in nohm.extraValidations[i]) {
          if (Object.prototype.hasOwnProperty.call(nohm.extraValidations[i], name)) {
            validators[name] = nohm.extraValidations[i][name];
          }
        }
      }
    }


    var validateProperty = (key, value, validations, cb) => {
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
          try {
            func(value, options).then((result) => {
              cb(key, result, name);
            });
          } catch (e) {
            cb(key, false, name);
          }
        });
      };

      for (var i = 0, len = validations.length; i < len; i++) {
        var val = validations[i];

        if (typeof val === 'string') {
          // simple string
          if (!validators[val]) {
            throw new Error('Trying to access unavailable validator.');
          }
          wrap(validators[val], options, val);
        } else if (val && typeof (val.name) === 'string') {
          /*
          Validation object
          {
            name: 'someValidtaor',
            options: {
              someOption: false
            }
          }
          */
          if (!validators[val.name]) {
            throw new Error('Trying to access unavailable validator.');
          }
          var localOptions = $extend(true, {}, options, val.options);
          wrap(validators[val.name], localOptions, val.name);
        } else {
          throw new Error('Invalid validation definition for property "' + key + '":' + val);
        }
      }

      return funcs;

    };

    nohm.nohmValidations = validators;
    nohm.validate = function (modelName, data) {
      if (arguments.length > 0) {
        const lastArgument = arguments[arguments.length - 1];
        if (typeof lastArgument === 'function') {
          throw new Error('Callback style has been removed. Use the returned promise.');
        }
      }

      return new Promise((resolve, reject) => {

        if (typeof (modelName) === 'undefined' || typeof (data) === 'undefined') {
          return reject(new Error('Invalid input passed to nohm validate() function. Needs a modelname and a data object.'));
        }

        if (!Object.prototype.hasOwnProperty.call(nohm.models, modelName)) {
          return reject(new Error('Invalid modelName passed to nohm or model was not properly exported.'));
        }


        var model = nohm.models[modelName];
        var errors = {};
        var failed = false;
        var dispatched = 0;
        var doneCount = 0;
        var funcs = [];
        var done = function () {
          done = function () { }; // just to be sure :D
          resolve({
            result: !failed,
            errors
          });
        };
        var validCallback = function (key, valid, errorName) {
          if (!valid) {
            failed = true;
            if (!Object.prototype.hasOwnProperty.call(errors, key)) {
              errors[key] = [];
            }
            errors[key].push(errorName);
          }
          if (++doneCount >= dispatched) {
            done();
          }
        };
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key) && Object.prototype.hasOwnProperty.call(model, key)) {
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
        for (var n = 0; n < dispatched; n++) {
          var func = funcs[n];
          if (typeof (func) === 'function') {
            func(); // this makes sure we first know how many funcs we have before we call them, thus not calling done() too early if all validators are instant
          } else {
            return resolve(new Error('There were invalid validators'));
          }
        }
      });
    };


    /**
     * This extends an object with x other objects.
     * @see http://api.jquery.com/jQuery.extend/
     */
    var $extend = function () {
      var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

      // Handle a deep copy situation
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
      }

      // Handle case when target is a string or something (possible in deep copy)
      if (typeof target !== "object" && typeof (target) == 'function') {
        target = {};
      }

      for (; i < length; i++) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) !== null) {
          // Extend the base object
          for (name in options) {
            if (Object.prototype.hasOwnProperty.call(options, name)) {
              src = target[name];
              copy = options[name];

              // Prevent never-ending loop
              if (target === copy) {
                continue;
              }

              // Recurse if we're merging plain objects or arrays
              if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
                if (copyIsArray) {
                  copyIsArray = false;
                  clone = src && Array.isArray(src) ? src : [];

                } else {
                  clone = src && isPlainObject(src) ? src : {};
                }

                // Never move original objects, clone them
                target[name] = $extend(deep, clone, copy);

                // Don't bring in undefined values
              } else if (copy !== undefined) {
                target[name] = copy;
              }
            }
          }
        }
      }

      // Return the modified object
      return target;
    };

    // from jquery as well
    var isPlainObject = function (obj) {

      // Not own constructor property must be Object
      if (obj.constructor &&
        !Object.prototype.hasOwnProperty.call(obj, "constructor") &&
        !Object.prototype.hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf")) {
        return false;
      }

      var key;
      for (key in obj) {
        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.
      }

      return key === undefined || Object.prototype.hasOwnProperty.call(obj, key);
    };
  }

})(typeof (exports) === 'undefined' ? {} : exports);
