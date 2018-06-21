---
title: Index
layout: default
---

## Links

- [Github](https://github.com/maritz/nohm)
- [API Docs](https://maritz.github.io/nohm/api/index.html)
- [v0.9 / v1 docs](index_v1.html)

## How To

### Index

- [Overview](#overview)
- [Basics](#basics)
  - [Prefix](#prefix)
  - [Client](#client)
  - [Logging](#logging)
- [Models](#models)
  - [Methods](#methods)
  - [Client](#client)
  - [Properties](#properties)
    - [Types/Behaviours](#typesbehaviours)
    - [String](#string)
    - [Integer / Float](#integer--float)
    - [Boolean](#boolean)
    - [Timestamp](#timestamp)
    - [Json](#json)
    - [Behaviour](#behaviour)
    - [Validators](#validators)
  - [ID generation](#id-generation)
- [Creating an instance](#creating-an-instance)
- [Setting/Getting properties](#settinggetting-properties)
- [Validating](#validating)
  - [Calling valid()](#calling-valid)
  - [Browser validation](#browser-validation)
- [Saving](#saving)
- [Deleting](#deleting)
- [Loading](#loading)
- [Finding](#finding)
  - [Finding all ids of a model](#finding-all-ids-of-a-model-model)
  - [Finding by Index](#finding-by-index)
  - [Finding by simple index](#finding-by-simple-index)
  - [Finding by numeric index](#finding-by-numeric-index)
  - [Exclusive Intervals](#exclusive-intervals)
- [Sorting](#sorting)
  - [Sort all from DB](#sort-all-from-db)
  - [Sort a subset by given IDs](#sort-a-subset-by-given-ids-ids)
- [Relations](#relations)
  - [link](#link)
  - [unlink](#unlink)
  - [belongsTo](#belongsto)
  - [numLinks](#numlinks)
  - [getAll](#getall)
- [Publish / Subscribe](#publish--subscribe)
  - [Configuration](#configuration)
  - [Usage](#usage)
- [Extras](#extras)
  - [Short Forms](#short-forms)
  - [Find and load in one](#findandload)

### Overview

Nohm is an [ORM](http://en.wikipedia.org/wiki/Object-relational_mapping 'Object-relational Mapping') for [redis](http://www.redis.io).
This How-To is intended to give you a good understanding of how nohm works.

### v2 Breaking changes

To make nohm more modern many breaking changes were introduced. Among them a switch from callbacks to promises, but also many small breaking changes.

For a full list of all breaking changes [see the CHANGELOG.md](https://github.com/maritz/nohm/blob/master/CHANGELOG.md#v2)

### Basics

There are some things you need to do before you can use nohm. If you just want to know how to actually use nohm models, skip to the next part [Models](#models).

**Note:** Almost all code examples here assume the following code:

```javascript
const nohm = require('nohm').Nohm;
const redisClient = require('redis').createClient();
redis.on('connect', () => {
  nohm.setClient(redisClient);

  // example code goes here!
});
```

#### NohmClass, NohmModel, etc. The module explained

The `nohm` module exports several objects/classes:

- `require('nohm').Nohm` is the default instance of the NohmClass. In normal use, this is the only instance of NohmClass you should use.
- `require('nohm').NohmClass` There are usecases where you would want multiple NohmClasses, for example if you want different prefixes for different parts of your application or you have multiple different databases, each containing some models. TODO: add more documentation for these special use cases
- `require('nohm').NohmModel` This is the Extendable Model class you should use for ES6/Typescript class definitions

#### Prefix

The first thing you should do is set a prefix for the redis keys. This should be unique on the redis database you're using since you may run into conflicts otherwise.
You can do this with the following command:

```javascript
nohm.setPrefix('yourAppPrefixForRedis');
```

#### Client

You need to set a redis client for nohm. You should connect and select the appropriate database before you set it.

```javascript
const redisClient = require('redis').createClient();
// wait for redis to connect, to make sure everything will work as expected
redis.on('connect', () => {
  nohm.setClient(redisClient);
});
```

#### Logging

By default nohm just logs errors it encounters to the console. However you can overwrite the logError method with anything you want:

TODO: once v2 has proper logging support, change this.

```javascript
// this will throw all errors nohm encounters - not recommended
nohm.logError = function(err) {
  throw new Error({
    name: 'Nohm Error',
    message: err,
  });
};
```

### Models

You start by defining a Model. A model needs a name and properties and can optionally have custom methods and a per-model redis client.

There are 2 ways to define a model: Using plain objects or using classes.

When using plain objects you use the nohm.model() when using classes (in ES6 or Typescript) you use nohm.register().

#### nohm.model()

```javascript
const someModel = nohm.model('YourModelName', {
  properties: {
    // ... here you'll define your properties
  },
  methods: {
    // optional
    // ... here you'll define your custom methods
  },
  client: someRedisClient, // optional
});
```

<p><small>Strictly speaking the properties are optional as well, but a model really doesn't make sense without them.</small></p>

The first parameter is the name of the model that is used internally by nohm for the redis keys and relations. This should be unique across your application (prefix/db).
The second is an object containing properties, methods and the client.

##### Methods

If you want your model to have custom methods you can define them in the `methods` object. They will be bound to the model and thus inside them the 'this' keyword is the instance of a model.

##### Redis client

You can optionally set a redis client for a model by passing it as the property `client`.

**Important**: Currently relations between models on different DBs do NOT work!

#### nohm.register()

If you can use ES6+ or Typescript classes the preferred way to define your models is by using the `nohm.register()` function.

_Note_: At the time of writing the current EcmaScript does not support static properties in class definitions yet.
The workaround is to define them afterwards on the class object as seen below.

ES6+ Example:

```javascript
const NohmModel = require('nohm').NohmModel;
class SomeModel extends NohmModel {
  public someMethod() {
    console.log(this.property('name'));
  }
}

ClassModel.modelName = 'SomeModelName';
ClassModel.definitions = {
  name: {
    type: 'string',
    unique: true
  }
};
```

#### Properties (.model()) / Definitions (.register())

Defining the properties is the most important part of a model.
A property can have the following options: (explained in more detail later)

<dl>
  <dt>
    <b>type</b> <span class="additionalInfo">String/Function</span>
  </dt>
  <dd>
    The variable type or behaviour of the property. All values will be cast to this value.<br/>
    There are a few built-in types:<br/>
      <code>string, integer, float, boolean, timestamp and json</code><br/>
    You can also define a behaviour. This is a function that type-casts the value in whatever way you want.
  </dd>
  <dt>
    defaultValue <span class="additionalInfo">Any value</span>
  </dt>
  <dd>
    The default value a property will have when the model is initialized.<br/>
    Can even be a function that will be called each time a new instance is created and the return value will be the value of the property.<br/>

    *Note*: If you do not define a default value, it will be 0.

  </dd>
  <dt>
    validations <span class="additionalInfo">Array of strings/objects/functions</span>
  </dt>
  <dd>
    An array of validations for the property. There are a few built-ins but you can define a custom function here as well.
  </dd>
  <dt>
    index <span class="additionalInfo">Boolean</span>
  </dt>
  <dd>
    Whether the value should be indexed. This enables finding and sorting but stores a few bytes more in the redis db.
  </dd>
  <dt>
    unique <span class="additionalInfo">Boolean</span>
  </dt>
  <dd>
    Whether the value should be unique among all instances of this model. (case insensitive. empty strings are not counted as unique.)
  </dd>
  <dt>
    load_pure <span class="additionalInfo">Boolean</span>
  </dt>
  <dd>
    Per default this is false and values loaded are put through the type casting/behaviours. If you want to prevent this you can set this to true and it will not be altered from the data that redis delivers.
  </dd>
</dl>
<p><small><bold>bold</bold> = mandatory</small></p>

Here's an example of a very basic user model:

```javascript
const User = nohm.model('User', {
  properties: {
    name: {
      type: 'string',
      unique: true,
      validations: ['notEmpty'],
    },
    email: {
      type: 'string',
      unique: true,
      validations: ['notEmpty', 'email'],
    },
    password: {
      defaultValue: '',
      type: (value) => {
        return `${value}someSeed`; // and hash it of course, but to make this short that is omitted in this example
      },
      validations: [
        {
          name: 'length',
          options: {
            min: 6,
          },
        },
      ],
    },
    visits: {
      type: 'integer',
      index: true,
    },
  },
});
```

##### Types/Behaviours

###### String

Normal javascript string.

###### Integer / Float

The value is parsed to an Int(base 10) or Float and defaults to 0 if NaN.

###### Boolean

Casts to boolean - except 'false' (string) which will be cast to false (boolean).

###### Timestamp

Converts a Date(-time) to a timestamp (base 10 integer of miliseconds from 1970).
This takes two different formats as inputs:

- Numbers result in a direct parseInt
- ISO string of a date (with timezone)
- any date string 'new Date()' can handle

###### Json

If a valid JSON string is entered nothing is done, anything else will get put through JSON.stringify.
Note that properties with the type of JSON will be returned as parsed objects!

###### Behaviour

This can be any function you want.
Its `this` keyword is the instance of the model and it receives the arguments new_value, name and old_value.
The return value of the function will be the new value of the property.
Note that the redis client will convert everything to strings before storing!

A simple example:

```javascript
const User = nohm.model('User', {
  properties: {
    balance: {
      defaultValue: 0,
      type: function changeBalance(value, key, old) {
        return old + value;
      },
    },
  },
});

const test = new User();
test.p('balance'); // 0
test.p('balance', 5);
test.p('balance'); // 5
test.p('balance', 10);
test.p('balance'); // 15
test.p('balance', -6);
test.p('balance'); // 9
```

##### Validators

A property can have multiple validators. These are invoked whenever a model is saved or manually validated.
Validations of a property are defined as an array of strings, objects and functions.

Functions take 2 arguments and must return a promise that resolves to true or false, depending on whether the new value is valid.  
The arguments are the new value and options. Options can be any object you define but gets the following values mixed in: old (old value), optional (bool, Default: false) and trim (bool indicating whether the value should be trimmed before validating. Default: true)

_Note_: Functions included like this cannot be exported to the browser!

_Note_: The function name is used in the error fields if validation fails. Thus using arrow functions here might not be desirable.

Here's an example with all three ways:

```javascript
const validatorModel = nohm.model('validatorModel', {
  properties: {
    builtIns: {
      type: 'string',
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            max: 20,
          },
        },
      ],
    },
    optionalEmail: {
      type: 'string',
      unique: true,
      validations: [
        {
          name: 'email',
          options: {
            optional: true, // every built-in validation supports the optional option
          },
        },
      ],
    },
    customValidation: {
      type: 'integer',
      validations: [
        function checkIsFour(value, options) {
          return Promise.resolve(value === 4);
        },
      ],
    },
  },
});
```

You can find the documentation of the built-in validations by looking directly [at the source code](https://github.com/maritz/nohm/blob/master/ts/universalValidators.js).

##### Custom validations in extra files

// TODO: re-write/change once custom validations are back in

If you need to define custom validations as functions and want them to be exportable for the browser validations, you need to include them from an external file.

Example customValidation.js:

```javascript
exports.usernameIsAnton = function(value, options) {
  if (options.revert) {
    callback(value !== 'Anton');
  } else {
    callback(value === 'Anton');
  }
};
```

This is then included like this:

```javascript
Nohm.setExtraValidations('customValidation.js');
```

Now you can use this validation in your model definitions like this:

```javascript
nohm.model('validatorModel', {
  properties: {
    customValidation: {
      type: 'string',
      validations: [
        'usernameIsAnton',
        // or
        [
          'usernameIsAnton',
          {
            revert: true,
          },
        ],
      ],
    },
  },
});
```

#### ID generation

By default the ids of instances are uuid v1 and generated at the time of the first save call. You can however either choose an incremental id scheme or provide a custom function for generating ids.

```javascript
nohm.model('incrementalIdModel', {
  idGenerator: 'increment',
  properties: {
    // ...
  },
});
//ids of incremental will be 1, 2, 3 ...

const prefix = 'bob';
const step = 50;
let counter = 200;
Nohm.model('customIdModel', {
  idGenerator: async () => {
    // ids of custom will be bob250, bob300, bob350 ...
    counter += step;
    return prefix + counter;
  },
  properties: {
    // ...
  },
});
// this is just an example and not a good implementation,
// because it keeps the counter purely in memory
```

### Creating an instance

There are two basic ways to create an instance of a model.

#### Manual

Using the new keyword on the return of .model() or .register().

```javascript
const UserModel = nohm.model('UserModel', {});
const user = new UserModel();
```

This has the drawback that you need to keep track of your models.

#### Factory

Alternatively you can use the factory method of a NohmClass instance.

```typescript
// define your model in a userModel.js or similar
nohm.model('UserModel', {});

// anywhere else in your code
const user = await nohm.factory('UserModel');
// note the await, because factory always returns a promise
```

You can also pass an id as the 2nd argument to immediately load the data from db.

```typescript
const user = await nohm.factory('UserModel', 123);
user.id === 123; // true
user.isLoaded === true; // true
```

### Setting/Getting properties

The method property() gets and sets properties of an instance.

```javascript
const user = new User();
user.property('name', 'test');
user.property('name'); // returns 'test'
user.property({
  name: 'test2',
  email: 'someMail@example.com',
});
user.property('name'); // returns 'test2'
user.property('email'); // returns 'someMail@example.com'
```

The convenience short versions .p() and .prop() still exist, but are deprecated and cause a deprecation warning.

There are several other methods for dealing with properties:

- allProperties() - get an object with all properties plus it's id
- propertyReset([propertyName]) - Resets a property to its state as it was at last init/load/save (whichever was most recent - so for init it would be defaultValues)
- propertyDiff() - Returns an array of all the properties that have been changed since init/load/save (whichever was most recent - so for init it would be defaultValues)

### Validating

Your model instance is automatically validated on save but you can manually validate it as well.

In the following code examples we assume the model of the [valitators section](#validators) is defined and instanced as `user`.

#### Calling valid()

```typescript
user.property({
  builtIns: 'teststringlongerthan20chars',
  optionalEmail: 'hurgs',
  customValidation: 3,
});
const valid = await user.validate(undefined, false);
if (!valid) {
  user.errors; // { builtIns: ['length'], optionalEmail: ['email'], customValidation: ['custom'] }
} else {
  // valid! YEHAA!
}
```

There are a few things to note here:

- The first argument to valid is an optional property name. If set, only that property will be validated.
- The second argument to valid is to tell the unique check whether it should lock the unique. The unique checks are the last validation and if the model is not valid by the time the uniques are checked, this argument is ignored and no unique is locked. If the unique check of any property results in an error all unique locks that were done in the process of the previous checks are removed (however not the old unique locks of the last valid state).
  Unless you know exactly what you are doing, this argument should always be left at false.

#### Browser validation

You can also do most validations in the browser by using the nohm-middleware.

This is useful if you don't want to do the ajax round trip for every small validation you might have or for sharing the same validation code between frontend and backend.

There is one exception for this: Custom validations (aka. functions) defined in the model definition itself will not be available through the middleware.
Instead, if you want to share custom validations with frontend and backend, they have to be explicitly defined in custom validation files and registered in nohm as such.

TODO: Check/fix/update this once the custom validation files are ported in v2.

```javascript
nohm.middleware(options);
```

The middleware takes an argument containing the following options:

- `url` - Url under which the js file will be available. Default: '/nohmValidations.js'
- `exclusions` - Object containing exclusions for the validations export - see example for details
- `namespace` - Namespace to be used by the js file in the browser. Default: 'nohmValidations'
- `extraFiles` - Extra files containing validations. You should only use this if they are not already set via Nohm.setExtraValidations as nohm.connect automatically includes those.
- `maxAge` - Cache control (in seconds)

```typescript
server.use(
  nohm.middleware(
    // options object
    {
      url: '/nohm.js',
      namespace: 'nohm',
      exclusions: {
        User: {
          // modelName
          name: [0], // this will ignore the first validation in the validation definition array for name in the model definition
          salt: true, // this will completely ignore all validations for the salt property
        },
        Privileges: true, // this will completely ignore the Priviledges model
      },
    },
  ),
);
```

If you now include /nohm.js (or default /nohmValidations.js) in your page, you can validate any model in the browser like this:

```typescript
// using defined namespace from above. default would be nohmValidations
const { valid, errors } = await nohm.validate('User', {
  name: 'test123',
  email: 'test@test.de',
  password: '******',
});
if (valid) {
  alert('User is valid!');
} else {
  alert('Oh no, your user data was not accepted!');
  // errors is the same format as on the server model.errors
}
```

Of course you have to make sure your supported browsers can handle Async/Await, most likely with a transformation step and Promise shims.

### Saving

Saving an instance automatically decides whether it needs to be created or updated on the base of checking for user.id.

This means that if you haven't either manually set the id or load()ed the instance from the database, it will try to create a new instance.

Saving automatically validates the entire instance. If it is not valid, nothing will be saved.

```typescript
try {
  await user.save();
  // it's in the db :)
} catch (error) {
  if (error instanceof nohm.ValidationError) {
    // erros = the errors in validation
  }
}
```

Save can take an optional object containing options, which defaults to this:

```javascript
user.save({
  // If true, no events from this save are published
  silent: false,

  // By default if user was linked to two objects before saving and the first linking fails, the second link will not be saved either.
  // Set this to true to try saving all relations, regardless of previous linking errors.
  continue_on_link_error: false,

  // Set to true to skip validation entirely.
  // _WARNING_: This can cause severe problems. Think hard before using this.
  // It skips checking _and setting_ unique indexes.
  // It is also NOT passed to linked objects that have to be saved.
  skip_validation_and_unique_indexes: false,
});
```

### Deleting

Calling remove() completely removes the instance from the db, including realtions - but not the related instances - so it is not a cascading remove.
This only works on instances where the id is set (manually or from load()).

```typescript
const user = await nohm.factory('User');
user.id = 123;
try {
  await user.remove({
    // options object can be omitted
    silent: true, // whether remove event is published. defaults to false.
  });
} catch (error) {
  // removal failed.
}
```

### Loading

To populate the properties of an existing instance you have to load it via ID.

If the instance does not exist a new Error('not found') is thrown.

```typescript
try {
  const properties = await user.load(1234);
} catch (err) {
  if (err && err.message === 'not found') {
    // user does not exist
  } else {
    // unknown error
  }
}
```

### Finding

To find an ID of an instance Nohm offers a few simple search functionalities.
The function to do so is always .find(), but what it does depends on the arguments given.

#### Finding all ids of a model

Simply calling find() without arguments will retrieve all IDs.

```typescript
const ids = await SomeModel.find();
// ids = array of ids
```

#### Finding by Index

To specify indexes to search for you have to pass in an object as the first parameter.
There are three kinds of indexes: unique, simple and numeric.
Unique is the fastest and if you look for a property that is unqiue all other search criteria is ignored.
You can mix the three search queries within one find call.
After all search queries of a find() have been processed the intersection of the found IDs is returned.

##### Finding by simple index

Simple indexes are created for all properties that have `index` set to true and are of the type 'string', 'boolean', 'json' or custom (behaviour).

Example:

```typescript
const ids = await SomeModel.find({
  someString: 'hurg',
  someBoolean: false,
});
// ids = array of all instances that have (somestring === 'hurg' && someBoolean === false)
// if no instances match the search an empty array is returned
```

##### Finding by numeric index

Numeric indexes are created for all properties that have `index` set to true and are of the type 'integer', 'float' or 'timestamp'.
The search needs to be an object that optionaly contains further filters: min, max, offset and limit.
This uses the redis command [zrangebyscore](http://redis.io/commands/zrangebyscore) and the filters are the same as the arguments passed to that command. (limit = count)
They default to this:

```javascript
{
  min: '-inf',
  max: '+inf',
  offset: '+inf', // only used if a limit is defined
  limit: undefined
}
```

To specify an infinite limit while using an offset use limit: 0.

Example:

```typescript
const ids = await SomeModel.find({
  someInteger: {
    min: 10,
    max: 40,
    offset: 15, // this in combination with the limit would work as a kind of pagination where only five results are returned, starting from result 15
    limit: 5,
  },
  SomeTimestamp: {
    max: +new Date(), // timestamp before now
  },
});
```

**Important**: The limit is only specific to the index you are searching for. In this example it will limit the someInteger search to 5 results, but the someTimestamp search is unlimited. Since the overall result will be an intersection of all searches, there can only be as many ids as the limit of the smallest search has.

If you limit multiple searches you might also end up with 0 results even though each search resulted in more ids because there may be no intersection.

It is simpler and recommended to either only limit one search or manually limit the result array in the callback.

You can also search for exact numeric values by using the syntax of a simple index search.

#### Exclusive Intervals

[Zrangebyscore](http://redis.io/commands/zrangebyscore) Quote:

> By default, the interval specified by min and max is closed (inclusive). It is possible to specify an open interval (exclusive) by prefixing the score with the character (.

In nohm you can do this by specifying an endpoints option. The default is '[]' which creates the redis default: inclusive queries.

Example:

```typescript
const ids = await SomeModel.find({
  someInteger: {
    min: 10,
    max: 20,
    endpoints: '(]', // exclude models that have someInteger === 10, but include 20
    // endpoints: '(' short form for the same as above
    // endpoints: '[)' would mean include 10, but exclude 20
    // endpoints: '()' would excludes 10 and 20
  },
});
```

### Sorting

You can sort your models in a few basic ways with the build-in .sort() method.
However it might be a good idea to do more complex sorts manually.

#### Sort all from DB

```typescript
let ids = await SomeModel.sort({
  // options object
  // ids is an array of the first 100 ids of SomeModel instances in the db, sorted alphabetically ascending by name
  field: 'name', // field is mandatory
});

ids = await SomeModel.sort({
  // ids is an array of the first 100 ids of SomeModel instances in the db, sorted alphabetically descending by name
  field: 'name',
  direction: 'DESC',
});

ids = await SomeModel.sort({
  // ids is an array of 100 ids of SomeModel instances in the db, sorted alphabetically descending by name - starting at the 50th
  field: 'name',
  direction: 'DESC',
  limit: [50],
});

ids = await SomeModel.sort({
  // ids is an array of 25 ids of SomeModel instances in the db, sorted alphabetically descending by name - starting at the 50th
  field: 'name',
  direction: 'DESC',
  limit: [50, 25],
});

// this
ids = await SomeModel.sort({
  // ids is an array of the 10 last edited instances in the model (provided last_edit is filled properly on edit)
  field: 'last_edit',
  limit: [-10, 10],
});
// would have the same result as:
ids = await SomeModel.sort({
  // ids is an array of the 10 last edited instances in the model (provided last_edit is filled properly on edit)
  field: 'last_edit',
  direction: 'DESC',
  limit: [0, 10],
});
```

#### Sort a subset by given IDs

If you have an array of IDs and want them in a sorted order, you can use the same method with the same options but giving the array as the second argument. This is especially useful if combined with find().

```typescript
// assuming car model
const ferrariIDs = await Car.find({
  manufacturer: 'ferrari',
});
const sortedFerariIDs = Car.sort(
  {
    field: 'build_year',
  },
  ferrariIDs, // array of found ferrari car ids
);
// sortedFerrariIDs = oldest 100 ferrari cars
```

_Note_; If performance is very important it might be a good idea to do this kind of find/sort combination yourself in a multi query to the redis DB or as a lua script in redis, depending on complexity.

### Relations

Relations (links) are dynamically defined for each instance and not for a model. This differs from traditional ORMs that use RDBMS and thus need a predefined set of tables or columns to maintain these relations.
In nohm this is not necessary making it possible for one instance of a model to have relations to models that other instances of the same model do not have.

A simple example:
We have 2 instances of the UserModel: User1, User2
We have 3 instances the RoleModel: AdminRole, AuthorRole, UserManagerRole
A user can have 0-3 roles.
This creates an N:M relationship. In a traditional DB you'd now need a [pivot table](http://www.wellho.net/solutions/mysql-many-to-many-table-mapping-pivot-tables.html) and then you'd have to somehow tell your ORM that it should use that table to map these relations.
In nohm this step is not needed.
Instead we just tell every UserModel _instance_ whatever relationships it has.

This has the upside of more flexibility in relations, but the downside of more complexity maintaining these relations.

In nohm all relations have a name pair. By default this pair is "default" and "defaultForeign". The instance that initiated the relationship is the "default" the one that is linked to it is the "defaultForeign" ("Foreign" is attached to custom link names for this).
This again has the upside of more flexibility in relations, but the downside of more complexity maintaining these relations.

Some Examples:

```javascript
User1.link(AdminRole);
User1.link(AuthorRole);
User2.link(UserManagerRole, 'createdBy');
User2.link(UserManagerRole, 'temp');
```

Now (after saving) these relations exist:

- User1 (default) -> AdminRole (defaultForeign)
- User1 (default) -> AuthorRole (defaultForeign)
- User1 (createdBy) -> UserManagerRole (createdByForeign)
- User2 (temp) -> UserManagerRole (tempForeign)

Tip: Be careful with naming and don't overuse it!

#### link

Usage: instance.link(otherInstance, \[options\])

This creates a relation (link) to another instance.
The most basic usage is to just use the first argument:

```javascript
User1.link(AdminRole);
```

The relation is only written to the DB when User1 is saved. (not when saving Admin!)

```typescript
const User = await nohm.factory('User');
User.link(AdminRole);
try {
  await User.save();
  // User1 and Admin are saved and the relation is in the DB
} catch (err) {
  if (err instanceof Nohm.LinkError) {
    // error occured during linking, in this case probably AdminRole validation
    // err.errors is an Array of these objects:
    /*
      {
      success: boolean;
      child: NohmModel;
      parent: NohmModel;
      error: null | Error | LinkError | ValidationError;
      }
    */
  } else if (err instanceof Nohm.ValidationError) {
    // User failed to validate
  } else {
    // unknown error
  }
}
```

There are several things that happen here:

- First User is validated. If User is invalid a Nohm.ValidationError is thrown.
- If User is valid, User is stored.
- If Admin has an ID, the relation is stored and the save is successful.
- Otherwise Admin is validated. If Admin is invalid a Nohm.LinkError is thrown with details in the errors field.
- If Admin is valid, Admin is stored, the relation is stored and the save is successful.

This process works infinitely deep. However this process is not atomic, thus it might be a better idea to save the elements individually and then link them!

link can take an optional options object or link name as the second argument. If it is a string, it's assumed to be the link name.
The options object has 2 available options:

```typescript
User1.link(ManagerRole, {
  name: 'hasRole', // otherwise defaults to "default"
  error: function(error, linkedInstance) {
    // this is called if there was an error while saving the linked object (ManagerRole in this case)
    // error is the error ManagerRole.save() rejected with
    // linkedInstance is ManagerRole
  },
});
```

#### unlink

Usage: instance.unlink(otherInstance, \[options\])

Removes the relation to another instance and otherwise works the same as link.

#### belongsTo

Usage: instance.belongsTo(otherInstance, \[relationName\])

This checks if an instance has a relationship to another relationship.

```typescript
const isManager = await User.belongsTo(ManagerRole);
```

This requires that User as well as ManagerRole have an id set.

#### numLinks

Usage: instance.numLinks(modelName, \[relationName\])

This checks how many relations of one name pair an Instance has to another Model.

```typescript
// assuming the relation definitions from above

let num = await User1.numLinks('RoleModel');
// num will be 2
// note that it is not 3, because the default link name is used

// get the amount of links that are named 'createdBy':
num = await User1.numLinks('RoleModel', 'createdBy');
// num will be 1

// get the amount of links that are named 'temp':
num = await User1.numLinks('RoleModel', 'temp');
// num will be 0
```

#### getAll

Usage: instance.getAll(modelName, \[relationName\])

This gets the IDs of all linked instances.

```typescript
let roleIds = await User1.getAll('RoleModel');
// roleIds = [1,2]

roleIds = await User1.getAll('RoleModel', 'createdBy');
// roleIds = [3]

roleIds = await User2.getAll('RoleModel', 'temp');
// roleIds = [3]
```

### Publish / Subscribe

Nohm supports a way for seperate clients to get notified of nohm actions in other clients, if they are connected to the same redis database and PubSub is activated.

#### Configuration

To use PubSub 2 steps are required:

1.  setting a seperate redis client for subscribing
2.  configuring either nohm or models to publish

##### Setting the second redis client

```typescript
const secondClient = require('redis').createClient();
await nohm.setPubSubClient(secondClient);
// Yey, we can start subscribing :)

// to close the pubsub connection and make the redis client available for normal commands again:
const client = nohm.closePubSub();
// client == secondClient
// Note: this doesn't stop nohm from publishing, just subscribing
```

##### Configuring nohm globally to publish

```typescript
nohm.setPublish(true); // this client will publish on all modelsby default
nohm.setPublish(false); // this client will not publish by default
```

##### Configuring models to publish

```typescript
// This model will publish no matter what the global publish setting is.
nohm.model('Publish', {
  properties: {},
  publish: true
}):

// This model will only publish if the global setting is set to true.
nohm.model('No_publish', {
  properties: {}
});
```

#### Checking if a model is set to publish

```typescript
const model = await nohm.factory('someModelName');
model.getPublish(); // returns whether the model someModelName will publish
```

#### Usage

There are 6 events that get published:

- 'create' -- a new instance is getting created.
- 'update' -- an instance is getting updated with new values.
- 'save' -- an instance is getting created OR updated (in addition to one of the above).
- 'remove' -- an instance is getting removed (although you get an id here, the data is not in the db anymore)
- 'link' -- instances are getting linked
- 'unlink' -- instances are getting unlinked

All\* these event callbacks get an object containing these properties:

```javascript
{
  target: {
  id: 'id_of_the_instance',
  modelName: 'name_of_the_model',
  properties: {} // instance.allProperties() from where the event was fired
      // only in save/update:
      diff: {} // instance.propertyDiff()
  }
}
```

\*The Exceptions are link and unlink:

```javascript
{
  child: {
    id: 'id_of_the_child_instance',
    modelName: 'name_of_the_child_model',
    properties: {} // child.allProperties() from where the event was fired
  },
  parent: {
    id: 'id_of_the_parent_instance',
    modelName: 'name_of_the_parent_model',
    properties: {} // parent.allProperties() from where the event was fired
  },
  relation: 'child' // relation name
}
```

To handle subscribing to these events there are 3 functions to use: model.subscribe, model.subscribeOnce and model.unsubscribe.

##### model.subscribe

Subscribe to all actions of a specified event type on a model.

Example:

```typescript
const model = await nohm.factory('someModel');
model.subscribe('update', function(event) {
  console.log(
    'someModel with id %s was updated and now looks like this:',
    event.target.id,
    event.target.properties,
  );
});
```

##### model.subscribeOnce

Subscribe and after it is fired once, unsubcsribe.

Example:

```typescript
let updates = 0;
const model = await nohm.factory('someModel');
model.subscribeOnce('update', function(event) {
  // will only be called once no matter how many updates happen after 1 has published
  updates++;
  console.log(
    'someModel with id %s was updated and now looks like this:',
    event.target.id,
    event.target.properties,
  );
  console.log(updates);
});
```

##### model.unsubscribe

Unsubscribe one or all listeners.

Example:

```typescript
const model = await nohm.factory('someModel');
const callback = function(event) {
  console.log(
    'someModel with id %s was updated and now looks like this:',
    event.target.id,
    event.target.properties,
  );
};
model.subscribe('update', callback);

// to unsubscribe only one:
model.unsubscribe('update', callback);

// or unsubscribe all
model.unsubscribe('update');
```

### Extras

Some things that don't really fit anywhere else in this documentation.

#### Short Forms

For some functions there are short forms.

Instead of having to do something like:

```typescript
const user = new User();
await user.load(1);
user.property('name', 'test');
```

You can do this:

```typescript
const user = await User.load(1);
user.property('name', 'test');
});
```

This currently works for the following functions: load, find, save and remove.
It is really only a shortcut.

#### loadMany

A shortcut for loading all instances of ids in an Array.

Contrary to .load() this does not throw on non existant ids and instead just resolves with all models that existed.

```typescript
const ids = [1, 2, 1593];
const cars = await CarModel.loadMany(ids);
cars.forEach((car) => {
  // if for example id 2 is not found, only car.id 1 and 1593 will be in cars
  console.log('A car was found: ', car.allProperties());
});
```

#### findAndLoad

A shortcut for find() and load().

```typescript
const cars = await CarModel.findAndLoad({
  manufacturer: 'ferrari'
});
// cars = array of nohm instances of ferraris
cars.forEach((car) => {
  if (car.property('build_year') < 1990)) {
    console.log('You should probably check out', car.id);
  }
});
```
