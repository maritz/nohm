var nohm        = require('../lib/nohm'),
    iterations = 1000, // Around 1k total model inserts.
    user;

var models = require('./models');
var UserModel    = models.user;

var buffer = new Buffer('some randome data alksjd as jdlkasj dlaksj dlkas jdkl ajslkd jaslkj doaisjoiawj doi awjd owa');

var counter = 0;
var start = + new Date();
var users = [];

var update = function update () {
  counter = 0;
  for (var i = 0, len = users.length; i < len; i++) {
    users[i].save(function (err) {
      if (err) {
        console.log('update error: ' + err);
        process.exit();
      }
      counter++;
      if (counter >= iterations) {
        console.log((+ new Date()) - start);
        console.log('done');
        process.exit();
      }
    });
  }
}

for (var i = 0; i < iterations; i++) {
  users[i] = new UserModel();
  users[i].p({name: 'Bob', key: i});
  users[i].save(function (err) {
    if (err) {
      console.log('error: ' + err);
      process.exit();
    }
    counter++;
    if (counter >= iterations) {
      update();
    }
  });
}

