var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers'),
    validators = require(__dirname + '/validators').validators;

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
    if (tmp[propName].unique && tmp[propName].value !== '' && (tmp[propName].__updated || !self.__inDB)) {
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
