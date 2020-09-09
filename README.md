# IoTHub WebClient

Web application to connect to Azure IoT Hub from the browser (no server code required), written completely in JavaScript ES6

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

## [https://mqtt.rido.dev](https://mqtt.rido.dev)

## MQTT in the browser

This app uses the [Eclipse Paho JavaScript Client](https://www.eclipse.org/paho/clients/js/) to communicate to Azure IoT Hub as described in [Communicate with your IoT hub using the MQTT protocol](https://docs.microsoft.com/azure/iot-hub/iot-hub-mqtt-support)

## Sample code

> requires paho to be added to the page using `<script>`

```js
import { AzIoTHubClient, ackPayload } from './AzIoTHubClient.js'

const client = new AzIoTHubClient(host, deviceId, deviceKey, modelId)

client.setDirectMehodCallback((method, payload, rid) => {
  const response = JSON.stringigy({ customResponse: 'cmdResponsePayload' })
  client.commandResponse(method, response, rid, 200)
})

client.setDesiredPropertyCallback((desired) => {
  const dco = JSON.parse(desired)
  const payload = ackPayload(dco, status, dco.$version)
  const updateResult = await client.updateTwin(JSON.stringify(payload))
})
await client.connect()
const twin = await client.getTwin()
await client.updateTwin('{}')
```

## Authentication

Azure IoT Hub uses an HMAC signature to produce a SaS token used to authenticate the MQTT client. This client uses the HMAC primitives avaiable on modern browsers.

## Features

- Connect using the PnP Convention (announce `model-id`) with SasKeys
- Read Device Twin (reported and desired properties)
- Update reported properties
- Receive desired properties
- ACK desired properties updates following the PnP convention
- Receive command request
- Reply commands with custom responses
- .d.ts typings

## Issues

- Connection failures are not shown in the UI

## Roadmap

- DPS client over MQTT
- DPS with master keys
- Suggest payloads from PnP models
- Create ES6 modules for paho js client
