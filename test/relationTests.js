var util = require('util'),
  nohm = require(__dirname+'/../lib/nohm').Nohm,
  redis = nohm.client,
  relationsprefix = nohm.prefix.relations,
  UserLinkMockup = nohm.model('UserLinkMockup', {
    properties: {
      name: {
        type: 'string',
        value: 'testName',
        unique: true,
        validations: [
          'notEmpty'
        ]
      }
    }
  }),
  CommentLinkMockup = nohm.model('CommentLinkMockup', {
    properties: {
      text: {
        type: 'string',
        value: 'this is a comment! REALLY!',
        validations: [
          'notEmpty'
        ]
      }
    }
  }),
  RoleLinkMockup = nohm.model('RoleLinkMockup', {
    properties: {
      name: {
        type: 'string',
        value: 'user'
      }
    }
  });

exports.instances = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2;

  t.expect(2);

  role.link(user);

  t.ok(role.relationChanges !== user.relationChanges, 'Instances share the relationchanges, initiate them as an empty array in the constructor.');

  role2 = new RoleLinkMockup();
  t.same(role2.relationChanges, [], 'Creating a new instance does not reset the relationchanges of that instance.');

  t.done();
};


exports.link = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2 = new RoleLinkMockup(),
  linkCallbackCalled = false,
  linkCallbackCalled2 = false;
  t.expect(9);

  user.link(role, function (action, on, name, obj) {
    linkCallbackCalled = true;
    t.equals(action, 'link', 'The argument "action" given to the link callback are not correct');
    t.equals(on, 'UserLinkMockup', 'The argument "on" given to the link callback are not correct');
    t.equals(name, 'child', 'The argument "name" given to the link callback are not correct');
    t.same(obj, role, 'The argument "obj" given to the link callback are not correct');
  });

  role2.p('name', 'test');

  user.link(role2, function (action, on, name, obj) {
    linkCallbackCalled2 = true;
  });

  user.save(function (err) {
    if (!err) {
      t.ok(linkCallbackCalled, 'The provided callback for linking was not called.');
      t.ok(linkCallbackCalled2, 'The provided callback for the second(!) linking was not called.');
      redis.keys(relationsprefix + '*', function (err, values) {
        var args = [],
        key,
        firstDone = false,
        keyCheck = function (err, members) {
          t.equals(members[0], '1', 'The set of a relationship contained a wrong member');
          if (firstDone === true) {
            t.done();
          } else {
            firstDone = true;
          }
        };
        if (!err) {
          t.ok(values.length === 3, 'Linking an object did not create the correct number of keys.');
          redis.smembers(values[0].toString(), keyCheck);
          redis.smembers(values[1].toString(), keyCheck);
        } else {
          console.dir(err);
          t.done();
        }
      });
    } else {
      console.dir(err);
      t.done();
    }
  });
};

exports.unlink = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2 = new RoleLinkMockup(),
  unlinkCallbackCalled = false,
  unlinkCallbackCalled2 = false;
  t.expect(7);

  user.id = 1;
  role.id = 1;
  role2.id = 2;

  user.unlink(role, function (action, on, name, obj) {
    unlinkCallbackCalled = true;
    t.equals(action, 'unlink', 'The argument "action" given to the unlink callback are not correct');
    t.equals(on, 'UserLinkMockup', 'The argument "on" given to the unlink callback are not correct');
    t.equals(name, 'child', 'The argument "name" given to the unlink callback are not correct');
    t.equals(obj, role, 'The argument "obj" given to the unlink callback are not correct');
  });

  user.unlink(role2, function (action, on, name, obj) {
    unlinkCallbackCalled2 = true;
  });

  user.save(function (err) {
    if (!err) {
      t.ok(unlinkCallbackCalled, 'The provided callback for unlinking was not called.');
      t.ok(unlinkCallbackCalled2, 'The provided callback for the second(!) unlinking was not called.');
      redis.keys(relationsprefix + '*', function (err, value) {
        if (!err) {
          var check = (Array.isArray(value) && value.length === 0) || value === null;
          t.ok(check, 'Unlinking an object did not delete keys.');
        }
        t.done();
      });
    } else {
      console.dir(err);
      t.done();
    }
  });
};

exports.deeplink = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  userLinkCallbackCalled = false,
  commentLinkCallbackCalled = false;
  t.expect(5);

  role.link(user, function (action, on, name, obj) {
    userLinkCallbackCalled = true;
  });
  user.link(comment, function (action, on, name, obj) {
    commentLinkCallbackCalled = true;
  });

  role.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    t.ok(userLinkCallbackCalled, 'The user link callback was not called.');
    t.ok(commentLinkCallbackCalled, 'The comment link callback was not called.');
    t.ok(user.id !== null, 'The deeplinked comment does not have an id and thus is probably not saved correctly.');
    t.ok(comment.id !== null, 'The deeplinked comment does not have an id and thus is probably not saved correctly.');
    redis.smembers(relationsprefix + comment.modelName + ':parent:' +
                    user.modelName + ':' + comment.id,
                    function (err, value) {
                      if (!err) {
                        t.equals(value, user.id, 'The comment does not have the neccessary relations saved. There are probably more problems, if this occurs.');
                      } else {
                        console.dir(err);
                      }
                      t.done();
                    });
  });
};

exports.removeUnlinks = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2 = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  linkName = 'creator';
  t.expect(9);
  
  user.p('name', 'removeUnlinks');
  
  user.link(role, linkName);
  user.link(comment);
  role2.link(user);
  
  role2.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    var tmpid = user.id;
    user.remove(function (err) {
      t.ok(!err, 'An unexpected redis error occured.');
      redis.exists(relationsprefix + user.modelName + ':'+linkName+':' +
        role.modelName + ':' + tmpid, function (err, value) {
          t.ok(!err, 'An unexpected redis error occured.');
          t.equals(value, 0, 'The link to the custom-link-name role was not deleted');
          redis.exists(relationsprefix + user.modelName + ':child:' +
            comment.modelName + ':' + tmpid, function (err, value) {
              t.ok(!err, 'An unexpected redis error occured.');
              t.equals(value, 0, 'The link to the child comment was not deleted');
              redis.sismember(relationsprefix + comment.modelName + ':parent:' +
                user.modelName + ':' + comment.id, tmpid,
                function (err, value) {
                  t.ok(!err, 'An unexpected redis error occured.');
                  t.equals(value, 0, 'The link to the comment parent was not deleted');
                  redis.sismember(relationsprefix + role2.modelName + ':child:' +
                                  user.modelName + ':' + role2.id, tmpid,
                                  function (err, value) {
                                    t.ok(!err, 'An unexpected redis error occured.');
                                    t.equals(value, 0, 'The removal did not delete the link from a parent to the object itself.');
                                    t.done();
                                  });
                });
            });
        });
    });
  });
};

exports.has = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup();
  t.expect(1);

  user.link(role);

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    user.has(role, function (err, value) {
      if (err) {
        console.dir(err);
        t.done();
      }
      t.equals(value, true, 'The link was not detected correctly by has()');
      t.done();
    });
  });
};

exports.getAll = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2 = new RoleLinkMockup();
  t.expect(4);

  user.link(role);
  user.link(role2);

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    var should = [role.id, role2.id];
    user.getAll(role.modelName, function (err, values) {
      if (err) {
        console.dir(err);
        t.done();
      }
      t.ok(Array.isArray(values), 'getAll() did not return an array.');
      for (var index, i = 0, len = values.length; i < len; i = i + 1) {
        index = should.indexOf(values[i]);
        t.ok(index !== -1, 'getAll() returned an array with wrong values');
        delete should[index];
        delete values[i];
      }
      t.same(values, should, 'getAll() did not return the correct array');
      t.done();
    });
  });
};

exports.numLinks = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2 = new RoleLinkMockup();
  t.expect(1);

  user.link(role);
  user.link(role2);

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    user.numLinks(role.modelName, function (err, value) {
      if (err) {
        console.dir(err);
        t.done();
      }
      t.same(value, 2, 'The number of links was not returned correctly');
      t.done();
    });
  });
};
 
/* Maybe this isn't such a good idea. I like that model definitions are completely
   lacking relation definitions.
exports.cascadingDeletes = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  testComment = new CommentLinkMockup();
  t.expect(1);

  user.link(role);
  role.link(comment);

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    var testid = comment.id;
    user.remove(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      testComment.load(testid, function (err) {
        t.equals(err, 'not found', 'Removing an object that has cascading deletes did not remove the relations');
        t.done();
      });
    });
  });
};*/