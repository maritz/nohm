# Nohm

## Description

Nohm is an object relational mapper (ORM) written for node.js and redis.

## Install
### If you haven't done this yet: install npm 

    curl http://npmjs.org/install.sh | sh

### Installing nohm

    npm install nohm

## Documentation
http://maritz.github.com/nohm/

## Contribute?

Yes, please contact me or just fork and request pulls. Any help or feedback is appreciated. If you use nohm I'd also be happy if you just drop me a quick msg about it.

## Running tests
To run the tests you need to have nodeunit\@0.1.0:

    npm install nodeunit\@0.1.0

Then run

    node test/tests.js

*Careful*: This requires a running redis server with the default port on the localhost. (a fix for this will come soon)
The tests also create a lot of keys in your database that look something like this: 

    tests:something:something

After the tests have run all keys that match the pattern test:* are deleted!
You can prevent this by passing --no-cleanup (which will leave hundreds or thousands of test keys in your database).
You may also change the prefix (the "test") part doing something like

    node test/tests.js --nohm-prefix YourNewPrefix

Now the keys will look like this:

    YourNewPrefix:something:something
