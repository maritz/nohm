### v1.0.0 - 2018/05/25

Nohm v1 is published without any major change from v0.9.8.
v1.0.x will be maintenance (critical bugs) only.
There is a branch `v1_breaking_maintenance` that will be used for fixing issues on the v1 branch that require breaking changes.

v2 and onwards will be the typescript rewrite and has a few breaking changes.

* Fixes unlinkAll() (and thus remove()) not working properly with some id types.
* Fixes custom validation function name parsing in node v10+

### v0.9.8 - 2016/02/06

* Add instance context to custom validators. (thanks johngeorgewright)

  ```javascript
  exports.instanceValidation = function(value, opt, callback) {
    if (this.id < 50) {
      callback(true);
    } else {
      callback(this.p(opt.property).includes(value));
    }
  };
  ```

* Update dependencies (thanks brysgo)
  * redis 2.4.2
  * (dev) nodeunit 0.9.1

### v0.9.7 - 2015/05/09

* BREAKS BACKWARDS COMPATIBILITY! (but only slightly and shouldn't really be an issue for most uses)
* Fix for date parsing - only affects ISO date strings of format that has ' +HH:MM' or ' -HH:MM' at the end) and only on machines that are not set UTC (which servers usually are)
* Update async & nodeunit dependencies

### v0.9.6 - 2014/09/05

* Add save option skip_validation_and_unique_indexes (thanks RoxasShadow)
* Bug fixes (thanks exortech)
* Update dependencies

### v0.9.3 - 2013/07/06

* Add endpoints option to find() (thanks to interruptz)
* Add min>max options to find() that trigger descending search (thanks to interruptz)
* Add return of the instance on shortform functions
* Remove checking and setting meta.version on every model init
* Bug fixes

### v0.9.2 - 2012/12/04

* Add findAndLoad as a convenience method
* Fix a problem with getAll if different idGenerators were used

### v0.9.1 - 2012/08/21

* Fix uniques to now be completely case-insensitive

### v0.9.0 - 2012/06/06

* setClient/getClient now issue warnings on unconnected clients
* Bug fixes

### v0.9.0-pre3 - 2012/03/04

* Support for common variants on bool/string/integer/timestamp
* Bug fixes

### v0.9.0-pre - 2012/03/14

* BREAKS BACKWARDS COMPATIBILITY! change relation names for clearer handling ("child" is now "default", "xyzParent" is now "xyzForeign")
* Added error handler to link/unlink
* Bug fixes

### v0.7.2 - 2012/01/19

* add .sort()

### v0.7.1

* Fix unique handling bugs

### v0.7.0

* BREAKS BACKWARDS COMPATIBILTY! change validate() to be async only (validations all need to be async now), also changed validation usage syntax (see docs)
* add nohm.connect() connect middleware that delivers browser validation js
* Fix empty strings being locked on unique properties
* Fix uniques to be case insensitive

### v0.6.4

* unique values are now case insensitive when validating or searching
* now compatible with node v0.6.3
* now uses nodeunit v0.6.4

### v0.6.3

* add Nohm.factory(modelName, [id, callback])
* update redis dependency to 0.7.1

### v0.6.1 & v0.6.2

* bug fixes

### v0.6

* changed id generation to unique strings by default (BREAKS BACKWARDS COMPATIBILTY)
* added ability to choose from different id generation mechanisms (for example incremental or custom functions)
* added short forms of functions where you don't need to create a new instance first to save/load/find/remove
* changed `this` in callbacks to be the instance you manipulated/loaded
* bug fixes

### v0.5

* "value" in model properties renamed to "defaultValue"
* "has()" renamed to "belongsTo()"
* bug fixes

### v0.4

* documentation
* added instance.exists(id, callback)
* added Nohm.setPrefix(prefix) to set the global redis prefix (default "nohm")
* added Nohm.setClient(client) & Nohm.getClient() to set/get the global redis client (no default!)
* removed instance.partialSave()
* removed admin app (now in https://github.com/maritz/nohm-admin)
* bug fixes and code improvements

### v0.3

* refactored a lot of the code

### v0.2

* merged admin branch (this adds an optional and very basic admin web interface)
* a lot of fixes for find and indexes

### v0.1.4

* three small changes

### v0.1.3

* added numLinks()
* lots of bugfixes and some semi-internal changes

### v0.1.2

* a few bugfixes in uniques, find() and load()

### v0.1.1

* expose redis via nohm.redis

## v0.1

* all basic functionality included
