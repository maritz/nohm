var nohm = require(__dirname + '/../tsOut/').Nohm;
var redisPromise = require(__dirname + '/../tsOut/typed-redis-helper');
const args = require(__dirname + '/testArgs.js');

const redis = args.redis;

exports['#114 update does not reset index'] = async (t) => {
  t.expect(3);

  // https://github.com/maritz/nohm/issues/114

  nohm.model('Regression114Model', {
    properties: {
      uniqueDeletion: {
        type: 'string',
        unique: true,
      },
      isActive: {
        type: 'boolean',
        index: true,
        defaultValue: true,
      },
      scoredIndex: {
        type: 'number',
        index: true,
        defaultValue: 1,
      },
    },
    idGenerator: 'increment',
  });

  var instance = await nohm.factory('Regression114Model');
  instance.property({ uniqueDeletion: 'one' });

  var instance2 = await nohm.factory('Regression114Model');
  instance2.property({
    uniqueDeletion: 'two',
    isActive: false,
    scoredIndex: 123,
  });

  var instance3 = await nohm.factory('Regression114Model');
  instance3.property({ uniqueDeletion: 'three' });
  await Promise.all([instance.save(), instance2.save(), instance3.save()]);

  var instance2Activated = await nohm.factory('Regression114Model');
  instance2Activated.id = instance2.id;
  instance2Activated.property({
    uniqueDeletion: 'twoDelete',
    isActive: true,
  });
  await instance2Activated.save();

  const membersTrue = await redisPromise.smembers(
    redis,
    `${instance2Activated.prefix('index')}:isActive:true`,
  );

  t.same(
    membersTrue,
    [instance.id, instance2.id, instance3.id],
    'Not all instances were properly indexed as isActive:true',
  );

  const membersFalse = await redisPromise.smembers(
    redis,
    `${instance2Activated.prefix('index')}:isActive:false`,
  );

  t.same(membersFalse, [], 'An index for isActive:false remained.');

  const uniqueExists = await redisPromise.exists(
    redis,
    `${instance2Activated.prefix('unique')}:uniqueDeletion:two`,
  );

  t.same(uniqueExists, false, 'A unique key of a changed property remained.');

  t.done();
};
