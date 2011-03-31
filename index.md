---
title: Index
layout: default
---

## Api
You can find the api <a href="api/index.html">here</a>.
## How To
### Overview
Nohm is an [ORM](http://en.wikipedia.org/wiki/Object-relational_mapping "Object-relational Mapping") for [redis](http://www.redis.io).

**Note:** Almost all code examples here assume that you've required nohm like this: 
{% highlight js %}
  var nohm = require('nohm').Nohm;
  var redisClient = require('redis').createClient();
  nohm.setClient(redisClient);
{% endhighlight %}
### Basics
There are some things you need to do before you can use nohm. If you just want to know how actually use nohm models, skip to the next part "Models".

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

<small>Strictly speaking the properties are optional as well, but a model really doesn't make sense without them.</small>

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
      <code>string, number, float, boolean, timestamp and json</code><br/>
    You can also define a behaviour. This is a function that type-casts the value in whatever way you want.
  </dd>
  <dt>
    value <span class="additionalInfo">Any value</span>
  </dt>
  <dd>
    The default value a property will have when the model is initialized.
    **Note**: If you do not define a default value, it will be 0.
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
<small><bold>bold</bold> = mandatory</small>

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
      value: '',
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

###### Number / Float
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
      value: 0,
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

##### Validations
A property can have multiple validators. These are invoked whenever a model is saved or manually validated.
Validations of a property are defined as an array of strings , arrays and functions.

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
    password: {
      value: '',
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


The following validations are built in:


### Typecasts/Behaviours
### Saving/Updating/Deleting
### Loading
### Finding
### Relations
