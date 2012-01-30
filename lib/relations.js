var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');

/**
 * Check if the object has a relation to another object.
 */
exports.belongsTo = function belongsTo(obj, name) {
  var callback = h.getCallback(arguments),
      self = this;
  name = name && typeof name !== 'function' ? name : 'child';
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
  name = name && typeof name !== 'function' ? name : 'child';
  if (!this.id) {
    Nohm.logError('Calling getAll() even though this '+this.modelName+' has no id. Please load or save it first.');
  }
  this.getClient().smembers(this.relationKey(objName, name),
                  function (err, value) {
                    if (err) {
                      self.logError(err);
                    }
                    if (!Array.isArray(value)) {
                      console.log('getAll has got a non-array value');
                      value = [];
                    } else {
                      value = value.map(function (val) {
                        if (self.idGenerator === 'increment') {
                          val = parseInt(val.toString(), 10);
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
 *  @param {String} [relation_name="child"] Name of the relation
 *  @param {Function} Callback Callback called with (err, num_relations
 */
exports.numLinks = function numLinks(obj_name, relation_name, callback) {
  callback = h.getCallback(arguments);
  var self = this;
  relation_name = relation_name && typeof relation_name !== 'function' ? relation_name : 'child';
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

exports.__linkProxied = function __linkProxied(type, obj, name, options, callback) {
  options = typeof(options) === 'object' && Object.keys(options).length > 0 ? options : {};
  callback = h.getCallback(arguments);

  var self = this,
  parentName = name === 'child' ? 'parent' : name + 'Parent',
  silent = !!options.silent,
  client = self.getClient(),
  redisExec = function (err, childFail, childName) {
    if (!err || typeof err === 'function') {
      var dbVals = [{
          key: self.relationKey(obj.modelName, name), 
          keyStore: self.modelName+':'+self.id,
          id: obj.id
        }, {
          key: obj.relationKey(self.modelName, parentName),
          keyStore: obj.modelName+':'+obj.id,
          id: self.id
        }
      ];
      async.forEach(dbVals, 
        function (val, next) {
          client[type](Nohm.prefix.relationKeys+val.keyStore, val.key);
          client[type](val.key, val.id, next);
        }, 
        function (err) {

          if (!silent && !err) {
            self.fireEvent( type === 'sadd' ? 'link' : 'unlink', obj, name );
          }

          callback.call(self, err);
        }
      );
    } else if (err && childFail) {
      callback.call(self, err, childFail, childName);
    } else {
      callback.call(self, err);
    }
  };

  if (allowedLinkTypes.indexOf(type) === -1) {
    callback.call(self, 'wrong link/unlink type invocation');
  } else if (!this.id) {
    callback.call(self, 'save parent object before adding a child.');
  } else if (!obj.id) {
    obj.save(options, redisExec);
  } else {
    redisExec();
  }
};

exports.__link = function __link(obj, name, options, cb) {
  this.__linkProxied('sadd', obj, name, options, cb);
};

exports.__unlink = function __unlink(obj, name, options, cb) {
  this.__linkProxied('srem', obj, name, options, cb);
};

/**
 *  Adds a reference to another object.
 */
exports.link = function link(obj, name, directChange) {

  // TODO
  var options = {};

  var callback = h.getCallback(arguments);
  name = name && typeof name !== 'function' ? name : 'child';
  directChange = typeof directChange !== 'function' ? !!directChange : false;

  if (this.id && directChange && obj.valid()) {

    this.__link(obj, name, options, callback);

  } else {

    this.relationChanges.push({
      action: 'link',
      object: obj,
      name: name,
      callback: callback
    });

  }
};

/**
 *  Removes the reference in the current object to
 *  the object given in the first argument.
 *  Note: this leaves the given object itself intact.
 */
exports.unlink = function unlink(obj, name, directChange) {

  // TODO
  var options = {};

  var callback = h.getCallback(arguments),
      changes = this.relationChanges;

  name = name && typeof name !== 'function' ? name : 'child';
  directChange = typeof directChange !== 'function' ? !!directChange : false;

  if (this.id && directChange && obj.id) {

    this.__unlink(obj, name, options, callback);

  } else if (!this.id) {

    /* the object hasn't been added to the db yet.
     * this means it's still in the relationchanges array
     * and we can just take it out there.
     * (or it was never added, in which case nothing happens here.)
     */
    for (var i in changes) {
      if (changes.hasOwnProperty(i) &&
          changes[i].action === 'add' &&
          changes[i].name === name &&
          checkEqual(changes[i].object, obj)) {
        delete this.relationChanges[i];
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
};

/**
 * Removes all links to all other object instances
 */
exports.unlinkAll = function (client, callback) {
  var self = this;
  var normalClient = this.getClient();
  var selfLinks = [];
  client = client || normalClient;

  // we usenormalClient for fetching data and client (which could be a provided client in multi mode) for manipulating data
  normalClient.smembers(Nohm.prefix.relationKeys+this.modelName+':'+this.id, function (err, keys) {
    var others = [];
    keys.forEach(function (key) {
      var matches = key.match(/:([\w]*):([\w]*):[\w]+$/i);
      var selfName = matches[1];
      var otherName;
      var namedMatches;
      if (matches[1] === 'child') {
        otherName = 'parent';
      } else if (matches[1] === 'parent') {
        otherName = 'child';
      } else {
        namedMatches = matches[1].match(/^([\w]*)Parent$/);
        if (namedMatches) {
          selfName = matches[1]+'Parent';
          otherName = namedMatches[1];
        } else {
          selfName = matches[1];
          otherName = matches[1] + 'Parent';
        }
      }
      others.push({
        model: matches[2],
        selfName: selfName,
        otherName: otherName
      });
    });
    async.forEach(others, function (item, cb) {
      normalClient.smembers(
        Nohm.prefix.relations+self.modelName+':'+item.selfName+':'+item.model+':'+self.id,
        function (err, ids) {
          if (err) {
            Nohm.logError(err);
          }
          ids.forEach(function (id) {
            client.srem(Nohm.prefix.relations+item.model+':'+item.otherName+':'+self.modelName+':'+id, self.id);
          });
          selfLinks.push(Nohm.prefix.relations+self.modelName+':'+item.selfName+':'+item.model+':'+self.id);
          cb(err);
        }
      );
    }, function (err) {
      if (selfLinks.length > 0) {
        client.del.apply(client, selfLinks);
      }
      callback.call(self, err);
    });
  });
};

