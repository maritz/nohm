exports.customValidationFile = function (value) {
  return Promise.resolve(value === 'customValidationFile');
};

exports.instanceValidation = function (value, opt) {
  return Promise.resolve(this.p(opt.property) === value);
};
