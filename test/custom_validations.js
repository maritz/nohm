exports.customValidationFile = function (value, opt) {
  return Promise.resolve(value === 'customValidationFile');
};

exports.instanceValidation = function (value, opt) {
  return Promise.resolve(this.p(opt.property) === value);
};
