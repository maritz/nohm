var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');

/**
 *  Saves the object by either creating, or updating it.
 */
exports.save = function save(callback) {
  var self = this,
  action = self.id ? 'update' : 'create';
  // TODO: add mechanism that checks whether an object with this.id exists
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
};

/**
 *  Only operates on properties that have been changed
 */
exports.partialSave = function partialSave(callback) {
  if (!this.id) {
    var err = 'Trying to do a partialSave on an object without id.';
    Nohm.logError(err);
    callback(err);
  }
  var props = this.properties,
  num_updated = 0,
  success = true,
  self = this,
  validCallback = function (valid) {
    if (!valid) {
      success = false;
    }
    num_updated = num_updated - 1;
    if (num_updated <= 0) {
      if (! success) {
        callback('invalid');
      } else {
        self.__update(false, callback);
      }
    }
  };
  for (var p in props) {
    if (props[p].__updated) {
      num_updated = num_updated + 1;
      self.valid(p, true, validCallback);
    }
  }
};

/**
 *  Creates a new empty (!) dataset in the database and calls __update to populate it.
 */
exports.__create = function __create(callback) {
  var self = this;
  this.getClient().incr(Nohm.prefix.ids + this.modelName, function (err, newId) {
    if (!err) {
      self.getClient().sadd(Nohm.prefix.idsets + self.modelName, newId, function (err) {
        if (err) { Nohm.logError(err); }
        self.__setUniqueIds(newId, function (err) {
          if (err) { Nohm.logError(err); }
          self.id = newId;
          self.__update(true, callback);
        });
      });
    } else {
      console.log('Nohm: Creating an object resulted in a client error: ' + util.inspect(err));
      if (typeof callback === 'function') {
        callback(err);
      } else {
        throw err;
      }
    }
  });
};

exports.__index = function __index(p, client) {
  var prefix;
  client = client || this.getClient();
  if (this.properties[p].__numericIndex) {
    // we use scored sets for things like "get all users older than 5"
    prefix = Nohm.prefix.scoredindex + this.modelName;
    if (this.__inDB) {
      client.zrem(prefix + ':' + p, this.id, Nohm.logError);
    }
    client.zadd(prefix + ':' + p, this.properties[p].value, this.id, Nohm.logError);
  }
  prefix = Nohm.prefix.index + this.modelName;
  if (this.__inDB) {
    client.srem(prefix + ':' + p + ':' + this.properties[p].__oldValue, this.id, Nohm.logError);
  }
  client.sadd(prefix + ':' + p + ':' + this.properties[p].value, this.id, Nohm.logError);
};

/**
 *  Update an existing dataset with the new values.
 */
exports.__update = function __update(all, callback) {
  var hmsetArgs = [],
  props = this.properties,
  self = this,
  p,
  multi = this.getClient().multi();
  
  hmsetArgs.push(Nohm.prefix.hash + this.modelName + ':' + this.id);
  for (p in props) {
    if (all || props[p].__updated) {
      hmsetArgs.push(p);
      hmsetArgs.push(props[p].value);
    }
  }
  if (hmsetArgs.length > 1) {
    multi.hmset.apply(multi, hmsetArgs);
  }
  
  for (p in props) {
    if (props.hasOwnProperty(p)) {
      // free old uniques
      if (props[p].unique === true && props[p].__updated) {
        if (self.__inDB) {
          multi.del(Nohm.prefix.unique + self.modelName + ':' + p + ':' + props[p].__oldValue, Nohm.logError);
        }
      }
      if (props[p].index === true && (!self.__inDB || props[p].__updated)) {
        self.__index(p, multi);
      }
    }
  }
  multi.exec(function (err) {
    if (typeof callback !== 'function' && err) {
      Nohm.logError('Nohm: Updating an object resulted in a client error: ' + err);
      throw err;
    } else if (err) {
      callback(err);
    } else {
  
      async.forEach(self.relationChanges,
        function (item, cb) {
          self['__' + item.action](item.object, item.name, function (err) {
            item.callback(item.action,
                          self.modelName,
                          item.name,
                          item.object);
            cb(err);
          });
        },
        function (err) {
          if (typeof callback !== 'function' && err) {
            Nohm.logError('Nohm: Updating an object resulted in a client error: ' + err);
            throw err;
          } else {
            callback(err);
          }
        }
      );
      
    }
  });
};

/**
 *  Remove an objet from the database.
 *  Note: Does not destroy the js object or its properties itself!
 */
exports.remove = function remove(callback) {
  var self = this;
  
  if (!this.id) {
    callback('The object you are trying to delete has no id.');
  } else if (!this.__inDB) {
    this.load(this.id, function () {
      self.__realDelete(callback);
    });
  } else {
    this.__realDelete(callback);
  }
};

exports.__realDelete = function __realDelete(callback) {
  var self = this;
  
  var p, i, len, 
  multi = self.getClient().multi();

  multi.del(Nohm.prefix.hash + this.modelName + ':' + this.id);
  multi.srem(Nohm.prefix.idsets + this.modelName, this.id);

  for (p in this.properties) {
    if (this.properties.hasOwnProperty(p)) {
      if (this.properties[p].unique) {
        multi.del(Nohm.prefix.unique + this.modelName + ':' + p + ':' +
                  this.properties[p].__oldValue);
      }
      if (self.properties[p].index) {
        multi.srem(Nohm.prefix.index + self.modelName + ':' + p + ':' +
                   this.properties[p].__oldValue,
                   this.id);
      }
      if (self.properties[p].__numericIndex) {
        multi.zrem(Nohm.prefix.scoredindex + this.modelName + ':' + p,
                   this.id);
      }
    }
  }

  this.unlinkAll(multi, function () {
    multi.exec(function (err, values) {
      self.id = 0;
      if (typeof callback === 'function') {
        callback(err);
      } else {
        Nohm.logError(err);
      }
    });
  });
}