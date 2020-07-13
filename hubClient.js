const WEB_SOCKET = '/$iothub/websocket?iothub-no-client-cert=true'
const DEVICE_TWIN_RES_TOPIC = '$iothub/twin/res/#'
const DEVICE_TWIN_GET_TOPIC = '$iothub/twin/GET/?$rid='
const DEVICE_TWIN_PUBLISH_TOPIC = '$iothub/twin/PATCH/properties/reported/?$rid='
const DIRECT_METHOD_TOPIC = '$iothub/methods/POST/#'
const DEVICE_TWIN_DESIRED_PROP_RES_TOPIC = '$iothub/twin/PATCH/properties/desired/#'

/**
 *
 * @param {String} key
 * @param {String} msg
 * @returns {Promise<string>}
 */
const createHmac = async (key, msg) => {
  const keyBytes = Uint8Array.from(window.atob(key), c => c.charCodeAt(0))
  const msgBytes = Uint8Array.from(msg, c => c.charCodeAt(0))
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' },
    true, ['sign']
  )
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgBytes)
  return window.btoa(String.fromCharCode(...new Uint8Array(signature)))
}

async function generateSasToken (resourceUri, signingKey, policyName, expiresInMins) {
  resourceUri = encodeURIComponent(resourceUri)
  var expires = (Date.now() / 1000) + expiresInMins * 60
  expires = Math.ceil(expires)
  var toSign = resourceUri + '\n' + expires
  var hmac = await createHmac(signingKey, toSign)
  var base64UriEncoded = encodeURIComponent(hmac)
  var token = 'SharedAccessSignature sr=' + resourceUri + '&sig=' + base64UriEncoded + '&se=' + expires
  if (policyName) token += '&skn=' + policyName
  return token
}

export class HubClient {
  /**
   * @param {string} host
   * @param {string} deviceId
   * @param {string} key
   * @param {string} [modelId]
   */
  constructor (host, deviceId, key, modelId) {
    this.connected = false
    this.host = host
    this.deviceId = deviceId
    this.key = key
    this.modelId = modelId
    this.rid = 0
    this.client = new Paho.MQTT.Client(this.host, Number(443), WEB_SOCKET, this.deviceId)
    this.c2dCallback = (method, payload) => {}
    this.desiredPropCallback = (desired) => {}
    this.disconnectCallback = (err) => { console.log(err) }
    this._onReadTwinCompleted = (twin) => {}
    this._onUpdateTwinCompleted = (updateResult) => {}
  }

  async connect () {
    let userName = `${this.host}/${this.deviceId}/?api-version=2020-05-31-preview`
    if (this.modelId) userName += `&model-id=${this.modelId}`
    const password = await generateSasToken(`${this.host}/devices/${this.deviceId}`, this.key, null, 60)
    return new Promise((resolve, reject) => {
      this.client.onConnectionLost = (err) => {
        console.log(err)
        this.connected = false
        this.disconnectCallback(err)
        reject(err)
      }

      const willMsg = new Paho.MQTT.Message('')
      willMsg.destinationName = 'willMessage'

      this.client.onMessageArrived = (/** @type {Paho.MQTT.Message} */ m) => {
        const destinationName = m.destinationName
        const payloadString = m.payloadString
        console.log('On Msg Arrived to ' + destinationName)
        console.log(payloadString)
        if (destinationName.indexOf('twin/res') > 0) {
          this._onReadTwinCompleted(payloadString)
        }
        if (destinationName.indexOf('methods/POST') > 1) {
          const methodName = destinationName.split('/')[3]
          this.c2dCallback(methodName, payloadString)
        }
        if (destinationName.indexOf('twin/PATCH/properties/desired') > 1) {
          this.desiredPropCallback(payloadString)
        }
      }
      this.client.connect({
        useSSL: true,
        userName: userName,
        timeout: 120,
        cleanSession: true,
        invocationContext: {},
        keepAliveInterval: 120,
        willMessage: willMsg,
        password: password,
        onSuccess: () => {
          this.connected = true
          console.log('Connected !!')
          this.client.subscribe(DEVICE_TWIN_RES_TOPIC, {
            qos: 0,
            invocationContext: {},
            onSuccess: () => { },
            onFailure: (err) => { throw err },
            timeout: 120
          })
          this.client.subscribe(DIRECT_METHOD_TOPIC, {
            qos: 0,
            invocationContext: {},
            onSuccess: () => { },
            onFailure: (err) => { throw err },
            timeout: 120
          })
          this.client.subscribe(DEVICE_TWIN_DESIRED_PROP_RES_TOPIC, {
            qos: 0,
            invocationContext: {},
            onSuccess: () => { },
            onFailure: (err) => { throw err },
            timeout: 120
          })
          resolve()
        }
      })
    })
  }

  /**
   * @return {Promise<DeviceTwin>}
   */
  getTwin () {
    return new Promise((resolve, reject) => {
      this.rid = Date.now()
      const readTwinMessage = new Paho.MQTT.Message('')
      readTwinMessage.destinationName = DEVICE_TWIN_GET_TOPIC + this.rid
      this._onReadTwinCompleted = (twin) => {
        resolve(JSON.parse(twin))
      }
      this.client.send(readTwinMessage)
    })
  }

  /**
   * @param {string} reportedProperties
   */
  updateTwin (reportedProperties) {
    this.rid = Date.now()
    const reportedTwinMessage = new Paho.MQTT.Message(reportedProperties)
    reportedTwinMessage.destinationName = DEVICE_TWIN_PUBLISH_TOPIC + this.rid
    this.client.send(reportedTwinMessage)
  }

  /**
   * @param {string} payload
   */
  sendTelemetry (payload) {
    const telemetryMessage = new Paho.MQTT.Message(payload)
    telemetryMessage.destinationName = `devices/${this.deviceId}/messages/events/`
    this.client.send(telemetryMessage)
  }

  /**
   * @param {{ (methodName: string, payload:string): void}} c2dCallback
   */
  setDirectMehodCallback (c2dCallback) {
    this.c2dCallback = c2dCallback
  }

  /**
   * @param {{ (desired: string): void}} desiredPropCallback
   */
  setDesiredPropertyCallback (desiredPropCallback) {
    this.desiredPropCallback = desiredPropCallback
  }
}
