var nohm = require(__dirname + '/../').Nohm,
  iterations = 10000;

const redisClient = require('redis').createClient();

redisClient.once('connect', function () {
  console.log(`Starting stress test - saving and then updating ${iterations} models in parallel.`);

  nohm.setPrefix('stress');
  nohm.setClient();

  var models = require(__dirname + '/models');
  var UserModel = models.user;

  var counter = 0;
  var start = Date.now();
  var startUpdates = 0;
  var users = [];

  var callback = function () {
    counter++;
    if (counter >= iterations) {
      const updateTime = Date.now() - startUpdates;
      const timePerUpdate = iterations / updateTime * 1000;
      console.log(`${updateTime}ms for ${counter} parallel User updates, ${timePerUpdate.toFixed(2)} updates/second`);
      console.log(`Total time: ${Date.now() - start}ms`);
      console.log('Memory usage after', process.memoryUsage());
      console.log('Done.');
      redisClient.quit();
      process.exit();
    }
  };

  function errorCallback(err) {
    console.log('update error: ' + err);
    process.exit();
  }

  function update() {
    startUpdates = Date.now();
    console.log('Saves done, starting updates');
    counter = 0;
    for (var i = 0, len = users.length; i < len; i++) {
      users[i].property({ name: 'Bob' + i, key: i + i })
      users[i].save().then(callback).catch(errorCallback);
    }
  }

  var saveCallback = function (err) {
    if (err) {
      console.log('error: ' + err);
      process.exit();
    }
    counter++;
    if (counter >= iterations) {
      saveCallback = null;
      const saveTime = Date.now() - start;
      const timePerSave = iterations / saveTime * 1000;
      console.log(`${saveTime}ms for ${counter} parallel User saves, ${timePerSave.toFixed(2)} saves/second`);
      update();
    }
  };

  for (var i = 0; i < iterations; i++) {
    var user = new UserModel();
    user.property({ name: 'Bob', key: i });
    user.save().then(saveCallback).catch(errorCallback);
    users.push(user);
  }

});
