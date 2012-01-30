var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');

var noop = function () {};

/**
 *  Saves the object by either creating, or updating it.
 */
exports.save = function save(options) {

  var callback = h.getCallback(arguments);
  options = options && typeof options !== 'function' ? options : {};

  var self = this,
    id_tries = 0,
    action = 'create',
    idGenerated = false,
    silent = !!options.silent;

  var generateId = function () {
    idGenerated = true;
    // this is only a temporary id. it's negative so there's a way to identify some
    // corrupted data if there's a redis failure between the first write of this
    // model and the id change to its final real id
    var id = new Date() * -1 + Math.ceil(Math.random()*1e6);
    id_tries++;
    self.exists(id, function (exists) {
      if (exists && id_tries < 500) {
        generateId();
      } else if ( ! exists) {
        _save(id);
      } else {
        Nohm.logError('Unable to find a new free id after 500 tries.');
        callback('no free id found');
      }
    });
  };

  var _save = function (id) {
    if (id) {
      self.id = id;
    }
    self.valid(false, true, function (valid) {
      if (!valid && typeof callback === 'function') {
        if (action === 'create') {
          self.id = null;
        }
        callback.call(self, 'invalid');
      } else if (valid && action === 'create') {
        __create.call(self, silent, callback);
      } else if (valid) {
        __update.call(self, false, silent, callback);
      }
    });
  };

  if (!this.id) {
    generateId();
  } else {
    self.exists(this.id, function (exists) {
      if (exists) {
        action = 'update';
      }
      _save();
    });
  }
};

var idGenerators = {
  'default': function (cb) {
    function rnd() {
      return Math.floor(Math.random() * 1e9).toString(36);
    }
    cb((+ new Date()).toString(36) + rnd() + rnd());
  },
  'increment': function (cb) {
    this.getClient().incr(Nohm.prefix.ids + this.modelName, function (err, newId) {
    if (!err) {
      cb(newId);
    } else {
      console.log('Nohm: Creating a new id by incrementing resulted in a client error: ' + util.inspect(err));
      if (typeof cb === 'function') {
        cb.call(self, err);
      } else {
        throw err;
      }
    }
  });
  }
};

var __generate_id = function (cb) {
  var generator = this.idGenerator;
  if (typeof(generator) === 'function') {
    generator.call(this, function (id) {
      if (!id) {
        Nohm.logError('A custom id generator for model '+this.modelName+' failed to provide an id.');
      }
      cb(id);
    });
  } else {
    if (! idGenerators.hasOwnProperty(generator)) {
      generator = 'default';
    }
    idGenerators[generator].call(this, cb);
  }
};

/**
 *  Creates a new empty (!) dataset in the database and calls __update to populate it.
 * @ignore
 */
var __create = function __create(silent, callback) {
  var self = this;
  __generate_id.call(this, function (newId) {
    self.getClient().sadd(Nohm.prefix.idsets + self.modelName, newId, function (err) {
      if (err) { Nohm.logError(err); }
      self.__setUniqueIds(newId, function (err) {
        if (err) { Nohm.logError(err); }
        self.id = newId;
        __update.call(self, true, silent, callback);
      });
    });
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
 * @ignore
 */
var __update = function __update(all, silent, callback) {

  var options = {silent: !!silent};

  var p,
    hmsetArgs = [],
    isCreation = !this.__inDB,
    props = this.properties,
    self = this,
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

      // we're using a serial forEach here because otherwise multiple objects 
      // may error out without notifying the callback
      // this way once one fails it goes to error directly
      async.forEachSeries(self.relationChanges,
        function (item, cb) {
          self['__' + item.action](item.object, item.name, options, function (err, childFail, childName) {
            item.callback.call(self,
                          item.action,
                          self.modelName,
                          item.name,
                          item.object);
            if (err && childFail) {
              cb({ err: err, modelName: childName});
            } else if (err) {
              cb({ err: err, modelName: item.object.modelName});
            } else {
              cb();
            }
          });
        },
        function (err) {
          if (typeof callback !== 'function' && err) {

            Nohm.logError('Nohm: Updating an object resulted in a client error: ' + err);
            throw err;

          } else if (err) {

            callback.call(self, err.err, true, err.modelName);

          } else {
            var diff;
            if (!silent && self.getPublish()) {
              // we only need the diff if we'll fire the change to pubsub
               diff = self.propertyDiff();
            }

            self.__inDB = true;
            for (var p in self.properties) {
              if (self.properties.hasOwnProperty(p)) {
                self.__resetProp(p);
              }
            }

            if (!silent) {
              if (isCreation) {
                self.fireEvent('create');
              } else {
                self.fireEvent('update', diff);
              }
              self.fireEvent('save', diff);
            }

            callback.call(self);
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
exports.remove = function remove(options) {

  var callback = h.getCallback(arguments);
  options = options && typeof options !== 'function' ? options : {};

  var self = this,
    silent = !!options.silent;

  if (!this.id) {
    return callback('The object you are trying to delete has no id.');
  } else if (!this.__inDB) {
    this.load(this.id, function (err) {
      if (err) {
        return callback(err);
      } else {
        return __realDelete.call(self, silent, callback);
      }
    });
  } else {
    return __realDelete.call(self, silent, callback);
  }
};

var __realDelete = function __realDelete(silent, callback) {
  var self = this;

  var p,
  id = self.id,
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

      if (!silent && !err) {
        self.fireEvent('remove', id);
      }

      if (typeof callback === 'function') {
        callback.call(self, err);
      } else {
        Nohm.logError(err);
      }
    });
  });
};
