# Nohm

[![Build Status](https://travis-ci.org/maritz/nohm.svg?branch=master)](https://travis-ci.org/maritz/nohm)
[![Dependency Status](https://david-dm.org/maritz/nohm.svg)](https://david-dm.org/maritz/nohm)
[![Known Vulnerabilities (Snyk)](https://snyk.io/test/github/maritz/nohm/badge.svg)](https://snyk.io/test/github/maritz/nohm)
[![Coverage Status](https://coveralls.io/repos/github/maritz/nohm/badge.png?branch=master)](https://coveralls.io/github/maritz/nohm?branch=master)

## Description

Nohm is an object relational mapper (ORM) written for node.js and redis written in Typescript.

### Features

- **Standard ORM features (validate, store, search, sort, link/unlink, delete)**
- **Share validations with browser.**  
  Allows using the same code for client validations that is used for backend. Includes filtering which validations are shared.
- **Subscribe to orm events (save, delete, link, unlink)**  
  With this you can do things like socket connections to get live updates from stored models.  
  Since it uses redis PUBSUB you can scale your node app and clients can connect to separate node app instances but will still get the same live updates.
- **Typescript typings**  
  nohm is written in Typescript and thus provides first-class typings for most things, including the option to type your model properties. This means if you use Typescript you don't have to remember every single property name of each model anymore, your IDE can tell you.
- **Dynamic relations**  
  This is a double-edged sword. Usually ORMs describe relations statically and you have to do database changes before you can add new relations.  
  In nohm all relations are defined and used at run-time, since there are no schemas stored in the database.

## Requirements

- redis >= 2.4

## Documentation

[v2 documentation](https://maritz.github.io/nohm/index.html)

[API docs](https://maritz.github.io/nohm/api/index.html)

[v1 documentation](http://maritz.github.com/nohm/)

[v1 to v2 migration guide](https://github.com/maritz/nohm/blob/master/CHANGELOG.md#v200-currently-in-alpha)

## Example

The [examples/rest-user-server](https://github.com/maritz/nohm/tree/master/examples/rest-user-server) is running as a demo on [https://nohm-example.maritz.space](https://nohm-example.maritz.space). It showcases most features on a basic level, including the shared validation and PubSub.

<details>

<summary>Example ES6 code (click to expand)</summary>

```javascript
import { Nohm, NohmModel, ValidationError } from 'nohm';
// or if your environment does not support module import
// const NohmModule = require('nohm'); // access NohmModule.Nohm, NohmModule.NohmModel and NohmModule.ValidationError

// This is the parent object where you set redis connection, create your models and some other configuration stuff
const nohm = Nohm;

nohm.setPrefix('example'); // This prefixes all redis keys. By default the prefix is "nohm", you probably want to change it to your applications name or something similar

// This is a class that you can extend to create nohm models. Not needed when using nohm.model()
const Model = NohmModel;

const existingCountries = ['Narnia', 'Gondor', 'Tatooine'];

// Using ES6 classes here, but you could also use the old nohm.model definition
class UserModel extends Model {
  getCountryFlag() {
    return `http://example.com/flag_${this.property('country')}.png`;
  }
}
// Define the required static properties
UserModel.modelName = 'User';
UserModel.definitions = {
  email: {
    type: 'string',
    unique: true,
    validations: ['email'],
  },
  country: {
    type: 'string',
    defaultValue: 'Narnia',
    index: true,
    validations: [
      // the function name will be part of the validation error messages, so for this it would be "custom_checkCountryExists"
      async function checkCountryExists(value) {
        // needs to return a promise that resolves to a bool - async functions take care of the promise part
        return existingCountries.includes(value);
      },
      {
        name: 'length',
        options: { min: 3 },
      },
    ],
  },
  visits: {
    type: function incrVisitsBy(value, key, old) {
      // arguments are always string here since they come from redis.
      // in behaviors (type functions) you are responsible for making sure they return in the type you want them to be.
      return parseInt(old, 10) + parseInt(value, 10);
    },
    defaultValue: 0,
    index: true,
  },
};

// register our model in nohm and returns the resulting Class, do not use the UserModel directly!
const UserModelClass = nohm.register(UserModel);

const redis = require('redis').createClient();
// wait for redis to connect, otherwise we might try to write to a non-existent redis server
redis.on('connect', async () => {
  nohm.setClient(redis);

  // factory returns a promise, resolving to a fresh instance (or a loaded one if id is provided, see below)
  const user = await nohm.factory('User');

  // set some properties
  user.property({
    email: 'mark13@example.com',
    country: 'Gondor',
    visits: 1,
  });

  try {
    await user.save();
  } catch (err) {
    if (err instanceof ValidationError) {
      // validation failed
      for (const key in err.errors) {
        const failures = err.errors[key].join(`', '`);
        console.log(
          `Validation of property '${key}' failed in these validators: '${failures}'.`,
        );

        // in a real app you'd probably do something with the validation errors (like make an object for the client)
        // and then return or rethrow some other error
      }
    }
    // rethrow because we didn't recover from the error.
    throw err;
  }
  console.log(`Saved user with id ${user.id}`);

  const id = user.id;

  // somewhere else we could then load the user again
  const loadedUser = await UserModelClass.load(id); // this will throw an error if the user cannot be found

  // alternatively you can use nohm.factory('User', id)

  console.log(`User loaded. His properties are %j`, loadedUser.allProperties());
  const newVisits = loadedUser.property('visits', 20);
  console.log(`User visits set to ${newVisits}.`); // Spoiler: it's 21

  // or find users by country
  const gondorians = await UserModelClass.findAndLoad({
    country: 'Gondor',
  });
  console.log(
    `Here are all users from Gondor: %j`,
    gondorians.map((u) => u.property('email')),
  );

  await loadedUser.remove();
  console.log(`User deleted from database.`);
});
```

</details>

<details>

<summary>Example Typescript code (click to expand)</summary>

```typescript
import { Nohm, NohmModel, TTypedDefinitions } from 'nohm';

// We're gonna assume the basics are clear and the connection is set up etc. - look at the ES6 example otherwise.
// This example highlights some of the typing capabilities in nohm.

interface IUserProperties {
  email: string;
  visits: number;
}

class UserModel extends NohmModel<IUserProperties> {
  public static modelName = 'User';

  protected static definitions: TTypedDefinitions<IUserProperties> = {
    // because of the TTypedDefinitions we can only define properties keys here that match our interface keys
    // the structure of the definitions is also typed
    email: {
      type: 'string', // the type value is currently not checked. If you put a wrong type here, no compile error will appear.
      unique: true,
      validations: ['email'],
    },
    visits: {
      defaultValue: 0,
      index: true,
      type: function incrVisitsBy(value, _key, old): number {
        return old + value; // TS Error: arguments are all strings, not assignable to number
      },
    },
  };

  public getVisitsAsString(): string {
    return this.property('visits'); // TS Error: visits is number and thus not assignable to string
  }

  public static async loadTyped(id: string): Promise<UserModel> {
    // see main() below for explanation
    return userModelStatic.load<UserModel>(id);
  }
}

const userModelStatic = nohm.register(UserModel);

async function main() {
  // currently you still have to pass the generic if you want typing for class methods
  const user = await userModelStatic.load<UserModel>('some id');
  // you can use the above defined loadTyped method to work around that.

  const props = user.allProperties();
  props.email; // string
  props.id; // any
  props.visits; // number
  props.foo; // TS Error: Property foo does not exist
  user.getVisitsAsString(); // string
}

main();
```

</details>

### More detailed examples

- [nohm/examples/rest-user-server](https://github.com/maritz/nohm/tree/master/examples/rest-user-server)
- [Beauvoir](https://github.com/yuchi/Beauvoir) Simple project management app - by yuchi (uses node v0.6 - very old)

Do you have code that should/could be listed here? Message me!

## Add it to your project

    npm install --save nohm

## Debug

Nohm uses the [debug](https://github.com/visionmedia/debug) module under the namespace "nohm". To see detailed debug logging set the environment variable DEBUG accordingly:

    DEBUG="nohm:*" node yourApp.js

Available submodule debug namespaces are `nohm:index`, `nohm:model`, `nohm:middleware`, `nohm:pubSub` and `nohm:idGenerator`.

## Developing nohm

If you want to make changes to nohm, you can fork or clone it. Then install the dependencies:

    npm install

and run the development scripts (compile & watch & tests):

    npm run dev

When submitting PRs, please make sure that you run the linter and that everything still builds fine.
The easiest way to do that is to run the `prepublishOnly` script:

    npm run prepublishOnly

## Running tests

Build the javascript files:

    npm run build

Then run the tests:

    npm run test
    # or
    npm run test:watch

This requires a running redis server. (you can configure host/port with the command line arguments --redis-host 1.1.1.1 --redis-port 1234)

**WARNING**: The tests also create a lot of temporary keys in your database that look something like this:

    nohmtestsuniques:something:something

After the tests have run all keys that match the pattern nohmtests\* are deleted!

You can change the prefix ("nohmtests") part doing something like

    node test/tests.js --nohm-prefix YourNewPrefix

Now the keys will look like this:

    YourNewPrefixuniques:something:something
