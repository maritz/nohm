import nohm from '../../ts/';

nohm.model('Tester', {
  properties: {
    dummy: {
      type: 'string',
    },
  },
  publish: true,
});

nohm.model('no_publish', {
  properties: {
    dummy: {
      type: 'string',
    },
  },
});
