# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.0.0](https://github.com/maritz/nohm/compare/v2.2.3...v3.0.0) (2022-02-28)


### ⚠ BREAKING CHANGES

* Dropping support vor node v8. Now requires at least node v12.

### Bug Fixes

* tests: check for both old and new error message text ([b2c8f2c](https://github.com/maritz/nohm/commit/b2c8f2c5362ff6d944cd0f2b2802ac76d2687264))
* example-app: make example app usable on new setup ([5ca2cf7](https://github.com/maritz/nohm/commit/5ca2cf7f22b415856d0e338d5bc769e72f6b8d4d))
* example-app: route name to nohmexample ([1b6130b](https://github.com/maritz/nohm/commit/1b6130bf3a5104ce53fed0b64f585b36b39442e8))
* example-app: some example app fixes ([4be4250](https://github.com/maritz/nohm/commit/4be4250864cf08b47f4988726d7a74b2d2ce8b1c))


### Other

* **deps-dev:** bump standard-version from 6.0.1 to 8.0.1 ([#158](https://github.com/maritz/nohm/issues/158)) ([64aa5c1](https://github.com/maritz/nohm/commit/64aa5c124c4405ede8c509d2d539b0bb7ab1adcd))
* **deps:** bump acorn from 6.4.0 to 6.4.1 ([#155](https://github.com/maritz/nohm/issues/155)) ([1ada7c9](https://github.com/maritz/nohm/commit/1ada7c9d1c718c4f8408d9dc530aa7c20bf9496d))
* **deps:** bump lodash from 4.17.15 to 4.17.19 ([#159](https://github.com/maritz/nohm/issues/159)) ([3031dac](https://github.com/maritz/nohm/commit/3031dac8f8cafc6b99dfc31efbfee498940f4a7d))
* drop support for node v8 ([2931b44](https://github.com/maritz/nohm/commit/2931b440da1d2c49da39b81e01542693418b8799))
* remove david-dm dependency status since it was discontinued ([396254c](https://github.com/maritz/nohm/commit/396254ce62c2acfea808e8a1af4b33c398f33508))
* remove travis-ci since it was discontinued ([4e74216](https://github.com/maritz/nohm/commit/4e74216649efde7aac4f65967cb72ded7a0843b3))
* some security fixes and locking @types/node until major TS upgrade is possible ([674d5aa](https://github.com/maritz/nohm/commit/674d5aa73b93c4ab6d9507b1b42fc70db6de5e71))
* update dependencies ([5957c5f](https://github.com/maritz/nohm/commit/5957c5f260523d94c13c6c3dc4cfd8c4ae6bd2b9))
* update dependencies and fix tests for new ava ([853e7cb](https://github.com/maritz/nohm/commit/853e7cb0884a286231c4a557b3bd6caf009a025e))
* update dependencies of example rest server ([e443aa3](https://github.com/maritz/nohm/commit/e443aa34bb7d26bea822798ecc39c6b2409185f5))

### [2.2.3](https://github.com/maritz/nohm/compare/v2.2.2...v2.2.3) (2019-12-07)


### Other

* update dependencies ([9e28398](https://github.com/maritz/nohm/commit/9e28398))
* **deps:** bump lodash from 4.17.11 to 4.17.13 ([466713a](https://github.com/maritz/nohm/commit/466713a))
* **deps:** bump lodash in /examples/rest-user-server ([9d082a3](https://github.com/maritz/nohm/commit/9d082a3))
* **deps:** bump lodash.template from 4.4.0 to 4.5.0 ([c0a17ce](https://github.com/maritz/nohm/commit/c0a17ce))



### [2.2.2](https://github.com/maritz/nohm/compare/v2.2.1...v2.2.2) (2019-06-02)


### Other

* reduce meta update performance impact ([58535d1](https://github.com/maritz/nohm/commit/58535d1))
* update dependencies ([594c786](https://github.com/maritz/nohm/commit/594c786))

## [2.2.1](https://github.com/maritz/nohm/compare/v2.2.0...v2.2.1) (2018-12-30)

## [2.2.0](https://github.com/maritz/nohm/compare/v2.1.0...v2.2.0) (2018-09-07)


### Features

* add ioredis support ([f4fa805](https://github.com/maritz/nohm/commit/f4fa805))

## [2.1.0](https://github.com/maritz/nohm/compare/v2.0.1...v2.1.0) (2018-07-14)

### Features

* add typings for subscribe callback payloads ([1069059](https://github.com/maritz/nohm/commit/1069059))

### [2.0.1](https://github.com/maritz/nohm/compare/v2.0.0...v2.0.1) (2018-06-21)


### Bug Fixes

* middleware.validate throwing uncaught when data is undefined ([819865b](https://github.com/maritz/nohm/commit/819865b))

# [2.0.0](https://github.com/maritz/nohm/compare/v1.0.0...v2.0.0) (2018-06-10)

## BREAKING CHANGES

### Node version >= 8

nohm v0.9 / v1.x supports node versions all the way back to v0.10 and is tested in our CI environments as such.

nohm v2 onwards will restrict this to more current versions of node. At the time of this writing all tests pass on node 8.x, 9.x and 10.x.  
For now the CI will stay set up to **support 8.x, lts/\* (currently 8.x as well) and stable (currently v10)**. When/if support for 8.x is cancelled, this will be another breaking change and declared as such.

### Promises

All callbacks have been changed to promises (except events and link optional callbacks).

To migrate your code, replace callback functions with promise handlers.

Old:

```javascript
instance.load(123, (err, props) => {
  console.log(err, props);
});
```

New:

```typescript
try {
  const props = await modelInstance.load(123);
  console.log(props);
} catch (err) {
  console.log(err);
}
```

### Performance

Sadly the performance of Promises in v8 and node is still not on par with callbacks.

Currently in node v9 nohm@1 is almost twice as fast as nohm@2 at the very simple benchmark in extra/stress.js. In my test nohm@1 does ~21-22k ops/s, while nohm@2 does ~12-13k ops/s.

However node v10 brought great improvements for both: nohm@1 does 28-31k ops/s and nohm@2 does 21-22k ops/s.

The improvements in code readability of Promises versus pure callbacks or caolan/async callbacks makes quite a difference though. As such it seems worth it to switch to Promises and hope for even more performance improvements from v8/node and nohm.

More nohm performance optimizations are planned and any help is very welcome!

### Default IDs

Previously, default ids were a custom random implementation, that wasn't very safe. Now uuid v1 is used by default.

Existing default ids should still work with the new versions, but any new default ids created after the update will be uuid v1.

### Validation definitions

The format for validations was previously based on arrays, and strict indices had to be maintained for different parts of the definition.

Now validation definitions are objects and have proper keys.

Old:

```javascript
someProperty: {
  type: 'integer',
  defaultValue: 5,
  validations: [
    [
      'minMax',
      {
        min: 2,
        max: 20
      }
    ]
  ]
},
```

New:

```javascript
someProperty: {
  type: 'integer',
  defaultValue: 5,
  validations: [
    {
      name: 'minMax',
      options: {
        min: 2,
        max: 20
      }
    }
  ]
},
```

### Error handling

Previously there were cases where an error without a callback would just log out something about it and then continue on.

Now with Promises the behavior will be similar (built-in unhandled rejection log) until Node.js starts to treat unhandled rejection by terminating the process.

#### Validation

Validation failures during `save()` previously returned a string 'invalid' and the errors then had to be checked in `instance.errors`.

Now validation failures during `save()` reject with a ValidationError.

Old:

```javascript
instance.save((err) => {
  if (err) {
    if (err === 'invalid') {
      console.log('validation failed. reasons:', instance.errors);
    } else {
      console.error('saving failed with unknown error:', err);
    }
  } else {
    console.log('success!');
  }
});
```

New:

```typescript
try {
  await instance.save();
  console.log('success!');
} catch (err) {
  if (err instanceof nohm.ValidationError) {
    console.log('validation failed. reasons:', err.errors); // or instance.errors still, if you prefer
  } else {
    console.error('saving failed with unknown error:', err);
  }
  console.log(err);
}
```

#### Linking errors

Previously linking errors had 2 different ways to be handled, controlled via the continue_on_link_error option.

This meant that either all linked objects were attempted to be stored, regardless of a failure in any linked object saving and success callback was called _or_ as soon as one failed, no more links were stored during that save call and an immediate error callback would be issued.

The new behavior is that it always attempts to save all linked objects in series (not parallel), but if any of them fail a rejection is issued _at the end of the saving process_. The reason it is done in series is that it makes saves more predictable (and thus testable) and it reduces the risk of race-conditions in the link chain.

This makes it abundantly clear that you are in an error state while at the same time allowing for recovery by inspecting the failures and acting accordingly.

A LinkError object is an extension of Error and additionally contains an "errors" array:

```javascript
linkError.errors ==
  [
    {
      parent: NohmModel, // the instance on which .link() was performed
      child: NohmModel, // the instance that was given to .link() as argument
      error: Error | ValidationError | LinkError, // the error that occurred while saving child.
    },
  ];
```

In addition the callbacks that can be provided to the .link() call options object receive different arguments now. The errors array from the linked object is not passed separately as the second argument anymore, instead it is just the thrown Error object as first argument and the linked object instance as second.

Old:

```javascript
instance.link(other, {
  error: (err, errors, linkedInstance) => {
    errors === linkedInstance.errors && other === linkedInstance;
  },
});
```

New:

```javascript
instance.link(other, {
  error: (err, linkedInstance) => {
    other === linkedInstance;
  },
});
```

### Other breaking changes

- `model.load()` and `instance.load()` now return the same as .allProperties(), meaning the id field is now included in addition to the normal properties
- `instance.valid()` was renamed to `instance.validate()`.
- `instance.allProperties()` no longer has a json option (it stringified the return)
- `instance.propertyReset()` no longer returns anything (previously always true)
- `nohm.factory()` was previously only async if an id was provided - now it always returns a Promise, regardless of arguments provided
- `instance.remove()` now sets `instance.id` property to null instead of 0. (this previously potentially caused issues with integer ids starting at 0)
- The constructor for a model instance can no longer be used to immediately load the model by passing an id+callback. Use `nohm.factory()` instead or constructor and `instance.load()` afterwards.
- passing invalid search keys (aka. property names that aren't defined as indexed) to `.find()` now throws an error instead of logging an error and returning an empty array.
- `nohm.connect()` is renamed to `nohm.middleware()`
- `nohm.middleware()` assumes that you are targeting browsers that have Promise support or that you have a Promise shim.
- `.findAndLoad()` now returns an empty array if no instances are found instead of producing an error. This makes the behavior the same in `find()` and `findAndLoad()`.
- `instance.id` is now a getter/setter that always returns null (no id set) or a string
- the new `instance.isLoaded` is true when the instance has been loaded or saved at least once and `instance.id` has not been manually changed.
- the new `instance.isDirty` is true when anything was done on the model that would require a .save() to persist it (changing .id, properties, pending relation changes)
- custom ID generators _must_ resolve with strings that do **not** contain double colons (:)
- timestamp/time values now always get cast to string representations of unix time in milliseconds instead of only after loading
- behaviors (type functions) now always get strings as arguments, even if defaultValue or initialization would cast it differently
- the regexp validator now only takes valid RegExp objects as the .regex option and resolves with an error

## Non-breaking changes

- `instance.p()` and `instance.prop()` have been deprecated. `instance.property()` is the only version going forward.
- some bugs fixed
- updated dependencies

### Typescript

Almost the entire code base was rewritten in Typescript.

This means typing your models is now a lot easier. For additional examples of the typing possibilities, see the [README.md examples](https://github.com/maritz/nohm/blob/master/README.md#example) or the [Typescript tests](https://github.com/maritz/nohm/blob/master/ts/tests.ts).

# v1.0.0 - 2018/05/25

Nohm v1 is published without any major change from v0.9.8.
v1.0.x will be maintenance (critical bugs) only.
There is a branch `v1_breaking_maintenance` that will be used for fixing issues on the v1 branch that require breaking changes.

v2 and onwards will be the typescript rewrite and has a few breaking changes.

- Fixes unlinkAll() (and thus remove()) not working properly with some id types.
- Fixes custom validation function name parsing in node v10+

# v0.9.8 - 2016/02/06

- Add instance context to custom validators. (thanks johngeorgewright)

  ```javascript
  exports.instanceValidation = function(value, opt, callback) {
    if (this.id < 50) {
      callback(true);
    } else {
      callback(this.p(opt.property).includes(value));
    }
  };
  ```

- Update dependencies (thanks brysgo)
  - redis 2.4.2
  - (dev) nodeunit 0.9.1

# v0.9.8 - 06.02.2016

- Add instance context to custom validators. (thanks johngeorgewright)

  ```javascript
  exports.instanceValidation = function(value, opt, callback) {
    if (this.id < 50) {
      callback(true);
    } else {
      callback(this.p(opt.property).includes(value));
    }
  };
  ```

- Update dependencies (thanks brysgo)
  - redis 2.4.2
  - (dev) nodeunit 0.9.1

# v0.9.7 - 09.05.2015

- BREAKS BACKWARDS COMPATIBILITY! (but only slightly and shouldn't really be an issue for most uses)
- Fix for date parsing - only affects ISO date strings of format that has ' +HH:MM' or ' -HH:MM' at the end) and only on machines that are not set UTC (which servers usually are)
- Update async & nodeunit dependencies

# v0.9.6 - 05.09.2014

- Add save option skip_validation_and_unique_indexes (thanks RoxasShadow)
- Bug fixes (thanks exortech)
- Update dependencies

# v0.9.3 - 06.07.2013

- Add endpoints option to find() (thanks to interruptz)
- Add min>max options to find() that trigger descending search (thanks to interruptz)
- Add return of the instance on shortform functions
- Remove checking and setting meta.version on every model init
- Bug fixes

# v0.9.2 - 04.12.2012

- Add findAndLoad as a convenience method
- Fix a problem with getAll if different idGenerators were used

# v0.9.1 - 21.08.2012

- Fix uniques to now be completely case-insensitive

# v0.9.0 - 06.06.2012

- setClient/getClient now issue warnings on unconnected clients
- Bug fixes

# v0.9.0-pre3 - 04.03.2012

- Support for common variants on bool/string/integer/timestamp
- Bug fixes

# v0.9.0-pre - 2012-03-14

- BREAKS BACKWARDS COMPATIBILITY! change relation names for clearer handling ("child" is now "default", "xyzParent" is now "xyzForeign")
- Added error handler to link/unlink
- Bug fixes

# v0.7.2 - 2012-01-19

- add .sort()

# v0.7.1

- Fix unique handling bugs

# v0.7.0

- BREAKS BACKWARDS COMPATIBILITY! change validate() to be async only (validations all need to be async now), also changed validation usage syntax (see docs)
- add nohm.connect() connect middleware that delivers browser validation js
- Fix empty strings being locked on unique properties
- Fix uniques to be case insensitive

# v0.6.4

- unique values are now case insensitive when validating or searching
- now compatible with node v0.6.3
- now uses nodeunit v0.6.4

# v0.6.3

- add Nohm.factory(modelName, [id, callback])
- update redis dependency to 0.7.1

# v0.6.1 & v0.6.2

- bug fixes

# v0.6

- changed id generation to unique strings by default (BREAKS BACKWARDS COMPATIBILITY)
- added ability to choose from different id generation mechanisms (for example incremental or custom functions)
- added short forms of functions where you don't need to create a new instance first to save/load/find/remove
- changed `this` in callbacks to be the instance you manipulated/loaded
- bug fixes

# v0.5

- "value" in model properties renamed to "defaultValue"
- "has()" renamed to "belongsTo()"
- bug fixes

# v0.4

- documentation
- added instance.exists(id, callback)
- added Nohm.setPrefix(prefix) to set the global redis prefix (default "nohm")
- added Nohm.setClient(client) & Nohm.getClient() to set/get the global redis client (no default!)
- removed instance.partialSave()
- removed admin app (now in https://github.com/maritz/nohm-admin)
- bug fixes and code improvements

# v0.3

- refactored a lot of the code

# v0.2

- merged admin branch (this adds an optional and very basic admin web interface)
- a lot of fixes for find and indexes

# v0.1.4

- three small changes

# v0.1.3

- added numLinks()
- lots of bug fixes and some semi-internal changes

# v0.1.2

- a few bug fixes in uniques, find() and load()

# v0.1.1

- expose redis via nohm.redis

# v0.1

- all basic functionality included
