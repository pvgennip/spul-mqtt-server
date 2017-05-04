import net from 'net'
import bunyan from 'bunyan'
import mqtt from 'mqtt'

var env = require('node-env-file');
env('.env');

// Logger
const debug = (process.env['DEBUG'] === 'true' || process.env['DEBUG'] === '1')
const logFile = (process.env['LOG_FILE'] || '/tmp/output.log')
const log = bunyan.createLogger({
	name: (process.env['LOG_NAME'] || 'concava-connector-spul'),
	streams: [
		{ level: 'warn', stream: process.stdout },
		{ level: (debug ? 'debug' : 'info'), path: logFile }
	]
})

// Exception handling
process.on('uncaughtException', (err) => {
	log.error({ type: 'uncaught-exception', stack: err.stack }, '' + err)
})

// Configuration
const timestampPort = (parseInt(process.env['SPUL_TS_PORT']) || 3333)
const payloadPort   = (parseInt(process.env['SPUL_PORT']) || 5555)
const socketTimeout = (parseInt(process.env['SOCKET_TIMEOUT']) || 30 * 1000) // ms
const bigEndian     = (process.env['BIG_ENDIAN'] !== 'false' && process.env['BIG_ENDIAN'] !== '0')
const headerSize    = (1 * process.env['HEADER_SIZE'] || 12)
const maxFrameSize  = (1 * process.env['MAX_FRAME_SIZE'] || (512 - headerSize))
const mqttHost      = (process.env['MQTT_HOST'] || 'localhost')
const mqttUser      = (process.env['MQTT_USER'] || '')
const mqttPass      = new Buffer(process.env['MQTT_PASS'] || '');
const mqttTopic     = (process.env['MQTT_TOPIC'] || 'data');

// Timestamp server
var timestamps = net.createServer((socket) => {
	socket.setTimeout(socketTimeout, socket.destroy)

	var timestamp = Math.round(Date.now() / 1000)
	var addr = socket.remoteAddress + socket.remotePort

	log.info({ type: 'timestamp', timestamp, addr })

	var buf = new Buffer(4)
	buf[bigEndian ? 'writeUInt32BE' : 'writeUInt32LE'](timestamp)
	socket.end(buf)
}).on('close', () => {
	log.info('Timestamp server closed')
	process.exit(1)
}).on('error', (err) => {
	log.error('Timestamp error: ' + err)
})

timestamps.listen(timestampPort)
log.info('Timestamp server listening on ' + timestampPort)

log.info('MQTT host: ' + mqttHost)

// Payload server
var total = 0
var payloadServer = net.createServer((socket) => {
	socket.setTimeout(socketTimeout, socket.destroy)

	var addr = socket.remoteAddress + ':' + socket.remotePort

	total += 1
	log.debug({ type: 'connect', addr, total })

	socket.on('close', () => {
		total -= 1
		log.debug({ type: 'disconnect', addr, total })
	})
	socket.on('error', (err) => {
		log.error({
			type: 'error', addr, stack: err.stack
		}, '' + err)
	})
	socket.on('data', (buf) => {
		var timestamp = Math.round(Date.now() / 1000)
		var deviceId  = buf.toString('hex', 0, 8)
		var blocks = buf.readInt8(8)
		var size = buf.readInt8(9)

		if (buf.length > headerSize + maxFrameSize) {
			log.error({
				type: 'error', timestamp,
				addr, deviceId, blocks, size,
				payload: buf.slice(headerSize).toString('hex'),
			}, 'Max frame size exceeded. Skipping')
			return
		}

		log.info({
			type: 'data', timestamp,
			addr, deviceId, blocks, size,
			payload: buf.slice(headerSize).toString('hex')
		})

		var client = mqtt.connect('mqtt://' + mqttHost, {
			clientId: deviceId,
			username: authToken == '' ? mqttUser : '',
			password: authToken == '' ? mqttPass : authToken,
			connectTimeout: 3000, // ms
		})
		client.on('error', function(err)
		{
			log.error({
				type: 'error', timestamp,
				addr, deviceId, buffer: buf.toString('hex'),
				stack: err.stack
			}, '' + err)
		})
		client.on('connect', function()
		{
			for (let i = 0; i < blocks; i += 1) {
				let start = headerSize + i * size
				let payload = buf.slice(start, start + size)

				log.info({
					type: 'payload', timestamp,
					addr, deviceId, mqttTopic
				}, payload.toString('hex'))

				client.publish(mqttTopic, payload)
			}

			client.end()
		})
	})
}).on('close', () => {
	log.info('Payload server closed')
	process.exit(1)
}).on('error', (err) => {
	log.error('Payload error: ' + err)
})

payloadServer.listen(payloadPort)
log.info('Payload server listening on ' + payloadPort)
