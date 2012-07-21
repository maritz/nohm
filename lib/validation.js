var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  Nohm.__validators = validators;
};

var async = require('async');
var util = require('util');
var h = require(__dirname + '/helpers');
var validators = require(__dirname + '/validators').validators;

/**
 *  Check if one or all propert(y/ies) are valid.
 * @see Validators
 */
exports.valid = function valid(key, setDirectly) {
  var p;
  var self = this;
  var noKeySpecified = !key || typeof(key) === 'function';
  var callback = h.getCallback(arguments);
  var parallel =  [];
  key = typeof(key) === 'string' ? key : false;
  setDirectly = typeof(setDirectly) === 'boolean' ? setDirectly : false;
  
  for (p in this.properties) {
    if (noKeySpecified || key === p) {
      parallel = parallel.concat(this.__validateProperty(p));
    }
  }
  async.parallel(parallel, function (error, results) {
    var validbool = results.indexOf(false) === -1;
    if (error) {
      Nohm.logError('Some validation caused an error');
    }
    
    if ( ! validbool) {
      // if others failed we must not set unique locks directly
      setDirectly = false;
    }
    
    self.__checkUniques(setDirectly, function (success) {
  
      if ( ! success) {
        validbool = false;
      }
      callback(validbool);
    }, key);
  });
};

/**
 *  Check whether all properties marked as unique have a value that is not set in the database yet.
 *  If setDirectly is set, it will occupy the unique in the db directly.
 *  Use setDirectly if you're saving the object to prevent race-conditions.
 */
exports.__checkUniques = function __checkUniques(setDirectly, saveCallback, p) {
  setDirectly = setDirectly || false;
  var tmp = this.properties,
  self = this,
  tmpUniques = [],
  success = true,
  client = self.getClient(),
  uniqueLocker = function uniqueLocker(propName, callback) {
    if (tmp[propName].unique && // is marked as unique
      (!p || propName === p) && // if all props are to be checked or the current one matches the 1
      tmp[propName].value !== '' &&
      (tmp[propName].__updated || !self.__inDB)) {
      var propLower = tmp[propName].type === 'string' ? self.p(propName).toLowerCase() : self.p(propName);
      var unique_key = Nohm.prefix.unique + self.modelName + ':' + propName + ':' + propLower;
      var checkCallback = function (err, value) {
        if (setDirectly && value) {
          tmpUniques.push(unique_key);
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
        client.setnx(unique_key, self.id, checkCallback);
      } else {
        client.exists(unique_key, checkCallback);
      }
    } else {
      callback(null, null);
    }
  };
  if (setDirectly && !self.id) {
    Nohm.logError('Checking AND setting uniques without having an id set. self:' + require('util').inspect(self));
  }
  
  async.map(Object.keys(tmp), uniqueLocker, function (err, arr) {
    if (err) {
      Nohm.logError('Database error while checking uniques.', err);
    }
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
  args = [];
  for (p in this.properties) {
    if (this.properties.hasOwnProperty(p) && this.properties[p].unique &&
      this.properties[p].value !== '' &&
      (this.properties[p].__updated || !this.__inDB)) {
        var val = this.properties[p].type === 'string' ? this.p(p).toLowerCase() : this.p(p);
        args.push(Nohm.prefix.unique + this.modelName + ':' + p + ':' + val);
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
 * Returns an array of functions that validate a given property.
 * 
 * Important: Any changes here should proably be done in validators.js for the browser validation functions as well!
 */
exports.__validateProperty = function __validateProperty(p) {
  if (!p || !this.properties[p]) {
    nohm.logError('Trying to validate undefined property or accessing __validateProperty without giving a property');
  }
  if (!this.properties[p].validations) {
    return [];
  }
  var self = this;
  this.errors[p] = [];
  var value = this.properties[p].value;
  var validations = this.properties[p].validations;
  var options = {
    old: this.properties[p].__oldValue,
    optional: false,
    trim: true
  };
  var wrap = function (func, options, name) {
    return function (cb) {
      if (options.optional && !value) {
        return cb(null, true);
      }
      var called = false;
      var res = func(value, options, function (result) {
        if (!result) {
          self.errors[p].push(name);
        }
        if (!called) {
          cb(null, !!result);
        }
      });
      if (typeof(res) !== 'undefined') {
        Nohm.logError('Deprecated: Synchronous validation: '+name);
        called = true;
        cb(null, res);
      }
    };
  };
  
  return validations.map(function (i) {
    if (typeof i === 'function') {
      // simple function
      var funcName = i.toString().match(/^function ([\w]*)[\s]?\(/);
      var errorName = 'custom_'+ (funcName[1] ? funcName[1] : p);
      
      return wrap(i, options, errorName);
    } else if (typeof i === 'string') {
      // simple string
      if (!Nohm.__validators[i]) {
        Nohm.logError('Trying to access unavailable validator.');
      }
      return wrap(Nohm.__validators[i], options, i);
    } else if (i instanceof Array && i.length > 0) {
      /* 
      array containing string and options: 
      [ 'someValidtaor', {
          someOption: false
        }
      ]
      */
      if (!Nohm.__validators[i[0]]) {
        Nohm.logError('Trying to access unavailable validator.');
      }
      var localOptions = h.$extend(true, {}, options, i[1]);
      return wrap(Nohm.__validators[i[0]], localOptions, i[0]);
    } else {
      Nohm.logError('Invalid validation definition for property "'+p+'": '+util.inspect(i));
    }
  });
};
