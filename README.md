# Nohm

[![Build Status](https://travis-ci.org/maritz/nohm.svg?branch=master)](https://travis-ci.org/maritz/nohm)
[![Dependency Status](https://david-dm.org/maritz/nohm.svg)](https://david-dm.org/maritz/nohm)

## Description

Nohm is an object relational mapper (ORM) written for node.js and redis.

## Requirements

* redis >= 2.4

## Install

### Installing nohm

    npm install nohm

## Documentation
http://maritz.github.com/nohm/

## Examples

~~~~ javascript
  var nohm = require('nohm').Nohm;
  var redis = require('redis').createClient();

  nohm.setClient(redis);

  nohm.model('User', {
    properties: {
      name: {
        type: 'string',
        unique: true,
        validations: [
          'notEmpty'
        ]
      },
      email: {
        type: 'string',
        unique: true,
        validations: [
          'email'
        ]
      },
      country: {
        type: 'string',
        defaultValue: 'Tibet',
        validations: [
          'notEmpty'
        ]
      },
      visits: {
        type: function incrVisitsBy(value, key, old) {
          return old + value;
        },
        defaultValue: 0,
        index: true
      }
    },
    methods: {
      getContryFlag: function () {
        return 'http://example.com/flag_'+this.p('country')+'.png';
      },
    }
  });

  var user = nohm.factory('User');
  user.p({
    name: 'Mark',
    email: 'mark@example.com',
    country: 'Mexico',
    visits: 1
  });
  user.save(function (err) {
    if (err === 'invalid') {
      console.log('properties were invalid: ', user.errors);
    } else if (err) {
      console.log(err); // database or unknown error
    } else {
      console.log('saved user! :-)');
      user.remove(function (err) {
        if (err) {
          console.log(err); // database or unknown error
        } else {
          console.log('successfully removed user');
        }
      });
    }
  });

  // try to load a user from the db
  var otherUser = nohm.factory('User', 522, function (err) {
    if (err === 'not found') {
      console.log('no user with id 522 found :-(');
    } else if (err) {
      console.log(err); // database or unknown error
    } else {
      console.log(otherUser.allProperties());
    }
  });
~~~~


* [nohm/examples/rest-user-server](https://github.com/maritz/nohm/tree/master/examples/rest-user-server) (needs express)
* [Beauvoir](https://github.com/yuchi/Beauvoir) Simple project management app - by yuchi

Do you have code that should/could be listed here? Message me!

## Contribute?

Yes, please contact me or just fork and request pulls. Any help or feedback is appreciated. If you use nohm I'd also be happy if you just drop me a quick msg about it.

## Running tests
To run the tests you need to have nodeunit v0.6.4. This will be installed if you installed nohm with the --dev argument.
Otherwise you can run:

    npm install nodeunit@0.6.4

Then run

    node test/tests.js

*Careful*: This requires a running redis server. (you can configure host/port with the command line arguments --redis-host 1.1.1.1 --redis-port 1234)
The tests also create a lot of keys in your database that look something like this:

    nohmtests:something:something

After the tests have run all keys that match the pattern nohmtests:* are deleted!
You can prevent this by passing --no-cleanup (which will leave hundreds or thousands of test keys in your database).
You may also change the prefix ("nohmtests") part doing something like

    node test/tests.js --nohm-prefix YourNewPrefix

Now the keys will look like this:

    YourNewPrefix:something:something
