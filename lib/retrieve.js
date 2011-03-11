/**
 * Retrieves the hash data by id and puts it into the properties.
 */
exports.load = function (id, callback) {
  var self = this;
  id = parseInt(id, 10);
  if (isNaN(id) || id < 1) {
    this.logError('Trying to pass load() a wrong kind of id. Needs to be a number over 0. (still trying to load it though)');
  }
  this.getClient().hgetall(this.getHashKey(id), function (err, values) {
    var p, value;
    if (err) {
      this.logError('loading a hash produced an error: ' + err);
    }
    if (values !== null) {
      for (p in values) {
        if (values.hasOwnProperty(p)) {
          value = values[p] !== null ? values[p].toString() : null;
          if (self.properties[p].load_pure) {
            self.properties[p].value = value;
          } else {
            self.p(p, value);
          }
          self.__resetProp(p);
        }
      }
      self.id = id;
      self.__inDB = true;
      self.__loaded = true;
    } else if (!err) {
      err = 'not found';
    }
    if (typeof(callback) === 'function') {
      callback(err);
    }
  });
}