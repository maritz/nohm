var nohm = require(__dirname+'/../../lib/nohm').Nohm;

nohm.model('Tester', {
  properties: {
    dummy: {
      type: 'string'
    }
  },
  publish: true
});

nohm.model('no_publish', {
  properties: {
    dummy: {
      type: 'string'
    }
  }
});