# Nohm

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

* [nohm/examples/rest-user-server](https://github.com/maritz/nohm/tree/master/examples/rest-user-server) very basic user example (needs express)
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
