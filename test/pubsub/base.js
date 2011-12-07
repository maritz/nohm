
var redis = require('redis'),
	nohm = require(__dirname+'/../../lib/nohm').Nohm;

var client1 = redis.createClient(),
	client2 = redis.createClient();

nohm.setClient(client1);
nohm.setPubSubClient(client2);

nohm.setPrefix('tests');

nohm.initializePubSub();

var Tester = nohm.model('Tester',{
	properties: {
		dummy: {
			type: 'string'
		}
	}
});

Tester.subscribe('create', function(){
	console.dir(arguments);
})

module.exports.nohm = nohm;
module.exports.client1 = client1;
module.exports.client2 = client2;
module.exports.Tester = Tester;
