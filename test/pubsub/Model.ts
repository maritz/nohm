import nohm from '../../ts/';

export const register = (passedNohm) => {
  passedNohm.model('Tester', {
    properties: {
      dummy: {
        type: 'string',
      },
    },
    publish: true,
  });

  passedNohm.model('no_publish', {
    properties: {
      dummy: {
        type: 'string',
      },
    },
  });
};

register(nohm);
