var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async');
var h = require(__dirname + '/helpers');

/**
 * Check if the object has a relation to another object.
 */
exports.belongsTo = function belongsTo(obj, name) {
  var callback = h.getCallback(arguments),
      self = this;
  name = name && typeof name !== 'function' ? name : 'default';
  if (!this.id || !obj.id) {
    Nohm.logError('Calling belongsTo() even though either the object itself or the relation does not have an id.');
  }
  this.getClient().sismember(this.relationKey(obj.modelName, name),
                  obj.id,
                  function (err, value) {
                    if (err) {
                      this.logError(err);
                    }
                    callback.call(self, err, !!value);
                  });
};

/**
 * Returns the key needed for getting related objects
 */
exports.relationKey = function relationKey(objName, name) {
  return Nohm.prefix.relations + this.modelName + ':' + name + ':' + objName +
    ':' + this.id;
};

/**
 * Retrieves all relations to another model.
 */
exports.getAll = function getAll(objName, name) {
  var callback = h.getCallback(arguments),
  self = this;
  name = name && typeof name !== 'function' ? name : 'default';
  if (!this.id) {
    Nohm.logError('Calling getAll() even though this '+this.modelName+' has no id. Please load or save it first.');
  }
  this.getClient().smembers(this.relationKey(objName, name),
                  function (err, value) {
                    if (err) {
                      self.logError(err);
                    }
                    if (!Array.isArray(value)) {
                      value = [];
                    } else {
                      value = value.map(function (val) {
                        var int_val = parseInt(val.toString(), 10);
                        if (!isNaN(int_val) && int_val == val) {
                          val = int_val;
                        }
                        return val;
                      });
                    }
                    callback.call(self, err, value);
                  });
};

/**
 *  Returns the number of links of a specified relation (or the default) an instance has to models of a given modelName.
 * 
 *  @param {String} obj_name Name of the model on the other end of the relation.
 *  @param {String} [relation_name="default"] Name of the relation
 *  @param {Function} callback Callback called with (err, num_relations
 */
exports.numLinks = function numLinks(obj_name, relation_name, callback) {
  callback = h.getCallback(arguments);
  var self = this;
  relation_name = relation_name && typeof relation_name !== 'function' ? relation_name : 'default';
  if (!this.id) {
    Nohm.logError('Calling numLinks() even though either the object itself or the relation does not have an id.');
  }
  this.getClient().scard(this.relationKey(obj_name, relation_name),
                  function (err, num_relations) {
                    if (err) {
                      self.logError(err);
                    }
                    callback.call(self, err, num_relations);
                  });
};

var allowedLinkTypes = ['sadd', 'srem'];

exports.__linkProxied = function __linkProxied(type, obj, options, callback) {
  
  options = typeof(options) === 'object' && Object.keys(options).length > 0 ? options : {};
  callback = h.getCallback(arguments);

  var self = this,
  foreignName = options.name + 'Foreign',
  silent = !!options.silent,
  client = self.getClient(),
  redisExec = function (cb) {
    var dbVals = [{
        key: self.relationKey(obj.modelName, options.name), 
        keyStore: self.modelName+':'+self.id,
        id: obj.id
      }, {
        key: obj.relationKey(self.modelName, foreignName),
        keyStore: obj.modelName+':'+obj.id,
        id: self.id
      }
    ];

    async.forEach(dbVals, 
      function (val, next) {
        var multi = client.multi();
        multi[type](Nohm.prefix.relationKeys+val.keyStore, val.key);
        multi[type](val.key, val.id);
        multi.exec(next);
      }, 
      function (err) {
        if (!silent && !err) {
          self.fireEvent( type === 'sadd' ? 'link' : 'unlink', obj, options.name );
        }
        if (err && typeof(options.error) === 'function') {
          options.error(err, 'Linking failed.', obj);
        }
        cb.call(self, err);
      }
    );
  };
  
  if (allowedLinkTypes.indexOf(type) === -1) {
    callback.call(self, 'wrong link/unlink type invocation');
  } else if (!this.id) {
    callback.call(self, 'You need to save an object before adding a link. (this might be a nohm error)');
  } else if (!obj.id) {
    obj.save(options, function (err, link_error, link_name) {
      if (err && !link_error && typeof(options.error) === 'function') {
        options.error(err, obj.errors, obj);
      }
      if (err) {
        callback(err, link_error, link_name);
      } else {
        redisExec(callback);
      }
    });
  } else {
    redisExec(callback);
  }
};

exports.__link = function __link(obj, options, cb) {
  this.__linkProxied('sadd', obj, options, cb);
};

exports.__unlink = function __unlink(obj, options, cb) {
  this.__linkProxied('srem', obj, options, cb);
};

/**
 *  Adds a reference to another object.
 */
exports.link = function link(obj, options, callback) {

  if (typeof(options) === 'string') {
    options = {name: options};
  }
  var opts = h.$extend({
    name: 'default'
  }, options);

  callback = h.getCallback(arguments);
  
  this.relationChanges.push({
    action: 'link',
    object: obj,
    options: opts,
    callback: callback
  });
};

/**
 *  Removes the reference in the current object to
 *  the object given in the first argument.
 *  Note: this leaves the given object itself intact.
 */
exports.unlink = function unlink(obj, options, callback) {

  if (typeof(options) === 'string') {
    options = {name: options};
  }
  var opts = h.$extend({
    name: 'default'
  }, options);

  callback = h.getCallback(arguments);
  
  var changes = this.relationChanges;
  for (var i in changes) {
    if (changes.hasOwnProperty(i) &&
        changes[i].name === opts.name &&
        h.checkEqual(changes[i].object, obj)) {
      delete this.relationChanges[i];
    }
  }
  
  this.relationChanges.push({
    action: 'unlink',
    options: opts,
    callback: callback,
    object: obj
  });
};

/**
 * Removes all links to all other object instances
 */
exports.unlinkAll = function (client, callback) {
  var self = this;
  var normalClient = this.getClient();
  var relationKeys_key = Nohm.prefix.relationKeys+this.modelName+':'+this.id;
  client = client || normalClient;

  this.relationChanges = [];

  // we usenormalClient for fetching data and client (which could be a provided client in multi mode) for manipulating data
  normalClient.smembers(relationKeys_key, function (err, keys) {
    var others = [];
    keys.forEach(function (key) {
      var matches = key.match(/:([\w]*):([\w]*):[\w]+$/i);
      var selfName = matches[1];
      var otherName;
      var namedMatches;
      if (matches[1] === 'default') {
        otherName = 'defaultForeign';
      } else if (matches[1] === 'defaultForeign') {
        otherName = 'default';
      } else {
        namedMatches = matches[1].match(/^([\w]*)Foreign$/);
        if (namedMatches) {
          selfName = matches[1];
          otherName = namedMatches[1];
        } else {
          selfName = matches[1];
          otherName = matches[1] + 'Foreign';
        }
      }
      others.push({
        model: matches[2],
        selfName: selfName,
        otherName: otherName
      });
    });
    async.map(others, function (item, cb) {
      normalClient.smembers(
        Nohm.prefix.relations+self.modelName+':'+item.selfName+':'+item.model+':'+self.id,
        function (err, ids) {
          if (err) {
            Nohm.logError(err);
          }
          ids.forEach(function (id) {
            client.srem(Nohm.prefix.relations+item.model+':'+item.otherName+':'+self.modelName+':'+id, self.id);
          });
          cb(err, Nohm.prefix.relations+self.modelName+':'+item.selfName+':'+item.model+':'+self.id);
        }
      );
    }, function (err, links) {
      if (links.length > 0) {
        links.push(relationKeys_key);
        links.push(function (err) {
          if (err) {
            Nohm.logError('There was a problem while deleting keys:'+err);
          }
        });
        client.del.apply(client, links);
      }
      callback.call(self, err);
    });
  });
};

