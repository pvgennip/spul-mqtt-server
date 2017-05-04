const net = require('net');

const host          = (process.env['SPUL_HOST'] || 'localhost') 
const bigEndian     = (process.env['BIG_ENDIAN'] !== 'false' && process.env['BIG_ENDIAN'] !== '0')
const timestampPort = (parseInt(process.env['SPUL_TS_PORT']) || 9007)
const payloadPort   = (parseInt(process.env['SPUL_PORT']) || 9008)

function rand (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

function testTimestamp (cb) {
	// Timestamps
	console.log('Connecting to timestamp server..')

	var client = net.Socket()

	client.connect(timestampPort, host, () => {
		console.log('Connected to timestamp server')
	})

	client.on('data', (buf) => {
		var timestamp = buf[bigEndian ? 'readUInt32BE' : 'readUInt32LE']()
		console.log('Received timestamp:', timestamp)
		client.destroy()
		cb()
	})
}

function testPayload (cb) {
	// Payload
	console.log('Connecting to payload server..')

	const frames = 5
	const maxNumBlocks = 3
	const maxBlockSize = 4
	const headerSize = 12
	const deviceId = '0000000000000538'
	const deviceIdBuf = new Buffer(deviceId, 'hex')

	for (let i = 0; i < frames; i += 1) {
		let client = net.Socket()

		client.connect(payloadPort, host, () => {
			console.log('Connected to payload server')

			let numBlocks = maxNumBlocks //rand(1, maxNumBlocks)
			let blockSize = maxBlockSize //rand(1, maxBlockSize)
			let buf = new Buffer(headerSize + numBlocks * blockSize)

			// TODO(mauvm): This is BE, so add writeUInt64LE.
			deviceIdBuf.copy(buf)

			buf.writeUInt8(numBlocks, 8)
			buf.writeUInt8(blockSize, 9)
			buf.writeUInt8(0, 10)
			buf.writeUInt8(0, 11)

			for (let j = 0; j < numBlocks * blockSize; j += 1) {
				buf.writeUInt8(rand(0, 255), j + headerSize)
			}
			console.log(buf)

			client.end(buf)
			client.destroy()
			if (i === frames - 1) cb()
		})
	}
}

testTimestamp(() => {
	testPayload(() => {
		console.log('Done.')
	})
})
