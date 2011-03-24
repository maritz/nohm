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
  this.getClient().sismember(Nohm.prefix.relations + this.modelName + ':' + name + ':' +
                  obj.modelName + ':' + this.id,
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
    Nohm.logError('Calling getAll() even though either the object itself or the relation does not have an id.');
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
  this.getClient().scard(Nohm.prefix.relations + this.modelName + ':' + name + ':' +
                  objName + ':' + this.id,
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
          key: self.modelName+':'+name+':'+obj.modelName+':'+self.id, 
          keyStore: self.modelName+':'+self.id,
          id: obj.id
        }, {
          key: obj.modelName+':'+parentName+':'+self.modelName+':'+obj.id,
          keyStore: obj.modelName+':'+obj.id,
          id: self.id
        }
      ];
      async.forEach(dbVals, 
        function (val, callback) {
          console.log(type+' key: '+Nohm.prefix.relationKeys+val.keyStore);
          client[type](Nohm.prefix.relationKeys+val.keyStore, Nohm.prefix.relations+val.key);
          client[type](Nohm.prefix.relations+val.key, val.id, callback);
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