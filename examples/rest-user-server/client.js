/*global $, nohmValidations, io, confirm, alert */
$(function() {
  const $userList = $('#users tbody');
  const updateUserList = function() {
    $.get('/User/list', function(response) {
      $userList.empty();
      $.each(response, function(index, item) {
        const createdAt = new Date(parseInt(item.createdAt, 10));
        const updatedAt = new Date(parseInt(item.updatedAt, 10));
        $userList.append(
          $(`
          <tr>
            <td title="${item.id}">${item.id}</td>
            <td title="${item.name}">${item.name}</td>
            <td title="${item.email}">${item.email}</td>
            <td title="${item.password}">${item.password}</td>
            <td title="${createdAt.toISOString()}">${createdAt.toLocaleString()}</td>
            <td title="${updatedAt.toISOString()}">${updatedAt.toLocaleString()}</td>
            <td><a name="edit-user" href="#">Edit</a></td>
            <td><a name="remove-user" href="#">Remove</a></td>
          </tr>
          `).data('raw', item),
        );
      });
    });
  };
  $userList.on('click', 'tbody a[name="edit-user"]', function(target) {
    const data = $(target.currentTarget)
      .parents('tr')
      .data('raw');
    Object.keys(data).forEach((key) => {
      if (key !== 'password') {
        $(`form input[name="${key}"]`).val(data[key]);
      }
    });
  });
  $userList.on('click', 'tbody a[name="remove-user"]', function(target) {
    const data = $(target.currentTarget)
      .parents('tr')
      .data('raw');
    const confirmed = confirm('Delete user?');
    if (confirmed) {
      $.ajax(`/User/${data.id}`, {
        data,
        type: 'DELETE',
      })
        .done(updateUserList)
        .fail(failHandler)
        .always(finalHandler);
    }
  });
  updateUserList();

  const failHandler = ($form) => {
    return (jqXHR) => {
      const status = jqXHR.status;
      const errorSource = status < 500 ? 'Client' : 'Server';
      $form
        .find('ul[name=errors]')
        .append(`<li>${errorSource} error: ${jqXHR.responseText}`);
    };
  };
  const finalHandler = ($form) => {
    return () => {
      $form.find('fieldset').attr('disabled', false);
    };
  };

  const $editForm = $('form#edit');
  $editForm.submit(function(e) {
    e.preventDefault();

    const data = {};
    const id = $editForm.find('input[name="id"]').val();
    const idSet = id.length !== 0;
    $editForm.find('input').each(function() {
      const $this = $(this);
      if ($this.attr('type') === 'submit') {
        return;
      }
      const name = $this.attr('name');
      const value = $this.val();
      if (name === 'password' && idSet && value.length === 0) {
        // when id is set, we don't need a new password every time
        return;
      }
      data[name] = value;
    });
    nohmValidations.validate('User', data).then((validation) => {
      $editForm.find('ul[name=errors]').empty();
      if (validation.result) {
        $editForm.find('fieldset').attr('disabled', true);
        if (idSet) {
          $.ajax(`/User/${id}`, {
            data,
            type: 'PUT',
          })
            .done(updateUserList)
            .fail(failHandler($editForm))
            .always(finalHandler($editForm));
        } else {
          $.post('/User/', data)
            .done(updateUserList)
            .fail(failHandler($editForm))
            .always(finalHandler($editForm));
        }
      } else {
        $.each(validation.errors, function(index, error) {
          $editForm
            .find('ul[name=errors]')
            .append(
              '<li>Client validation error: ' +
                index +
                ': ' +
                JSON.stringify(error),
            );
        });
      }
    });
  });

  const $loginForm = $('form#login');
  $loginForm.submit(function(e) {
    e.preventDefault();

    const data = {
      name: $loginForm.find('input[name="name"]').val(),
      password: $loginForm.find('input[name="password"]').val(),
    };
    nohmValidations.validate('User', data).then((validation) => {
      $loginForm.find('ul[name=errors]').empty();
      if (validation.result) {
        $loginForm.find('fieldset').attr('disabled', true);
        $.post('/User/login', data)
          .done(() => {
            alert('Login worked!');
          })
          .fail(failHandler($loginForm))
          .always(finalHandler($loginForm));
      } else {
        $.each(validation.errors, function(index, error) {
          $loginForm
            .find('[name="errors"]')
            .append(
              '<li>Client validation error: ' +
                index +
                ': ' +
                JSON.stringify(error),
            );
        });
      }
    });
  });

  const $eventLog = $('#eventlog');
  const socket = io();
  socket.on('nohmEvent', function(msg) {
    $eventLog.append($('<li>').text(JSON.stringify(msg)));
  });
});
