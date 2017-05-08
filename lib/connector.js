var net = 	require('net');
var bunyan =require('bunyan');
var mqtt = 	require('mqtt');

// Logger
var debug = process.env['DEBUG'] === 'true' || process.env['DEBUG'] === '1';
var logFile = process.env['LOG_FILE'] || '/tmp/output.log';
var log = bunyan.createLogger({
	name: process.env['LOG_NAME'] || 'spulmqttserver',
	streams: [{ level: 'warn', stream: process.stdout }, { level: debug ? 'debug' : 'info', path: logFile }]
});

// Exception handling
process.on('uncaughtException', function (err) {
	log.error({ type: 'uncaught-exception', stack: err.stack }, '' + err);
});

// Configuration
var timestampPort = parseInt(process.env['SPUL_TS_PORT']) || 9007;
var payloadPort   = parseInt(process.env['SPUL_PORT']) || 9008;
var socketTimeout = parseInt(process.env['SOCKET_TIMEOUT']) || 30 * 1000; // ms
var bigEndian 	  = process.env['BIG_ENDIAN'] !== 'false' && process.env['BIG_ENDIAN'] !== '0';
var headerSize 	  = 1 * process.env['HEADER_SIZE'] || 12;
var maxFrameSize  = 1 * process.env['MAX_FRAME_SIZE'] || 512 - headerSize;
var authToken 	  = process.env['AUTH_TOKEN'] || '';
var mqttHost      = process.env['MQTT_HOST'] || 'localhost';
var mqttUser      = process.env['MQTT_USER'] || '';
var mqttPass      = new Buffer(process.env['MQTT_PASS'] || '');
var mqttTopic     = process.env['MQTT_TOPIC'] || 'data';

// Timestamp server
var timestamps = net.createServer(function (socket) {
	socket.setTimeout(socketTimeout, socket.destroy);

	var timestamp = Math.round(Date.now() / 1000);
	var addr = socket.remoteAddress + socket.remotePort;

	log.info({ type: 'timestamp', timestamp: timestamp, addr: addr });

	var buf = new Buffer(4);
	buf[bigEndian ? 'writeUInt32BE' : 'writeUInt32LE'](timestamp);
	socket.end(buf);
}).on('close', function () {
	log.info('Timestamp server closed');
	process.exit(1);
}).on('error', function (err) {
	log.error('Timestamp error: ' + err);
});

timestamps.listen(timestampPort);
log.info('Timestamp server listening on ' + timestampPort);

// Payload server
var total = 0;
var payloadServer = net.createServer(function (socket) {
	socket.setTimeout(socketTimeout, socket.destroy);

	var addr = socket.remoteAddress + ':' + socket.remotePort;

	total += 1;
	log.debug({ type: 'connect', addr: addr, total: total });

	socket.on('close', function () {
		total -= 1;
		log.debug({ type: 'disconnect', addr: addr, total: total });
	});
	socket.on('error', function (err) {
		log.error({
			type: 'error', addr: addr, stack: err.stack
		}, '' + err);
	});
	socket.on('data', function (buf) {
		var timestamp = Math.round(Date.now() / 1000);
		var deviceId = buf.toString('hex', 0, 8);
		var blocks = buf.readInt8(8);
		var size = buf.readInt8(9);

		if (buf.length > headerSize + maxFrameSize) {
			log.error({
				type: 'error', timestamp: timestamp,
				addr: addr, deviceId: deviceId, blocks: blocks, size: size,
				payload: buf.slice(headerSize).toString('hex')
			}, 'Max frame size exceeded. Skipping');
			return;
		}

		log.info({
			type: 'data', timestamp: timestamp,
			addr: addr, deviceId: deviceId, blocks: blocks, size: size,
			payload: buf.slice(headerSize).toString('hex')
		});

		var client = mqtt.connect('mqtt://' + mqttHost, {
			clientId: deviceId,
			username: authToken == '' ? mqttUser : '',
			password: authToken == '' ? mqttPass : authToken,
			connectTimeout: 3000 });
		client.on('error', function (err) {
			log.error({
				type: 'error', timestamp: timestamp,
				addr: addr, deviceId: deviceId, topic: mqttTopic, buffer: buf.toString('hex'),
				stack: err.stack
			}, '' + err);
		});
		client.on('connect', function () {
			for (var i = 0; i < blocks; i += 1) {
				var start = headerSize + i * size;
				var payload = buf.slice(start, start + size);

				log.info({
					type: 'payload', timestamp: timestamp,
					addr: addr, deviceId: deviceId, topic: mqttTopic
				}, payload.toString('hex'));

				client.publish(mqttTopic, payload);
			}

			client.end();
		});
	});
}).on('close', function () {
	log.info('Payload server closed');
	process.exit(1);
}).on('error', function (err) {
	log.error('Payload error: ' + err);
});

payloadServer.listen(payloadPort);