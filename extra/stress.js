var nohm = require(__dirname + '/../').Nohm,
  iterations = 10000;

const redisClient = require('redis').createClient();

redisClient.once('connect', async () => {
  console.log(
    `Starting stress test - saving and then updating ${iterations} models in parallel.`,
  );

  nohm.setPrefix('nohm-stress-test');
  nohm.setClient(redisClient);

  var models = require(__dirname + '/models');
  var UserModel = models.user;

  try {
    await nohm.purgeDb();
  } catch (err) {
    console.error('Failed to purge DB before starting.', err);
    process.exit(1);
  }

  var counter = 0;
  var start = Date.now();
  var startUpdates = 0;
  var users = [];

  var callback = function() {
    counter++;
    if (counter >= iterations) {
      const updateTime = Date.now() - startUpdates;
      const timePerUpdate = iterations / updateTime * 1000;
      console.log(
        `${updateTime}ms for ${counter} parallel User updates, ${timePerUpdate.toFixed(
          2,
        )} updates/second`,
      );
      console.log(`Total time: ${Date.now() - start}ms`);
      console.log('Memory usage after', process.memoryUsage());
      redisClient.SCARD(
        `${nohm.prefix.idsets}${new UserModel().modelName}`,
        async (err, numUsers) => {
          if (err) {
            console.error(
              'Error while trying to check number of saved users.',
              err,
            );
            process.exit(1);
          }
          if (numUsers !== iterations) {
            console.error(
              `Number of users is wrong. ${numUsers} !== ${iterations}`,
              `${nohm.prefix.idsets}${UserModel.modelName}`,
            );
            process.exit(1);
          }
          try {
            await nohm.purgeDb();
          } catch (err) {
            console.error('Failed to purge DB during cleanup.', err);
            process.exit(1);
          }
          console.log('Done.');
          redisClient.quit();
          process.exit();
        },
      );
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
      users[i].property({ name: 'Bob' + i, key: i + i });
      users[i]
        .save()
        .then(callback)
        .catch(errorCallback);
    }
  }

  var saveCallback = function(err) {
    if (err) {
      console.log('error: ' + err);
      process.exit();
    }
    counter++;
    if (counter >= iterations) {
      saveCallback = null;
      const saveTime = Date.now() - start;
      const timePerSave = iterations / saveTime * 1000;
      console.log(
        `${saveTime}ms for ${counter} parallel User saves, ${timePerSave.toFixed(
          2,
        )} saves/second`,
      );
      update();
    }
  };

  for (var i = 0; i < iterations; i++) {
    var user = new UserModel();
    user.property({ name: 'Bob', key: i });
    user
      .save()
      .then(saveCallback)
      .catch(errorCallback);
    users.push(user);
  }
});
