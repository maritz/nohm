var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var Conduct = require('conductor')
,h = require(__dirname + '/helpers');


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

exports.__link = function __link(obj, name, cb) {
  var self = this,
  parentName = name === 'child' ? 'parent' : name + 'Parent',
  addition = function (err) {
    if (!err || typeof err === 'function') {
      new Conduct({
        'toChild': [function (callback) {
          self.getClient().sadd(Nohm.prefix.relations + self.modelName + ':' + name +
                   ':' + obj.modelName + ':' + self.id, obj.id, callback);
        }],
        'toParent': [function (callback) {
          self.getClient().sadd(Nohm.prefix.relations + obj.modelName + ':' + parentName +
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
};

exports.__unlink = function __unlink(obj, name, cb) {
  var self = this,
  parentName = name === 'child' ? 'parent' : name + 'Parent',
  removal = function (err) {
    if (!err) {
      new Conduct({
        'fromChild': [function (callback) {
          self.getClient().srem(Nohm.prefix.relations + self.modelName + ':' + name +
                  ':' + obj.modelName + ':' + self.id, obj.id, callback);
        }],
        'fromParent': [function (callback) {
          self.getClient().srem(Nohm.prefix.relations + obj.modelName + ':' + parentName +
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