# Nohm

## Warning

You should probably have a look at [biggie-orm](http://github.com/biggie/biggie-orm) since that offers a more complete and probably faster redis ORM.

## Description

Nohm is an object relational mapper (ORM) written for node.js and redis.

It was originally thought to be a node.js implementation of [ohm](http://ohm.keyvalue.org/ "Ruby ORM for redis") but gradually slided away from that approach.

## Install
### If you haven't done this yet: install npm 

    curl http://npmjs.org/install.sh | sh

### Installing nohm

    npm install nohm


## Status

Early in development.

### What currently works: 

  - Creating/updating/removing (including indexes, uniques and sorted indexes)
  - validation
  - and some other small stuff
  - relations
  - retrieving by id
  - finding ids by index/unique

### What does not yet work:

  - probably some other things
  - double-metaphone text search

There is also no documentation or examples yet. For some rough examples you can look at the tests. (test/features.js, test/validations.js and test.relations.js)

## Contribute?

Yes, please contact me or just fork and request pulls. Any help or feedback is appreciated. If you use nohm I'd also be happy if you just drop me a quick msg about it.

## Tests:

    node test/tests.js
