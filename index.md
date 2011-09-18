---
title: Index
layout: default
---

## Links
- [Github](https://github.com/maritz/nohm)
- [API docs](api/index.html)


## How To

### Index
* [Overview](#overview)
* [Basics](#basics)
   * [Prefix](#prefix)
   * [Client](#client)
   * [Logging](#logging)
* [Models](#models)
   * [Methods](#methods)
   * [Client](#client)
   * [Properties](#properties)
      * [Types/Behaviours](#typesbehaviours)
      * [String](#string)
      * [Integer / Float](#integer__float)
      * [Boolean](#boolean)
      * [Timestamp](#timestamp)
      * [Json](#json)
      * [Behaviour](#behaviour)
      * [Validators](#validators)
* [Setting/Getting properties](#settinggetting_properties)
* [Validating](#validating)
   * [On setting a property](#on_setting_a_property)
   * [Calling valid()](#calling_valid)
* [Saving](#saving)
* [Deleting](#deleting)
* [Loading](#loading)
* [Finding](#finding)
   * [Finding all instances of a model](#finding_all_instances_of_a_model)
   * [Finding by Index](#finding_by_index)
   * [Finding by simple index](#finding_by_simple_index)
   * [Finding by numeric index](#finding_by_numeric_index)
* [Relations](#relations)
   * [link](#linkotherinstance_relationname)
   * [unlink](#unlinkotherinstance_relationname)
   * [has](#hasotherinstance_relationname)
   * [numLinks](#numlinksmodelname_relationame)
   * [getAll](#getallmodelname_relationame)
* [Extras](#extras)
   * [Short forms](#short_forms)


### Overview
Nohm is an [ORM](http://en.wikipedia.org/wiki/Object-relational_mapping "Object-relational Mapping") for [redis](http://www.redis.io).  
This How-To is intended to give you a good understanding of how nohm works. 

### Basics
There are some things you need to do before you can use nohm. If you just want to know how to actually use nohm models, skip to the next part [Models](#models).

**Note:** Almost all code examples here assume the following code: 
{% highlight js %}
  var nohm = require('nohm').Nohm;
  var redisClient = require('redis').createClient();
  nohm.setClient(redisClient);
{% endhighlight %}

#### Prefix
The first thing you should do is set a prefix for the redis keys. This should be unique on the redis database you're using since you may run into conflicts otherwise.
You can do this with the following command:
{% highlight js %}
  nohm.setPrefix('yourAppPrefixForRedis');
{% endhighlight %}

(Note that you probably shouldn't select such a long prefix since that adds overhead to the redis communication.)

#### Client
You need to set a redis client for nohm. You should connect and select the appropriate database before you set it.

{% highlight js %}
  var redisClient = require('redis').createClient();
  redisClient.select(4); // or something
  nohm.setClient(redisClient);
{% endhighlight %}

#### Logging
By default nohm just logs errors it encounters to the console. However you can overwrite the logError method with anything you want:

{% highlight js %}
  // this will throw all errors nohm encounters
  nohm.logError = function (err) {
    throw new Error({
      name: "Nohm Error",
      message: err
    });
  }
{% endhighlight %}

**IMPORTANT**: Sadly this is not actually fully true yet. There are a few places where nohm will just throw. TODO!

### Models
You start by defining a Model. A model needs a name and properties and can optionally have custom methods and a redis client.


{% highlight js %}    
var someModel = nohm.model('YourModelName', {
  properties: {
    // ... here you'll define your properties
  },
  methods: { // optional
    // ... here you'll define your custom methods
  },
  client: someRedisClient // optional
});
{% endhighlight %}
<p><small>Strictly speaking the properties are optional as well, but a model really doesn't make sense without them.</small></p>

The first parameter is the name of the model that is used internally by nohm for the redis keys and relations. This should be unique across your application (prefix/db).
The second is an object containing properties, methods and the client.

#### Methods
If you want your model to have custom methods you can define them here. They will be bound to the model and thus inside them the 'this' keyword is the instance of a model.

#### Client
You can optionally set a redis client for a model. This means that you can theoretically store every model on a different redis db. (I don't recommend this at all!)
**Important**: Currently relations between models on different dbs do NOT work! This might get implemented at a later stage if there's any interest for it.

#### Properties
Deinfing the properties is the most important part of a model.  
A property can have the following options: (explained in more detail later)

<dl>
  <dt>
    <b>type</b> <span class="additionalInfo">String/Function</span>
  </dt>
  <dd>
    The variable type/behaviour of the property. All values will be cast to this value.<br/>
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

    <b>Note</b>: If you do not define a default value, it will be 0.
  </dd>
  <dt>
    validations <span class="additionalInfo">Array of arrays/functions</span>
  </dt>
  <dd>
    An array of validations for the property. There are a few built-ins but you can define a custom function here as well.
  </dd>
  <dt>
    index <span class="additionalInfo">Boolean</span>
  </dt>
  <dd>
    Whether the value should be indexed. This makes finding easier/faster but stores a few bytes more in the redis db.
  </dd>
  <dt>
    unique <span class="additionalInfo">Boolean</span>
  </dt>
  <dd>
    Whether the value should be unique among all instances of this model.
  </dd>
</dl>
<p><small><bold>bold</bold> = mandatory</small></p>

Here's an example of a very basic user model:

{% highlight js %}
var User = nohm.model('User', {
  properties: {
    name: {
      type: 'string',
      unique: true,
      validations: [
        ['notEmpty']
      ]
    },
    email: {
      type: 'string',
      unique: true,
      validations: [
        ['notEmpty'],
        ['email']
      ]
    },
    password: {
      defaultValue: '',
      type: function (value) {
        return value + 'someSeed'; // and hash it of course, but to make this short that is omitted in this example
      },
      validations: [
        ['minLength', 6]
      ]
    },
    visits: {
      type: 'integer',
      index: true
    }
  }
});
{% endhighlight %}

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
* Numbers result in a direct parseInt
* ISO string of a date (with timezone)
* any date string 'new Date()' can handle

###### Json
If a valid JSON string is entered nothing is done, anything else will get put through JSON.stringify.
Note that properties with the type of JSON will be returned as parsed objects!

###### Behaviour
This can be any function you want.  
Its `this` keyword is the instance of the model and it receives the arguments newValue, name and oldValue.
The return value of the function will be the new value of the property.
Note that the redis client will convert everything to strings before storing!

A simple example:
{% highlight js %} 
var User = nohm.model('User', {
  properties: {
    balance: {
      defaultValue: 0,
      type: function changeBalance(value, key, old) {
        return old + value;
      }
    }
  }
});

var test = new User();
test.p('balance'); // 0
test.p('balance', 5);
test.p('balance'); // 5
test.p('balance', 10);
test.p('balance'); // 15
test.p('balance', -6);
test.p('balance'); // 9
{% endhighlight %}

##### Validators
A property can have multiple validators. These are invoked whenever a model is saved or manually validated.
Validations of a property are defined as an array of strings, arrays and functions.

Here's an example with all three ways:
{% highlight js %}
var validatorModel = nohm.model('validatorModel', {
  properties: {
    builtIns: {
      type: 'string',
      validations: [
        'notEmpty', // would be the same as ['notEmpty']
        ['maxLength', 20] // 20 will be the second parameter given to the maxLength validator function (the first being the new value)
      ]
    },
    optionalEmail: {
      type: 'string',
      unique: true,
      validations: [
        ['email', true]
      ]
    },
    customValidation: {
      type: 'integer',
      validations: [
        function checkIsFour(value) {
          return value === 4;
        }
      ]
    }
  }
});
{% endhighlight %}

You can find the documentation of the [built-in validations in the api](api/symbols/validators.html)

### Setting/Getting properties
The function p/prop/property (all the same) gets and sets properties of an instance.

{% highlight js %}
var user = new User;
user.p('name', 'test');
user.p('name'); // returns 'test'
user.p({
  name: 'test2',
  email: 'someMail@example.com'
});
user.p('name'); // returns 'test2'
user.p('email'); // returns 'someMail@example.com'
{% endhighlight %}

There are several other methods for dealing with properties: [allProperties](api/symbols/Nohm.html#.allProperties), [propertyReset](api/symbols/Nohm.html#.propertyReset), [propertyDiff](api/symbols/Nohm.html#.propertyDiff)


### Validating
Your model instance is automatically validated on saving but you can manually validate it as well.  
There are two ways to do that. In the following code examples we assume the model of the [valitators section](#validators) is defined and instanced as `user`.

#### On setting a property
Passing true as the third parameter (or second if the first is an object of all properties) validates the property and only changes it if the new value validates.
{% highlight js %}
var test = new validatorModel();
test.p('builtIns', '', true); // returns false and does NOT change the property
test.p('builtIns', 'asd', true); // returns true and changes the property
test.p('optionalEmail', 'asd@asd.de', true); // returns true and changes the property - even if the email is used already, see below
{% endhighlight %}

This is limited to the normal validators and does **not** check uniqueness.

#### Calling valid()
{% highlight js %}
user.p({
  builtIns: 'teststringlongerthan20chars',
  optionalEmail: 'hurgs',
  customValidation: 3
});
user.valid(); // returns false
user.errors; // { builtIns: ['maxLength'], optionalEmail: ['email'], customValidation: ['custom'] }
user.p({
  builtIns: 'hurgs',
  optionalEmail: 'valid@email.de',
  customValidation: 4
});
user.valid(false, false, function (valid) {
  if ( ! valid) {
    user.errors; // if the email is already taken this will be: { optionalEmail: ['unique'] }
  } else {
    // valid! YEHAA!
  }
});
{% endhighlight %}

There are a few things to note here:
* The user errors object contains the errors for each property since the last validation of that property (this is a problem that will be fixed)
* The first argument to valid is an optional property name. If set, only that property will be validated.
* The second argument to valid is to tell the unique check whether it should lock the unique. The unique checks are the last validation and if the model is not valid by the time the uniques are checked, this argument is ignored and no unique is locked. If the unique check of any property results in an error all unique locks that were done in the process of the previous checks are removed (however not the old unique locks of the last valid state).


### Saving
Saving an instance automatically decides whether it needs to be created or updated on the base of checking for user.id.
This means that if you haven't either manually set the id or load()ed the instance from the database, it will try to create a new instance.
Saving automatically validates the entire instance. If it is not valid, nothing will be saved.

{% highlight js %}
user.save(function (err) {
  if ( ! err) {
    user.errors; // the errors in validation
  } else {
    // it's in the db :)
  }
});
{% endhighlight %}

### Deleting
Calling remove() completely removes the instance from the db, including relations.
This only works on instances where the id is set (manually or from load()).

### Loading
To populate the properties of an existing instance you have to load it via ID.
{% highlight js %}
user.load(1234, function (err, properties) {
  if (err) {
    // err may be a redis error or "not found" if the id was not found in the db.
  } else {
    console.log(properties);
    // you could use this.allProperties() instead, which also gives you the 'id' property
  }
});
{% endhighlight %}


### Finding
To find an ID of an instance (e.g. to load it) Nohm offers a few simple search functionalities.
The function to do so is always .find(), but what it does depends on the arguments given.
Note that the ID array is sorted by default from lowest to highest.

#### Finding all instances of a model
Simply calling find() with only a callback will retrieve all IDs.

{% highlight js %}
  SomeModel.find(function (err, ids) {
    // ids = array of ids
  });
{% endhighlight %}

#### Finding by Index
To specify indexes to search for you have to pass in an object as the first parameter.  
There are three kinds of indexes: unique, simple and numeric.  
Unique is the fastest and if you look for a property that is unqiue all other search criterias are ignored.  
You can mix the three search queries within one find call.  
After all search queries of a find() have been processed the intersection of the found IDs is returned.  
To limit/filter/sort the overall result you have to manually edit the returned array.

##### Finding by simple index
Simple indexes are created for all properties that have `index` set to true and are of the type 'string', 'boolean', 'json' or custom (behaviour).

Example:
{% highlight js %}
SomeModel.find({
    someString: 'hurg'
    someBoolean: false
  }, function (err, ids) {
    // ids = array of all instances that have (somestring === 'hurg' && someBoolean === false)
  });
{% endhighlight %}


##### Finding by numeric index
Numeric indexes are created for all properties that have `index` set to true and are of the type 'integer', 'float' or 'timestamp'.  
The search needs to be an object that optionaly contains further filters: min, max, offset and limit.  
This uses the redis command [zrangebyscore](http://redis.io/commands/zrangebyscore) and the filters are the same as the arguments passed to that command. (limit = count)  
They default to this:
{% highlight js %}
{
  min: '-inf',
  max: '+inf',
  offset: '+inf', // only used if you a limit is defined
  limit: undefined
}
{% endhighlight %}

To specify an infinite limit while using an offset use limit: 0.

Example:
{% highlight js %}
SomeModel.find({
    someInteger: {
      min: 10,
      max: 40,
      offset: 15, // this in combination with the limit would work as a kind of pagination where only the 
      limit: 5
    },
    SomeTimestamp: {
      max: + new Date() // timestamp before now
    }
  }, function (err, ids) {
    
  });
{% endhighlight %}

You can also search for exact numeric values by using the syntax of a simple index search.

### Relations
Relations (links) are dynamically defined for each instance and not for a model. This differs from traditional ORMs that use RDBMS and thus need a predefined set of tables or columns to maintain these relations.  
In nohm this is not necessary making it possible for one instance of a model to have relations to models that other instances of the same model do not have.

A simple example:  
We have 2 instances of the UserModel: User1, User2  
We have 3 instances the RoleModel: Admin, Author, UserManager  
A user can have 0-3 roles.  
This creates an N:M relationship. In a traditional DB you'd now need a [pivot table](http://www.wellho.net/solutions/mysql-many-to-many-table-mapping-pivot-tables.html) and then you'd have to somehow tell your ORM that it should use that table to map these relations.  
In nohm this step is not needed.  
Instead we just tell every UserModel instance whatever relationships it has.  

This has the upside of more flexibility in relations, but the downside of more complexity maintaining these relations.  

In nohm all relations have a name pair. By default this pair is "child" and "parent". The instance that initiated the relationship is the child.  
This again has the upside of more flexibility in relations, but the downside of more complexity maintaining these relations. 

Some Examples:


{% highlight js %}
User1.link(Admin);
User1.link(Author);
User2.link(UserManager, 'createdBy');
User2.link(UserManager, 'temp');
{% endhighlight %}

Now (after saving) these relations exist:
* User1 (child) -> Admin (parent)
* User1 (child) -> Author (parent)
* User1 (createdBy) -> UserManager (createdByParent)
* User2 (temp) -> UserManager (tempParent)

Tip: Be careful with naming and don't overuse it!

#### link(otherInstance, [relationName,] [callback])
This creates a relation (link) to another instance.
The most basic usage is to just use the first argument 'otherInstance':

{% highlight js %}
User1.link(Admin);
{% endhighlight %}

This only creates the relation on the object holding the instance. In this case User1.
User1 as well as Admin may be unsaved instances at this time.
The relation is only written to the DB when User1 is saved. (not when Admin is saved manually though!)

{% highlight js %}
User1.save(function (err) {
  if ( ! err) {
    // User1 and Admin are saved
  } else {
    // an error occured while saving.
  }
});
{% endhighlight %}

There are several things that happen here:  
First User1 is validated. If User1 is invalid the save callback is called with the error.  
If User1 is valid, User1 is stored.  
If Admin has an ID, the relation is stored and the save callback is called.  
Otherwise Admin is validated. If Admin is invalid the save callback is called with the error. (currently you have to manually check where the error is. This is a known bug and should soon be fixed)  
If Admin is valid, Admin is stored, the relation is stored and the save callback is called.


This process works infinitely deep. However, I recommend to not do this since the process is not atomic!

If you define a callback in the link() call, that callback is called right after the link is stored to the db. This may make error handling in deep linked instances a little easier.

If you call save on an object that has relations to other objects that aren't saved yet, these objects are then saved as well.
That includes an internal call to .valid() on each relation.  
If you have an error in a related object, you still get an error in your original save, but the object is saved regardless.

To make it a little easier to manage such errors there are two more arguments passed to the save callback.  
The first is a boolean to tell you that the error was in a relation, the second is the modelName of that object.

{% highlight js %}
User1.save(function (err, relationError, relationName) {
  if ( ! err) {
    // User1 and Admin are saved
  } else {
    if (relationError) {
      // User1 is saved, Admin not.
      console.dir(Admin.errors); // holds the errors
      console.dir(relationName); // is the same as Admin.modelName
    } else {
      // neither User nor Admin are saved because User had an error
    }
  }
});
{% endhighlight %}


#### unlink(otherInstance, [relationName,] [callback])
Removes the relation to another instance and otherwise works the same as link.


#### has(otherInstance, [relationName,] [callback])
This checks if an instance has a relationship to another relationship.

{% highlight js %}
User1.has(Admin, function (err, hasAdmin) {
  if (hasAdmin) {
    // the user has the admin role!
  }
});
{% endhighlight %}

This requires that User1 as well as Admin are loaded from DB. (Or the same object was previously saved and thus still has the correct id)

#### numLinks(modelName, [relatioName,] [callback])
This checks how many relations of one name pair an Instance has to another Model.

{% highlight js %}
// assuming the relation definitions from above

User1.numLinks('RoleModel', function (err, num) {
  // num will be 2
  // note that it is not 3, because the default link name is used
});

// get the amount of links that are named 'createdBy':
User1.numLinks('RoleModel', 'createdBy', function (err, num) {
  // num will be 1
});

// get the amount of links that are named 'temp':
User1.numLinks('RoleModel', 'temp', function (err, num) {
  // num will be 0
});
{% endhighlight %}


#### getAll(modelName, [relatioName,] [callback])
This gets the IDs of all linked instances.

{% highlight js %}
User1.getAll('RoleModel', function (err, roleIds) {
  // roleIds = [1,2]
});

User1.getAll('RoleModel', 'createdBy', function (err, roleIds) {
  // roleIds = [3]
});

User2.getAll('RoleModel', 'temp', function (err, roleIds) {
  // roleIds = [3]
});
{% endhighlight %}


### Extras

Some things that don't really fit anywhere else in this documentation.

#### Short Forms

For some functions there are short forms.

Instead of having to do something like:
{% highlight js %}
  var user = new User();
  user.load(1, function () {
    user.p('name', 'test');
  });
{% endhighlight %}

You can do this:

{% highlight js %}
  User.load(1, function () {
    this.p('name', 'test');
  });
{% endhighlight %}

This currently works for the following functions: load, find, save and remove.
It is really only a shortcut.