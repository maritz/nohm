var util = require('util'),
redis = require('redis'),
h = require(__dirname + '/helpers');

/**
 * The Nohm object used for some general configuration and model creation.
 * @namespace Nohm
 */
function Nohm () {
}

/**
 * The redis key prefix.
 * Defaults to 'nohm' which then creates keys like 'nohm:idsets:someModel'.
 */
Nohm.prefix = h.getPrefix('nohm');
Nohm.indexNumberTypes = ['integer', 'float', 'timestamp'];
Nohm.client = null;
Nohm.meta = false; // default: do not save meta data of models to the database for the administration tool.
Nohm.meta_saved_models = [];

Nohm.model = function (name, options) {
  var obj = function (id) {
    this.init(name, options);
    if(typeof(id) === 'number') {
      this.id = id;
      this.load(id);
    }
  };
  obj.prototype = new Nohm();
  return obj;
};

Nohm.logError = function logError(err) {
  if (err) {
    console.dir({
      name: "Nohm Error",
      message: err
    });
  }
};


Nohm.prototype.getHashKey = function (id) {
  return Nohm.prefix.hash + this.modelName + ':' + id;
};

Nohm.prototype.getClient = function () {
  return this.client || Nohm.client;
};

Nohm.prototype.init = function (name, options) {
  if ( ! name )
    this.logError('When creating a new model you have to provide a name!');
    
  this.modelName = name;
    
  if (typeof(options.client) === 'undefined' && Nohm.client === null)
    Nohm.logError('Did not find a viable redis client in Nohm or the model: '+name);
    
  if (typeof(options.client) !== 'undefined') {
    this.client = options.client;
  }
  
  this.properties = {};
  this.errors = {};
  
  // initialize the properties
  if (options.hasOwnProperty('properties')) {
    for (var p in options.properties) {
      if (options.properties.hasOwnProperty(p)) {
        this.properties[p] = h.$extend(true, {}, options.properties[p]); // deep copy
        this.property(p, options.properties[p].value || 0); // this ensures typecasing/behaviours
        this.__resetProp(p);
        this.errors[p] = [];
    
        if ( Nohm.meta && ! Nohm.meta_saved_models.hasOwnProperty(this.modelName)) {
          // try saving the meta data of this model
          var metaargs = [Nohm.prefix.meta + this.modelName, p, JSON.stringify(this.properties[p])];
          client.hmset(metaargs);
        }
      }
    }
  }

  this.relationChanges = [];

  this.id = null;
  this.__inDB = false;
  this.__loaded = false;
};

Nohm.setClient = function (client) {
  Nohm.client = client;
};

var moduleNames = ['properties', 'retrieve', 'validation', 'store', 'relations'],
    modules = {};

moduleNames.forEach(function (name) {
  // first integrate all the modules
  modules[name] = require(__dirname+'/'+name);
  h.prototypeModule(Nohm, modules[name]);
});
moduleNames.forEach(function (name) {
  // then give them the complete Nohm.
  if (typeof(modules[name].setNohm) !== 'undefined')
    modules[name].setNohm(Nohm);
});

exports.Nohm = Nohm;

