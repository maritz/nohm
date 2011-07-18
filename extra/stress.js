var nohm        = require(__dirname+'/../lib/nohm').Nohm,
    iterations = 100000,
    user;
    
nohm.setPrefix('stress');
nohm.setClient(require('redis').createClient());

var models = require(__dirname+'/models');
var UserModel    = models.user;

var counter = 0;
var start = + new Date();
var users = [];

var callback = function (err) {
  if (err) {
    console.log('update error: ' + err);
    process.exit();
  }
  counter++;
  if (counter >= iterations) {
    console.log((+ new Date()) - start+' ms for '+counter+' User saves and an equal amount of updates.');
    console.log('done');
    process.exit();
  }
};

var update = function update () {
  counter = 0;
  for (var i = 0, len = users.length; i < len; i++) {
    users[i].save(callback);
  }
};

var save = function (err) {
  if (err) {
    console.log('error: ' + err);
    process.exit();
  }
  counter++;
  process.stdout.write("\r"+counter);
  if (counter >= iterations) {
    //update();
    console.log('done');
    console.log((+ new Date()) - start+' ms for '+counter+' User saves and an equal amount of updates.');
    nohm.client.quit();
  }
};

for (var i = 0; i < iterations; i++) {
  var user = new UserModel();
  user.p({name: 'Bob', key: i});
  user.save(save);
  delete user;
}

