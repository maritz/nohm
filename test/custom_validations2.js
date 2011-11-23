exports.customValidationFileTimesTwo = function (value, params) {
  if (params[0] && !value) {
    // optional and empty
    return true;
  } if (value === 'customValidationFileTimesTwo') {
    return true;
  } else {
    return false;
  }
};
