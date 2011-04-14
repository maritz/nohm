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
