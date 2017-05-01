const mqtt = require('mqtt');
const mqttHost = (process.env['MQTT_HOST'] || 'localhost')
var client = mqtt.connect('mqtt://' + mqttHost, {clientId: "0000000000000998", username:"username", password: new Buffer("password"), connectTimeout: 3000, })

client.on('connect', function () {
  client.subscribe('test');
  client.publish('test', '0000000000000998, Hey, here another test');
});

client.on('message', function (topic, message) {
  // message is Buffer
  console.log(message.toString());
  client.end();
});

