This file is a loose collections of things that are changing in the code or usage.
This file is not intended as documentation for users, instead it should make writing a migration guide to v1 easier.

- prefix, client, meta etc. are no longer static, instead per-nohm class instance
- new nohm class instances can be created by importing NohmClass instead of the default export
- creating nohmClass now takes an object containing the redis client, if not provided a default client is created
- .propertyRest() no longer returns true (it was the only return value possible and thus made no sense)
- .allProperties() no longer has a json (stringify) option
