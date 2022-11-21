import { generateSasToken } from './SasToken.js'
// const WEB_SOCKET = '/$iothub/websocket?iothub-no-client-cert=true'
// const REGISTRATION_TOPIC = '$dps/registrations/res/#'
// const REGISTER_TOPIC = '$dps/registrations/PUT/iotdps-register/?$rid='

export class AzDpsClient {
  constructor (scopeId, deviceId, deviceKey, modelId) {
    this.host = 'global.azure-devices-provisioning.net'
    this.scopeId = scopeId
    this.deviceId = deviceId
    this.deviceKey = deviceKey
    this.modelId = modelId
    // @ts-ignore
    this.client = new Paho.MQTT.Client(this.host, Number(443), '/mqtt', this.deviceId)
  }

  async registerDevice () {
    const resource = `${this.scopeId}/registrations/${this.deviceId}`
    const username = `${resource}/api-version=2019-03-31`
    const password = await generateSasToken(resource, this.deviceKey, null, 5)
    console.log(username, password)
    return new Promise((resolve, reject) => {
      console.log(this.client.host)
      this.client.connect({
        useSSL: true,
        userName: username,
        password: password,
        cleanSession: true,
        onSuccess: () => {
          console.log('DPS client connected')
          this.client.onMessageArrived = m => {
            const topic = m.destinationName
            console.log(topic)
            if (topic.startsWith('$dps/registrations/res/')) {
              const jspayload = JSON.parse(m.payloadString)
              console.log(jspayload)
            }
          }
          this.client.subscribe('$dps/registrations/res/#')
        },
        onFailure: err => {
          console.error(err)
        }
      })
    })
  }

  //   const endpoint = 'https://dps-proxy.azurewebsites.net/register'
  //   const url = `${endpoint}?scopeId=${this.scopeId}&deviceId=${this.deviceId}&deviceKey=${encodeURIComponent(this.deviceKey)}&modelId=${this.modelId}`
  //   console.log(url)
  //   const response = await fetch(url, {
  //     method: 'GET',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Content-Encoding': 'utf-8'
  //     }
  //   })
  //   const resp = await response.json()
  //   console.log(resp)
  //   return resp
  // }
}
