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
