This file is a loose collections of things that are changing in the code or usage.
This file is not intended as documentation for users, instead it should make writing a migration guide to v1 easier.

- prefix, client, meta etc. are no longer static, instead per-nohm class instance
- new nohm class instances can be created by importing NohmClass instead of the default export
- creating nohmClass now takes an object containing the redis client, if not provided a default client is created
- default ids are now normal uuids
- .propertyRest() no longer returns true (it was the only return value possible and thus made no sense)
- .allProperties() no longer has a json (stringify) option
- validation definition format for properties changed from ['$name', {options}] to { name: '$name', options: {options}}
- nohm.factory() now always returns a promise, even when not giving an id as second parameter
- remove() now sets the id on the instance object to null instead of 0
- validation failures no longer return the string 'invalid' but instead throw a ValidationError
- deeplink errors now produce a different error format (.errors with list if ILinkResults)
- deeplink error callbacks now have a different set of arguments
- load() now returns the same as allProperties() (meaning with id)
- removed most shortform functions
- removed loading via passing an id to the constructor. Use factory instead. (constructor cannot return promise)
- invalid find options now throw an error
- nohm.connect() renamed to nohm.middleware()
- nohm.middleware() now returns a typed express.RequestHandler (should be no functional change)
- validate() function in the browser provided by nohm.middleware() now returns promises as well, with resolve value of { valid: boolean, errors: TBD }
- findAndLoad() now returns an empty array if none are found instead of producing an error
- .id property is now a getter/setter and always either null or string
- the regexp validator now only takes valid RegExp objects as options
- behaviours now always receive arguments as strings. before they would be string from redis but any from initialization/defaultValue