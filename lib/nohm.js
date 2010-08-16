"use strict";

var sys = require('sys'),
Class = require('class').Class,
redis = require('redis-client').createClient(),
Conduct = require('conductor');

var prefix = 'nohm';

process.argv.forEach(function (val, index) {
  if (val === '--nohm-prefix') {
    prefix = process.argv[index + 1];
  }
});
var urlRegexp = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
emailRegexp = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i,
indexNumberTypes = ['integer', 'float', 'timestamp'],
hashprefix = prefix + ':hash:',
uniqueprefix = prefix + ':uniques:',
scoredindexprefix = prefix + ':scoredindex:',
indexprefix = prefix + ':index:',
relationsprefix = prefix + ':relations:';

/**
 *This function checks if the last item in the given array is a function and returns that or an empty function.
 */
var getCallback = function getCallback(args) {
  if (args.length >= 1 &&
      typeof args[args.length - 1] === 'function') {
    return args[args.length - 1];
  } else {
    return function () {};
  }
};

/**
 * This function checks whether 2 nohm objects are the same.
 */
var checkEqual = function checkEqual(obj1, obj2) {
  if (!obj1 || (obj1 && !obj2)) {
    return false;
  }
  if (obj1 === obj2) {
    return true; // hm... is this ever going to trigger? i don't know
  }
  else if (obj1.hasOwnProperty('modelName') && obj2.hasOwnProperty('modelName') &&
           obj1.modelName === obj2.modelName) {
    // if both have been saved, both must have the same id.
    if (obj1.id && obj2.id && obj1.id === obj2.id) {
      return true;
    }
    else if (obj1.id && obj2.id) { // both have been saved but do not share the same id -> must be different.
      return false;
    }
    
    // if both have exactly the same properties (and at most one has been saved - see above)
    if (obj1.allProperties(true) === obj2.allProperties(true)) {
      return true;
    }
  }
  return false;
};

function randomString(length) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",
  randomstring = '',
  i,
  rnum;
  length = length || 8;
  for (i = 0; i < length; i = i + 1) {
    rnum = Math.floor(Math.random() * chars.length);
    randomstring += chars.substring(rnum, rnum + 1);
  }
  return randomstring;
}


/**
 * Model Class ;)
 *
 * Note: properties/methods starting with __ are for internal use and should not be called from the outside. Crockford says this is bad (and it is), but I don't care right now. Maybe change it sometime. :P
 **/

var ModelClass = {
  properties: {},
  
  relationChanges: [],
  
  modelName: 'Model',

  id: null,
  __inDB: false,

  errors: {},

  /**
   *  Main constructor. Initializes the object.
   */
  constructor: function constuctor() {
    var tmp, p;

    if (this.modelName === 'Model') {
      throw 'modelName has to be set to your models name!';
    }

    this.p = this.prop = this.property; // create short calls

    // initialize the properties
    for (p in this.properties) {
      if (this.properties.hasOwnProperty(p)) {
        tmp = this.properties[p];
        this.property(p, tmp.value || 0); // this ensures typecasing/behaviours
        tmp.__updated = false;
        tmp.__oldValue = tmp.value;
        tmp.__numericIndex = indexNumberTypes.indexOf(tmp.type) > -1 && !tmp.noscore;
        this.properties[p] = tmp;
        this.errors[p] = [];
      }
    }

    this.id = null;
    this.__inDB = false;
  },

  logError: function logError(err) {
    if (err) {
      sys.debug('Nohm: Adding an index resulted in a redis error: ' + sys.inspect(err));
      // TODO: add some kind of persistent logging for errors.
    }
  },

  /**
   *  Saves the object by either creating, or updating it.
   */
  save: function save(callback) {
    var self = this,
    action = self.id ? 'update' : 'create';
    if (!self.id) {
      self.id = + new Date() + parseInt(Math.random() * 100, 10);
    }
    this.valid(null, true, function (valid) {
      if (!valid && typeof callback === 'function') {
        callback('invalid');
      } else if (valid && action === 'create') {
        self.__create(callback);
      } else if (valid) {
        self.__update(false, callback);
      }
    });
  },

  /**
   *  Creates a new empty (!) dataset in the database and calls __update to populate it.
   */
  __create: function __create(callback) {
    var self = this;
    redis.incr(prefix + ':ids:' + this.modelName, function (err, newId) {
      if (!err) {
        self.__setUniqueIds(newId, function (err) {
          self.id = newId;
          self.__update(true, callback);
        });
      } else {
        sys.debug('Nohm: Creating an object resulted in a redis error: ' + sys.inspect(err));
        if (typeof callback === 'function') {
          callback(err);
        } else {
          throw err;
        }
      }
    });
  },

  __index: function __index(p) {
    if (this.properties[p].__numericIndex) {
      // we use scored sets for things like "get all users older than 5"
      if (this.__inDB) {
        redis.zrem(scoredindexprefix + this.modelName + ':' + p, this.id, this.logError);
      }
      redis.zadd(scoredindexprefix + this.modelName + ':' + p, this.properties[p].value, this.id, this.logError);
    }
    if (this.__inDB) {
      redis.srem(indexprefix + this.modelName + ':' + p + ':' + this.properties[p].__oldValue, this.id, this.logError);
    }
    redis.sadd(indexprefix + this.modelName + ':' + p + ':' + this.properties[p].value, this.id, this.logError);
  },

  /**
   *  Update an existing dataset with the new values.
   */
  __update: function __update(all, callback) {
    var args = [hashprefix + this.modelName + ':' + this.id],
    props = this.properties,
    self = this,
    p;
    for (p in props) {
      if (all || props[p].__updated) {
        args.push(p);
        args.push(props[p].value);
      }
    }
    args.push(function realUpdate(err) {
      var i = 0, change, changeConductors = {}, changeArray = [], p, tmp_change, cb;
      if (!err) {
        for (p in props) {
          if (props.hasOwnProperty(p)) {
            // free old uniques
            if (props[p].unique === true && props[p].__updated) {
              if (self.__inDB) {
                redis.del(uniqueprefix + self.modelName + ':' + p + ':' + props[p].__oldValue, self.logError);
              }
            }
            if (props[p].index === true && (!self.__inDB || props[p].__updated)) {
              self.__index(p);
            }
            self.property(p, props[p].value || 0); // this ensures typecasing/behaviours
            props[p].__updated = false;
            props[p].__oldValue = props[p].value;
            self.errors[p] = [];
          }
        }
      }
      // call the provided callback.
      // we do this here instead of nested in the dels/srems/sadds above to speed things a little up.
      // this means there might be problems that you only see if you look at the logger. :/
      self.__inDB = true;
      if (typeof callback !== 'function' && err) {
        sys.debug('Nohm: Updating an object resulted in a redis error: ' + sys.inspect(err));
        throw err;
      } else if (err) {
        callback(err);
      } else {
        if (self.relationChanges.length > 0) {
          cb = function (arg, callback) {
            self['__' + tmp_change.action](tmp_change.object, tmp_change.name, function () {
              tmp_change.callback(tmp_change.action, self.modelName, tmp_change.name, tmp_change.object);
              callback();
            });
          };
          for (change in self.relationChanges) {
            if (self.relationChanges.hasOwnProperty(change)) {
              i = randomString();
              changeArray.push(i + '1');
              tmp_change = self.relationChanges[change];
              delete self.relationChanges[change];
              changeConductors[i] = ['_1', cb];
            }
          }
          changeArray.push(callback);
          changeConductors.done = changeArray;
          new Conduct(changeConductors, 'done1')();
        } else {
          callback();
        }
      }
    });
    redis.hmset.apply(redis, args);
  },

  /**
   *  Remove an objet from the database.
   *  Note: Does not destroy the js object or its properties itself!
   */
  remove: function remove(callback) {
    var self = this;
    redis.del(hashprefix + self.modelName + ':' + this.id, function (err) {
      for (var p in self.properties) {
        if (self.properties.hasOwnProperty(p)) {
          if (self.properties[p].unique) {
            redis.del(uniqueprefix + self.modelName + ':' + p + ':' + self.properties[p].__oldValue);
          }
          if (self.properties[p].index) {
            redis.srem(indexprefix + self.modelName + ':' + p + ':' + self.properties[p].__oldValue, self.id);
          }
          if (self.properties[p].__numericIndex) {
            redis.zrem(indexprefix + self.modelName + ':' + p, self.id);
          }
        }
      }
      if (typeof callback === 'function') {
        callback(err);
      } else if (err) {
        sys.debug('Nohm: Deleting an object resulted in a redis error: ' + sys.inspect(err));
        throw err;
      }
    });
  },
  
  __link: function __link(obj, name, cb) {
    var self = this,
    parentName = name === 'child' ? 'parent' : name + 'Parent',
    addition = function (err) {
      if (!err || typeof err === 'function') {
        new Conduct({
          'toChild': [function (callback) {
            redis.sadd(relationsprefix + self.modelName + ':' + name +
                     ':' + obj.modelName + ':' + self.id, obj.id, callback);
          }],
          'toParent': [function (callback) {
            redis.sadd(relationsprefix + obj.modelName + ':' + parentName +
                     ':' + self.modelName + ':' + obj.id, self.id, callback);
          }],
          '_done': ['toChild0', 'toParent0', cb]
        })();
      } else {
        cb(err);
      }
    };
    
    if (!this.id) {
      cb('save parent object before adding a child.');
    } else if (!obj.id) {
      obj.save(addition);
    } else {
      addition();
    }
  },
  
  __unlink: function __unlink(obj, name, cb) {
    var self = this,
    parentName = name === 'child' ? 'parent' : name + 'Parent',
    removal = function (err) {
      if (!err) {
        new Conduct({
          'fromChild': [function (callback) {
            redis.srem(relationsprefix + self.modelName + ':' + name + 
                    ':' + obj.modelName + ':' + self.id, obj.id, callback);
          }],
          'fromParent': [function (callback) {
            redis.srem(relationsprefix + obj.modelName + ':' + parentName + 
                    ':' + self.modelName + ':' + obj.id, self.id, callback);
          }],
          '_done': ['fromChild1', 'fromParent1', cb]
        })();
      } else {
        cb(err);
      }
    };
    
    if (!this.id) {
      cb('save parent object before removing a child.');
    } else if (!obj.id) {
      obj.save(removal);
    } else {
      removal();
    }
  },
  
  /**
   *  Adds a reference to another object.
   */
  link: function link(obj, name, directChange) {
    var callback = getCallback(arguments);
    name = name && typeof name !== 'function' ? name : 'child';
    directChange = typeof directChange !== 'function' ? !!directChange : false;
    if (this.id && directChange && obj.valid()) {
      this.__link(obj, name, callback);
    } else {
      this.relationChanges.push({
        action: 'link',
        object: obj,
        name: name,
        callback: callback
      });
    }
  },
  
  /**
   *  Removes the reference in the current object to
   *  the object given in the first argument.
   *  Note: this leaves the given object itself intact.
   */
  unlink: function unlink(obj, name, directChange) {
    var callback = getCallback(arguments),
    change;
    name = name || 'child';
    if (this.id && directChange && obj.id) {
      this.__unlink(obj, name, callback);
    } else if (!obj.id) {
      /* the object hasn't been added to the db yet.
       * this means it's still in the relationchanges array
       * and we can just take it out there.
       * (or it was never added, in which case nothing happens here.)
       */
      for (change in this.relationChanges) {
        if (this.relationChanges.hasOwnProperty(change) &&
            this.relationChanges[change].action === 'add' &&
            this.relationChanges[change].name === name &&
            checkEqual(this.relationChanges[change].object, obj)) {
          delete this.relationChanges[change];
        }
      }
    } else {
      this.relationChanges.push({
        action: 'unlink',
        name: name,
        callback: callback,
        object: obj
      });
    }
  },

  /**
   *  Get or set a property.
   *  This automatically invokes typecasting and behaviours.
   *  If you pass true as the third parameter,
   *  the property is instantly checked for validity.
   */
  property: function property(key, val, validate) {
    var tmp, old;

    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' +
      key + '" of object "' + this.modelName + '".';
      // TODO: maybe implement a custom exception object that has stuff like loggers and such
    }
    tmp = this.properties[key];
    if (typeof val === 'undefined') {
      return tmp.value;
    } else if (val !== tmp.value) {
      old = tmp.value;
      tmp.value = this.__cast(key, val);
      if (validate) {
        if (!this.valid(key)) {
          tmp.value = old;
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

  /**
   *  Casts a property to a certain datatype. (Might cause unexpected results.
   *  Behaviours offer greater control over what happens.)
   *  Currently supported:
   *  string,
   *  integer,
   *  float,
   *  timestamp (time/date string or number to unix timestamp)
   */
  __cast: function __cast(key, value) {
    if (!this.properties[key]) {
      throw 'Trying to access undefined property "' +
      key + '" of object "' + this.modelName + '".';
      // TODO: maybe implement a custom exception object that has stuff like loggers and such
    }
    // TODO: implement behaviours after casting
    var type = this.properties[key].type,
      timezoneOffset,
      matches,
      hours,
      minutes;
    switch (type) {
    case 'string':
      // no .toString() here. TODO: or should there be?
      return (
              (!(value instanceof String) ||
               value.toString() === '') && typeof value !== 'string'
              ) ? ''
                : value;
    case 'integer':
      return isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
    case 'float':
      return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    case 'timestamp':
      // make it a unix timestamp aka. seconds from 1970 instead of miliseconds
      if (isNaN(value) && typeof value === 'string') {
        // see if there is a timezone specified in the string
        matches = value.match(/(\+|\-)([\d]{1,2})\:([\d]{2})$/);
        if (value.match(/Z$/)) {
          // UTC timezone in an ISO string (hopefully)
          timezoneOffset = 0;
        } else if (matches) {
          // +/- hours:minutes specified.
          // calculating offsets in minutes and removing the offset from the string since new Date() can't handle those.
          hours = parseInt(matches[2], 10);
          minutes = parseInt(matches[3], 10);
          if (matches[1] === '-') {
            timezoneOffset = -1 * (hours * 60 + minutes);
          } else {
            timezoneOffset = hours * 60 - minutes;
          }
          value = value.substring(0, value.length - matches[0].length);
        } else {
          timezoneOffset = new Date(value).getTimezoneOffset();
        }
        return new Date(value).getTime() / 1000 - timezoneOffset * 60;
      }
      return parseInt(value, 10);
    default:
      return value;
    }
  },

  /**
   * Get an array of all properties that have been changed.
   */
  propertyDiff: function propertyDiff(key) {
    var diff = [],
    p;
    if (key && !this.properties[key]) {
      throw 'Invalid key specified for diffProperty';
    }

    for (p in this.properties) {
      if (!key || p === key) {
        if (this.properties[p].__updated) {
          diff.push({
            key: p,
            before: this.properties[p].__oldValue,
            after: this.properties[p].value
          });
        }
      }
    }
    return diff;
  },

  /**
   *  Resets the values of all or one propert(y/ies).
   */
  propertyReset: function propertyReset(key) {
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

  /**
   *  Get all properties with values either as an array or as json (param true)
   */
  allProperties: function allProperties(json) {
    var props = {},
    p;
    for (p in this.properties) {
      if (this.properties.hasOwnProperty(p)) {
        props[p] = this.properties[p].value;
      }
    }
    return json ? JSON.stringify(props) : props;
  },

  /**
   *  Check if one or all propert(y/ies) are valid.
   */
  valid: function valid(key, setDirectly, callback) {
    var validbool = true,
    p;
    for (p in this.properties) {
      if (!key || key === p) {
        if (!this.__validateProperty(p)) {
          validbool = false;
        }
      }
    }
    if (typeof callback === 'function') {
      // if there is no valid callback, there is no good reason to call an async function.
      this.__checkUniques(setDirectly, function (success) {
        
        if (!key && !success) {
          validbool = false;
        } else if (key && !success) {
          validbool = !!this.errors[key];
        }
        callback(validbool);
      });
    }
    return validbool;
  },

  /**
   *  Check whether all properties marked as unique have a value that is not set in the database yet.
   *  If setDirectly is set, it will occupy the unique in the db directly.
   *  Use setDirectly if you're saving the object to prevent race-conditions.
   */
  __checkUniques: function __checkUniques(setDirectly, saveCallback) {
    /*
     * This is a bit of a fuckup...
     * This code essentially creates an object with functions (redis checks) that will run in parrallel and when all those are done a final check of the redis returns is done.
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
    uniqueLocker = function uniqueLocker(propName, callback) {
      if (setDirectly && !self.id) {
        self.logError('Checking for uniques without having an id set. self:' + sys.inspect(self));
      }
      var checkCallback = function (err, value) {
        // exists and setnx return opposite values for what we want here
        var sucess = setDirectly ? !value : !!value;
        tmpUniques.push(uniqueprefix + self.modelName + ':' + propName + ':' + self.p(propName));
        callback(err, {
          p: propName,
          unique: value
        });
      };
      if (setDirectly) {
        /*
         * We lock the unique value here if it's not locked yet, then later remove the old uniquelock when really saving it. (or we free the unique slot if we're not saving)
         */
        redis.setnx(uniqueprefix + self.modelName + ':' + propName + ':' + self.p(propName), self.id, checkCallback);  
      } else {
        redis.exists(uniqueprefix + self.modelName + ':' + propName + ':' + self.p(propName), checkCallback);
      }
    };
    for (p in tmp) {
      if (tmp[p].unique === true && (tmp[p].__updated || self.id === null)) {
        i = i + 1;
        finalArgs.push(p + '1');
        initArgs.push(p);

        functions[p] = ['_' + i, uniqueLocker];
      }
    }
    if (functions.length === 0) {
      saveCallback(true);
    } else {
      finalArgs.push(function () {
        var r, i, len;
        for (r in arguments) {
          if (! arguments[r].unique) {
            self.errors[arguments[r].p].push('notUnique');
            success = false;
          }
        }
        if (setDirectly && ! success) {
          for (i = 0, len = tmpUniques.length; i < len; i = i + 1) {
            // delete tmp unique locks since the new values won't be saved.
            // TODO: this needs logging in case of errors.
            redis.del(tmpUniques[i]);
          }
        }
        saveCallback(success);
      });
      functions.finalFunc = finalArgs;
      doit = new Conduct(functions);
      doit.apply(doit, initArgs);
    }
  },
  
  /**
   *  Set the real id of the unique values.
   */
  __setUniqueIds: function __setUniqueIds(id, cb) {
    var p,
    self = this,
    args = [];
    for (p in this.properties) {
      if (this.properties.hasOwnProperty(p) && this.properties[p].unique) {
        args.push(uniqueprefix + this.modelName + ':' + p + ':' + this.p(p));
        args.push(id);
      }
    }
    if (args.length > 0) {
      redis.mset(args, cb);
    } else {
      cb();
    }
  },

  /**
   *  Validates a given property.
   */
  __validateProperty: function __validateProperty(p) {
    if (!p || !this.properties[p]) {
      throw 'Trying to validate undefined property or accessing __validateProperty without giving a property';
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
      // the fuck is this?
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

};


exports.Model = new Class(ModelClass);
