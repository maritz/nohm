exports.customValidationFile = function (value, opt, callback) {
  callback(value === 'customValidationFile');
};

exports.instanceValidation = function (value, opt, callback) {
  callback(this.p(opt.property) === value);
};
