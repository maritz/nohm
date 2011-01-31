var Ni = require('ni');


Ni.config('user', 'maritz');
Ni.config('password', 'password');

Ni.config('root', __dirname);

Ni.config('port', 3003);
Ni.config('host', null);


// redis
Ni.config('redis_prefix', 'nohm');
Ni.config('redis_host', '127.0.0.1');
Ni.config('redis_port', '6385');
Ni.config('redis_general_db', 1);
Ni.config('redis_session_db', 4);
Ni.config('redis_nohm_db', 3);

// cookies
Ni.config('cookie_key', 'nohm-admin');
Ni.config('cookie_secret', 'add your secret here!');