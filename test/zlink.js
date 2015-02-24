var nohm = require(__dirname+'/../lib/nohm').Nohm;
var redisC = require('redis').createClient()

nohm.setClient(redisC)

var User = nohm.model('User', {
	properties: {
	    name: {
			type: 'string',
			defaultValue: 'testName',
	    	index: true,
	      	unique: true,
	    },
	},
	idGenerator: 'increment',
});

var Location = nohm.model('Location', {
	properties: {
		city: {
			type: 'string',
			defaultValue: 'Unknown',
			index: true,
			unique: true,
		},
  	},
	idGenerator: 'increment',
});

function defaultvalue(cb){
	user = new User()
	user.p('name', 'Samir')
	user.save(
		function(err){
			if (err)
				cb('error saving user model: ' + err)
			else
			{
				loc = new Location() 
				loc.p('city', 'Paris')
				loc.save(function(err){
					if (err)
						cb('error saving location model: ' + err)
					else
						cb(null)
				})
			}
	}) // save
}

redisC.on("ready", function (err) {
	console.log("connection ready")

	defaultvalue(function(err){
		if (err)
			console.log("[-] Error during populate\n", err)

		// loading user
		nohm.factory('User', 1, function(err){
			
			userSelf = this

			// loading location
			nohm.factory('Location', 1, function(err){
				locationSelf = this

				console.log("zlinking ", userSelf.p('name'), " model to ", locationSelf.p('city'))

				// linking
				userSelf.link(locationSelf, { name:'link',
												score: (new Date().getTime())
											 })

				// linking
				userSelf.zlink(locationSelf, { name:'zlink',
												score: (new Date().getTime())
											 })

				userSelf.save(function(err, islink, link_error){
					if (err)
						console.log('error linking :', err, islink, link_error, this.errors)
					else
						console.log("Yeah zlink done!")
				})
			})
		})
	})
})