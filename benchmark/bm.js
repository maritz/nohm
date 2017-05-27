/*
  Installation : npm install --save-dev fastbench async 
*/

nohm = require('../lib/nohm').Nohm;

var bench = require('fastbench'),
    models = require('./bm_models'),
    rclient = require('redis').createClient(),
    async = require('async'),
    childProcess = require('child_process'),
    os = require('os');

// Params

var u_ids = null;
var u_instances = null;
var item = null;
var has_zlink = false;
var opt = {score: +new Date()};
var ncreate = 2000;

nohm.setPrefix('benchmark');
rclient.select(15);

rclient.on("ready", function (err) {
  nohm.setClient(rclient);
  
  var pathToRedis = require.resolve('redis');
  pathToRedis = pathToRedis.substring(0, pathToRedis.lastIndexOf("/"));

  /* copied from https://github.com/luin/ioredis/blob/master/benchmarks/single_node.js */
  console.log('==========================');
  console.log('CPU: ' + os.cpus().length);
  console.log('Nohm version: ' + require('../package.json').version);
  console.log('Redis client version: ' + require(pathToRedis + '/package.json').version);
  console.log('Redis server version: ' + rclient.server_info.redis_version);
  console.log('OS: ' + os.platform() + ' ' + os.arch());
  console.log('node version: ' + process.version);
  console.log('current commit: ' + childProcess.execSync('git rev-parse --short HEAD').slice(0, -1));
  console.log('==========================');

  run();
})

// Models

var UserMockup = models.user;
var ItemMockup = models.item;

// Tests

function run()
{
  var prepare_create = function(done){
    console.log('[+] Creating ', ncreate, ' nohm objects');
    done()
  }
  var run_create = bench([
    function modelCreateManual (done) {
      var u = new models.user();
      u.p('username', 'test')
      u.save(function(){
        done()
      })
    },
    function modelCreateFactory (done) {
      var u = nohm.factory('UserMockup')
      u.p('username', 'test')
      u.save(function(){
        done()
      })
    },
  ], ncreate)

  var prepare_read = function(done){
    UserMockup.find({}, function(err, ids){
      u_ids = ids;
      console.log('\n[+] Reading ', u_ids.length, ' uids');
      done()
    })
  }

  var run_read = bench([
    function modelReadLoad (done) {
      async.each(u_ids, function(uid, next){
        UserMockup.load(uid, function(){
          next()
        })
      }, function(){
        done();
      })
    },
    function modelReadFactory (done) {
      async.each(u_ids, function(uid, next){
        nohm.factory('UserMockup', uid, function(){
          next()
        })
      }, function(){
        done();
      })
    },
  ], 1)

  var prepare_update = function(done){
    UserMockup.findAndLoad({}, function(err, instances){
      u_instances = instances;
      console.log('\n[+] Updating ', u_instances.length, ' objects');
      done()
    })
  }

  var run_update = bench([
    function modelUpdate (done) {
      async.each(u_instances, function(user, next){
          user.p('username', 'aaaaaaaa');
          user.save(function(){
            next();
          })
      }, function(){
        done();
      })
    },
  ], 1)

  var prepare_link = function(done){
    console.log('\n[+] Linking ', u_instances.length, ' objects to same object')
    if (u_instances[0].zlink) has_zlink = true;
    item = nohm.factory('ItemMockup')
    item.p('name', 'item blabla')
    item.save(function(){
      done()
    })
  }

  var run_link = bench([
    function modelLink (done) {
      async.each(u_instances, function(user, next){
          user.link(item)
          user.save(function(err, link_err){
            next();
          })
      }, function(err){
        done();
      })
    },
    function modelZlink (done) {
      if (has_zlink)
      {
        async.each(u_instances, function(user, next){
            user.zlink(item, opt);
            user.save(function(){
              next();
            })
        }, function(){
          done();
        })        
      }
      else
      {
        console.log('zlink feature not detected, passing test')
        done();
      }
    },
  ], 1)

  var prepare_unlink = function(done){
    console.log('\n[+] Unlinking ', u_instances.length, ' links');
    done()
  }

  var run_unlink = bench([
    function modelUnlink(done) {
      async.each(u_instances, function(user, next){
          user.unlink(item)
          user.save(function(){
            next();
          })
      }, function(){
        done();
      })
    },
    function modelZunlink(done) {
      if (has_zlink)
      {
        async.each(u_instances, function(user, next){
            user.zunlink(item);
            user.save(function(){
              next();
            })
        }, function(){
          done();
        })
      }
      else
      {
        console.log('zunlink feature not detected, passing test')
        done();
      }
    },
  ], 1)
  
  var prepare_delete = function(done){
    console.log('\n[+] Deleting ', u_instances.length, ' objects');
    done()
  }
  var run_delete = bench([
    function modelRemove (done) {
      async.each(u_instances, function(user, next){
          user.remove(function(){
            next();
          })
      }, function(){
        done();
      })
    },
  ], 1)

  var clean_link = function(done){
    item.remove(function(){
      done()
    })
  }

  // run them two times
  async.series([
    prepare_create,
    run_create,

    prepare_read,
    run_read,

    prepare_update,
    run_update,

    prepare_link,
    run_link,

    prepare_unlink,
    run_unlink,

    prepare_delete,
    run_delete,

    clean_link,
  ], function(){
    console.log('test ended!')
    rclient.quit();
  })
}
