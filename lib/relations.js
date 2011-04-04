var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');


/**
 * Check if the object has a relation to another object.
 */
exports.has = function has(obj, name) {
  var callback = h.getCallback(arguments),
  self = this;
  name = name && typeof name !== 'function' ? name : 'child';
  if (!this.id || !obj.id) {
    Nohm.logError('Calling has() even though either the object itself or the relation does not have an id.');
  }
  this.getClient().sismember(this.relationKey(obj.modelName, name),
                  obj.id,
                  function (err, value) {
                    if (err) {
                      this.logError(err);
                    }
                    callback(err, !!value);
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
                        return parseInt(val.toString(), 10);
                      });
                    }
                    callback(err, value);
                  });
};

exports.numLinks = function numLinks(objName, name) {
  var callback = h.getCallback(arguments),
  self = this;
  name = name && typeof name !== 'function' ? name : 'child';
  if (!this.id) {
    Nohm.logError('Calling numLinks() even though either the object itself or the relation does not have an id.');
  }
  this.getClient().scard(this.relationKey(objName, name),
                  function (err, value) {
                    if (err) {
                      self.logError(err);
                    }
                    callback(err, value);
                  });
};


var allowedLinkTypes = ['sadd', 'srem'];

exports.__linkProxied = function __linkProxied(type, obj, name, cb) {
  var self = this,
  parentName = name === 'child' ? 'parent' : name + 'Parent',
  client = self.getClient(),
  redisExec = function (err) {
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
        function (val, callback) {
          client[type](Nohm.prefix.relationKeys+val.keyStore, val.key);
          client[type](val.key, val.id, callback);
        }, 
        function (err) {
          cb(err);
        }
      );
    } else {
      cb(err);
    }
  };
  
  if (allowedLinkTypes.indexOf(type) === -1) {
    cb('link/unlink type invocation wrong');
  } else if (!this.id) {
    cb('save parent object before adding a child.');
  } else if (!obj.id) {
    obj.save(redisExec);
  } else {
    redisExec();
  }
};

exports.__link = function __link(obj, name, cb) {
  this.__linkProxied('sadd', obj, name, cb);
};

exports.__unlink = function __unlink(obj, name, cb) {
  this.__linkProxied('srem', obj, name, cb);
};

/**
 *  Adds a reference to another object.
 */
exports.link = function link(obj, name, directChange) {
  var callback = h.getCallback(arguments);
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
};

/**
 *  Removes the reference in the current object to
 *  the object given in the first argument.
 *  Note: this leaves the given object itself intact.
 */
exports.unlink = function unlink(obj, name, directChange) {
  var callback = h.getCallback(arguments),
  change;
  name = name && typeof name !== 'function' ? name : 'child';
  if (this.id && directChange && obj.id) {
    this.__unlink(obj, name, callback);
  } else if (!this.id) {
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
};

/**
 * Removes all links to all other object instances
 */
exports.unlinkAll = function (client, callback) {
  var self = this,
      normalClient = this.getClient()
      selfLinks = [];
  client = client || normalClient;
  
  // this.getClient() here because client can (and should) be a multi()
  normalClient.smembers(Nohm.prefix.relationKeys+this.modelName+':'+this.id, function (err, keys) {
    var others = [];
    keys.forEach(function (key) {
      matches = key.match(/:([\w]*):([\w]*):[\d]+$/i);
      selfName = matches[1];
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
      callback(err);
    });
  });
};

