### v0.9.7 - 09.05.2015
  - BREAKS BACKWARDS COMPATIBILITY! (but only slightly and shouldn't really be an issue for most uses)
  - Fix for date parsing - only affects ISO date strings of format that has ' +HH:MM' or ' -HH:MM' at the end) and only on machines that are not set UTC (which servers usually are)
  - Update async & nodeunit dependencies

### v0.9.6 - 05.09.2014
  - Add save option skip_validation_and_unique_indexes (thanks RoxasShadow)
  - Bug fixes (thanks exortech)
  - Update dependencies

### v0.9.3 - 06.07.2013
  - Add endpoints option to find() (thanks to interruptz)
  - Add min>max options to find() that trigger descending search (thanks to interruptz)
  - Add return of the instance on shortform functions
  - Remove checking and setting meta.version on every model init
  - Bug fixes

### v0.9.2 - 04.12.2012
  - Add findAndLoad as a convenience method
  - Fix a problem with getAll if different idGenerators were used

### v0.9.1 - 21.08.2012
  - Fix uniques to now be completely case-insensitive

### v0.9.0 - 06.06.2012
  - setClient/getClient now issue warnings on unconnected clients
  - Bug fixes

### v0.9.0-pre3 - 04.03.2012
  - Support for common variants on bool/string/integer/timestamp
  - Bug fixes

### v0.9.0-pre - 2012-03-14
  - BREAKS BACKWARDS COMPATIBILITY! change relation names for clearer handling ("child" is now "default", "xyzParent" is now "xyzForeign")
  - Added error handler to link/unlink
  - Bug fixes

### v0.7.2 - 2012-01-19
  - add .sort()

### v0.7.1
  - Fix unique handling bugs

### v0.7.0
  - BREAKS BACKWARDS COMPATIBILTY! change validate() to be async only (validations all need to be async now), also changed validation usage syntax (see docs)
  - add nohm.connect() connect middleware that delivers browser validation js
  - Fix empty strings being locked on unique properties
  - Fix uniques to be case insensitive

### v0.6.4
  - unique values are now case insensitive when validating or searching
  - now compatible with node v0.6.3
  - now uses nodeunit v0.6.4

### v0.6.3

  - add Nohm.factory(modelName, [id, callback])
  - update redis dependency to 0.7.1

### v0.6.1 & v0.6.2

  - bug fixes

### v0.6

  - changed id generation to unique strings by default (BREAKS BACKWARDS COMPATIBILTY)
  - added ability to choose from different id generation mechanisms (for example incremental or custom functions)
  - added short forms of functions where you don't need to create a new instance first to save/load/find/remove
  - changed `this` in callbacks to be the instance you manipulated/loaded
  - bug fixes

### v0.5

  - "value" in model properties renamed to "defaultValue"
  - "has()" renamed to "belongsTo()"
  - bug fixes

### v0.4

  - documentation
  - added instance.exists(id, callback)
  - added Nohm.setPrefix(prefix) to set the global redis prefix (default "nohm")
  - added Nohm.setClient(client) & Nohm.getClient() to set/get the global redis client (no default!)
  - removed instance.partialSave()
  - removed admin app (now in https://github.com/maritz/nohm-admin)
  - bug fixes and code improvements

### v0.3

  - refactored a lot of the code

### v0.2

  - merged admin branch (this adds an optional and very basic admin web interface)
  - a lot of fixes for find and indexes

### v0.1.4

  - three small changes

### v0.1.3

  - added numLinks()
  - lots of bugfixes and some semi-internal changes

### v0.1.2

  - a few bugfixes in uniques, find() and load()

### v0.1.1

  - expose redis via nohm.redis

## v0.1

  - all basic functionality included
