# IoTHub WebClient

Web application to connect to Azure IoT Hub from the browser

## MQTT in the browser

Azure IoT Hub support MQTT over web sockets enabling bi-directional communication.

This app uses the [Eclipse Paho JavaScript Client](https://www.eclipse.org/paho/clients/js/) to communicate to Azure IoT Hub as described in [Communicate with your IoT hub using the MQTT protocol](https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support)

## Sample code

```js
const client = new HubClient(host,
  this.connectionInfo.deviceId,
  this.connectionInfo.deviceKey,
  this.connectionInfo.modelId)

client.setDirectMehodCallback((method, payload) => {
        this.commands.push({ method, payload })
      })
        
        client.setDesiredPropertyCallback((desired) => {
          this.desiredJson = desired
        })

await client.connect()
```


## Authentication

Azure IoT Hub uses an HMAC signature to produce a SaS token used to authenticate the MQTT client. This client uses the HMAC primitives avaiable on modern browsers.

## Device features

Using MQTT the client can read **reported** and **desired** properties, but also **reported** properties can be updated.

Desired properties updates and **commands** will be received in a web socket callback.
