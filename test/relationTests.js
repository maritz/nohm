var nohm = require(__dirname+'/../lib/nohm').Nohm;
var args = require(__dirname+'/testArgs.js');
var async = require('async');
var redis = args.redis;
var h = require(__dirname+'/helper.js');
var relationsprefix = nohm.prefix.relations;
var UserLinkMockup = nohm.model('UserLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: [
        'notEmpty'
      ]
    }
  },
  idGenerator: 'increment'
});
var CommentLinkMockup = nohm.model('CommentLinkMockup', {
  properties: {
    text: {
      type: 'string',
      defaultValue: 'this is a comment! REALLY!',
      validations: [
        'notEmpty'
      ]
    }
  }
});
var RoleLinkMockup = nohm.model('RoleLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'user'
    }
  },
  idGenerator: 'increment'
});


exports.relation = {
  
  setUp: function (next) {
    if ( ! nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },
  
  
  instances: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    role2;

    t.expect(2);

    role.link(user);

    t.ok(role.relationChanges !== user.relationChanges, 'Instances share the relationchanges, initiate them as an empty array in the constructor.');

    role2 = new RoleLinkMockup();
    t.same(role2.relationChanges, [], 'Creating a new instance does not reset the relationchanges of that instance.');

    t.done();
  },
  
  
  link: function (t) {
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
      t.equals(name, 'default', 'The argument "name" given to the link callback are not correct');
      t.same(obj, role, 'The argument "obj" given to the link callback are not correct');
    });
  
    role2.p('name', 'test');
  
    user.link(role2, function () {
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
  },
  
  unlink: function (t) {
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
      t.equals(name, 'default', 'The argument "name" given to the unlink callback are not correct');
      t.equals(obj, role, 'The argument "obj" given to the unlink callback are not correct');
    });
  
    user.unlink(role2, function (action, on) {
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
        console.dir(user.errors);
        t.done();
      }
    });
  },
  
  deeplink: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    comment = new CommentLinkMockup(),
    userLinkCallbackCalled = false,
    commentLinkCallbackCalled = false;
    t.expect(5);
  
    role.link(user, function () {
      userLinkCallbackCalled = true;
    });
    user.link(comment, function () {
      commentLinkCallbackCalled = true;
    });
  
    role.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      t.ok(userLinkCallbackCalled, 'The user link callback was not called.');
      t.ok(commentLinkCallbackCalled, 'The comment link callback was not called.');
      t.ok(user.id !== null, 'The deeplinked user does not have an id and thus is probably not saved correctly.');
      t.ok(comment.id !== null, 'The deeplinked comment does not have an id and thus is probably not saved correctly.');
      redis.smembers(relationsprefix + comment.modelName + ':defaultForeign:' +
                      user.modelName + ':' + comment.id,
                      function (err, value) {
                        if (!err) {
                          t.equals(value, user.id, 'The user does not have the neccessary relations saved. There are probably more problems, if this occurs.');
                        } else {
                          console.dir(err);
                        }
                        t.done();
                      });
    });
  },
  
  removeUnlinks: function (t) {
    // uses unlinkAll in remove
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    role2 = new RoleLinkMockup(),
    comment = new CommentLinkMockup(),
    linkName = 'creator';
    t.expect(8);
    
    user.p('name', 'removeUnlinks');
    
    role.link(user, linkName);
    user.link(role, 'isA');
    user.link(comment);
    role2.link(user);
    
    role2.save(function (err) {
      t.ok(!err, 'there was an unexpected error while saving.');
      var tmpid = user.id;
      user.remove(function (err) {
        t.ok(!err, 'An unexpected redis error occured.');
        async.parallel([
          function (next) {
            redis.exists(relationsprefix+user.modelName+':'+linkName+'Foreign:'+role.modelName+':'+tmpid, 
              function (err, value) {
                t.equals(value, 0, 'The foreign link to the custom-link-name role was not deleted');
                next(err);
            });
          },
          function (next) {
            redis.exists(relationsprefix+role.modelName+':'+linkName+':'+user.modelName+':'+role.id, 
              function (err, value) {
                t.equals(value, 0, 'The link to the custom-link-name role was not deleted');
                next(err);
            });
          },
          function (next) {
            redis.exists(relationsprefix+user.modelName+':default:'+comment.modelName+':'+tmpid, 
              function (err, value) {
                t.equals(value, 0, 'The link to the child comment was not deleted');
                next(err);
            });
          },
          function (next) {
            redis.sismember(relationsprefix+comment.modelName+':defaultForeign:'+user.modelName+':'+comment.id, tmpid,
              function (err, value) {
                t.equals(value, 0, 'The link to the comment parent was not deleted');
                next(err);
            });
          },
          function (next) {
            redis.sismember(relationsprefix+role2.modelName+':default:'+user.modelName+':'+role2.id, tmpid,
              function (err, value) {
                t.equals(value, 0, 'The removal did not delete the link from a parent to the object itself.');
                next(err);
              }
            );
          }],
          function (err) {
            t.ok(!err, 'An unexpected redis error occured.');
            t.done();
          }
        );
      });
    });
  },
  
  belongsTo: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup();
    t.expect(1);
  
    user.link(role);
  
    user.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      user.belongsTo(role, function (err, value) {
        if (err) {
          console.dir(err);
          t.done();
        }
        t.equals(value, true, 'The link was not detected correctly by belongsTo()');
        t.done();
      });
    });
  },
  
  getAll: function (t) {
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
  },
  
  'getAll with different id generators': function (t) {
    var user = new UserLinkMockup(),
    comment = new CommentLinkMockup();
    t.expect(1);
  
    user.link(comment);
  
    user.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      var should = [comment.id];
      user.getAll(comment.modelName, function (err, values) {
        if (err) {
          console.dir(err);
          t.done();
        }
        t.same(values, should, 'getAll() did not return the correct array');
        t.done();
      });
    });
  },
  
  numLinks: function (t) {
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
  },
  
  
  deeplinkError: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    comment = new CommentLinkMockup();
    t.expect(5);
  
    role.link(user);
    user.link(comment);
    comment.p('text', ''); // makes the comment fail
  
    role.save(function (err, childFail, childName) {
      t.ok(user.id !== null, 'The deeplinked user does not have an id and thus is probably not saved correctly.');
      t.same(comment.id, null, 'The deeplinked erroneous comment does not have an id and thus is probably saved.');
      t.same(err, 'invalid', 'The deeplinked role did not fail.');
      t.same(childFail, true, 'The deeplinked role did not fail in a child or reported it wrong.');
      t.same(childName, 'CommentLinkMockup', 'The deeplinked role failed in the wrong model or reported it wrong.');
      t.done();
    });
  },
  
  linkToSelf: function (t) {
    var user = new UserLinkMockup();
    t.expect(1);
  
    user.link(user);
  
    user.save(function (err) {
      t.ok(!err, 'Linking an object to itself failed.');
      t.done();
    });
  },
  
  deppLinkErrorCallback: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    comment = new CommentLinkMockup();
    t.expect(8);
  
    role.link(user, {
      error: function (err, errors, obj) {
        console.log(err, errors, obj.allProperties())
        t.ok(false, 'Error callback for role.link(user) called even though user is valid.');
      }
    });
    user.link(comment, {
      error: function (err, errors, obj) {
        t.same(err, 'invalid', 'err in error callback was not "invalid"');
        t.same(errors, comment.errors, 'errors in error callback was not comment.errors');
        t.same(comment, obj, 'obj in Error callback was not the right object.');
      }
    });
    comment.p('text', ''); // makes the comment fail
  
    role.save(function (err, childFail, childName) {
      t.ok(user.id !== null, 'The deeplinked user does not have an id and thus is probably not saved correctly.');
      t.same(comment.id, null, 'The deeplinked erroneous comment does not have an id and thus is probably saved.');
      t.same(err, 'invalid', 'The deeplinked role did not fail.');
      t.same(childFail, true, 'The deeplinked role did not fail in a child or reported it wrong.');
      t.same(childName, 'CommentLinkMockup', 'The deeplinked role failed in the wrong model or reported it wrong.');
      t.done();
    });
  },
  
  contineOnError: function (t) {
    var user = new UserLinkMockup(),
    role = new RoleLinkMockup(),
    comment = new CommentLinkMockup(),
    comment2 = new CommentLinkMockup(),
    comment3 = new CommentLinkMockup();
    t.expect(5);
  
    role.link(user, {
      error: function (err, errors, obj) {
        console.log(err, errors, obj.allProperties())
        t.ok(false, 'Error callback for role.link(user) called even though user is valid.');
      }
    });
    user.link(comment, {
      error: function (err, errors, obj) {
        t.same(err, 'invalid', 'err in error callback was not "invalid"');
        t.same(errors, comment.errors, 'errors in error callback was not comment.errors');
        t.same(comment, obj, 'obj in Error callback was not the right object.');
      }
    });
    user.link(comment2, {
      error: function (err, errors, obj) {
        console.log(err, errors, obj.allProperties())
        t.ok(false, 'Error callback for comment2.link(user) called even though user is valid.');
      }
    });
    user.link(comment3, {
      error: function (err, errors, obj) {
        console.log(err, errors, obj.allProperties())
        t.ok(false, 'Error callback for comment3.link(user) called even though user is valid.');
      }
    });
    comment.p('text', ''); // makes the first comment fail
  
    role.save({continue_on_link_error: true}, function () {
      redis.sismember(relationsprefix+comment3.modelName+':defaultForeign:'+user.modelName+':'+comment3.id, user.id,
        function (err, value) {
          t.ok(!err, 'There was a redis error');
          t.same(value, "1", 'The comment3 relation was not saved');
          t.done();
        }
      );
    });
  }
};
 
/* Maybe this isn't such a good idea. I like that model definitions are completely
   lacking relation definitions.
cascadingDeletes: function (t) {
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