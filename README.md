# SPUL Connector

> SPUL connector for splitting spul buffers into payloads and forwarding it to MQTT.

## Documentation

The project documentation is hosted on [http://kukua.github.io/concava-connector-spul/](http://kukua.github.io/concava-connector-spul/).

## Installation

The SPUL connector can be run as a NodeJS program or in a Docker container.

Make sure [ConCaVa](https://github.com/kukua/concava) is setup as well.
See [`.env.example`](https://github.com/pvgennip/spul-mqtt-server/tree/master/.env.example) for the default configuration.

### NodeJS

```bash
git clone https://github.com/pvgennip/spul-mqtt-server.git
cd spul-mqtt-server
cp .env.example .env
chmod 600 .env
# > Edit .env

npm install
npm run compile
source .env
npm start
```

Tested with NodeJS v5.1

### Docker

First, [install Docker](http://docs.docker.com/engine/installation/). Then run:

```bash
curl https://raw.githubusercontent.com/pvgennip/spul-mqtt-server/master/.env.example > .env
chmod 600 .env
# > Edit .env

docker run -d -p 3333:3333 -p 5555:5555 \
	-v ./spul.log:/tmp/output.log
	--env-file .env --name spul-mqtt-server \
	pvgennip/spul-mqtt-server
```

Tested with Docker v1.9.

## Test

Make sure a SPUL container is running with the name 'spul-mqtt-server'. Then run:

```js
source .env
npm test
docker logs spul-mqtt-server
```

## Contribute

Your help and feedback are highly appreciated!

## License

This software is licensed under the [MIT license](https://github.com/kukua/concava-connector-spul/blob/master/LICENSE).

© 2016 Kukua BV
