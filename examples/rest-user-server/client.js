$(function () {
  var updateUserList = function () {
    $.get('/User/list', function (response) {
      var $ul = $('#users');
      $ul.empty();
      $.each(response, function (index, item) {
        $ul.append('<li>'+JSON.stringify(item)+'</li>');
      });
    });
  }
  updateUserList();
  $('#refreshusers').click(updateUserList);

  $('form').submit(function (e) {
    e.preventDefault();

    var data = {};
    $('input').each(function () {
      var $this = $(this);
      data[$this.attr('name')] = $this.val();
    });
    nohmValidations.validate('User', data, function (valid, errors) {
      $('#errors').empty();
      if (valid) {
        $('form').attr('disabled', true);
        $.post('/User/create', data, function (response) {
          if (response.result === 'success') {
            updateUserList();
          } else {
            $('#errors').append('<li>Server failure: '+response.data);
          }
        });
      } else {
        $.each(errors, function (index, error) {
          $('#errors').append('<li>'+index+': '+JSON.stringify(error));
        });
      }
    });
  });
});