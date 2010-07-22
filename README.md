
# Nohm

## Description

Nohm is an object relational mapper (ORM) written for node.js and redis.

It was originally thought to be a node.js implementation of [ohm](http://ohm.keyvalue.org/ "Ruby ORM for redis") but gradually slided away from that approach.

## Status

Very early in development.
### What currently works: 

  - Creating/updating/removing (including indexes, uniques and sorted indexes)
  - validation
  - and some other small stuff

### What does not yet work:

  - relations
  - retrieving/finding of objects
  - probably some other things
  - double-metaphone text search

There is also no documentation or examples yet. For some rough examples you can look at the tests. (test/features.js and test/validations.js)

## Contribute?

Yes, please contact me or just fork and request pulls. Any help or feedback is appreciated.

## Tests:

    node test/tests.js
