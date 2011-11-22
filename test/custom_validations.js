exports.customValidationFile = function (value, params) {
  if (params[0] && !value) {
    // optional and empty
    return true;
  } if (value === 'customValidationFile') {
    return true;
  } else {
    return false;
  }
};
