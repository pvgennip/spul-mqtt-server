const mqtt = require('mqtt');
const mqttHost = (process.env['MQTT_HOST'] || 'sensors.akvo.org');

console.log('connecting to '+mqttHost+'...');

var client = mqtt.connect('mqtt://' + mqttHost, {clientId: "0000E0DB40604500", username:"itay", password: new Buffer("sodaq"), connectTimeout: 3000, })

client.on('connect', function () {
  console.log('connected')
  //client.subscribe('ITAY/#');
  client.publish('ITAY/HAP/0000E0DB40604500', '0e6c1a5bb30000002a8b95f6ce');
});

client.on('message', function (topic, message) {
  // message is Buffer
  console.log(message.toString());
  client.end();
});

