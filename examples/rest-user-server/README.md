# Simple example of a basic REST api using nohm

_WARNING_: There are many things in this example that should never be done in a real app.
For example sending out the passwords, don't do that. It's just for demo purposes here.

## Requirements

To run this example you need a local redis database with the default port open.

The app will create keys in it with the prefix '`rest-user-server-example:`'!

## See it live

An online version can be found at [https://nohm-example.maritz.space/](https://nohm-example.maritz.space/).

## Run it

Install dependencies:

    npm install

Then run it with

    node rest-server.js

Go to [http://localhost:3000](http://localhost:3000)

## Run it in docker

Alternatively you can use the docker-compose config to run a contained redis and node app.

    docker-compose up --build
