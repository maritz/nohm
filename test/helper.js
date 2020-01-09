exports.cleanUp = function(redis, prefix, cb) {
  redis.keys(prefix + '*', function(err, keys) {
    if (!keys || keys.length === 0) {
      return cb();
    }
    var len = keys.length;
    var k = 0;
    var deleteCallback = function() {
      k = k + 1;
      if (k === len) {
        cb();
      }
    };
    for (var i = 0; i < len; i++) {
      redis.del(keys[i], deleteCallback);
    }
  });
};

exports.cleanUpPromise = (redis, prefix) => {
  return new Promise((resolve) => {
    exports.cleanUp(redis, prefix, resolve);
  });
};

exports.sleep = (time = 100) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};
