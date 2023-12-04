const WEB_SOCKET = '/$iothub/websocket?iothub-no-client-cert=true'
const DEVICE_TWIN_RES_TOPIC = '$iothub/twin/res/#'
const DEVICE_TWIN_GET_TOPIC = '$iothub/twin/GET/?$rid='
const DEVICE_TWIN_PUBLISH_TOPIC = '$iothub/twin/PATCH/properties/reported/?$rid='
const DIRECT_METHOD_TOPIC = '$iothub/methods/POST/#'
const DEVICE_TWIN_DESIRED_PROP_RES_TOPIC = '$iothub/twin/PATCH/properties/desired/#'
const DIRECT_METHOD_RESPONSE_TOPIC = '$iothub/methods/res/{status}/?$rid='

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

/**
 * @param {string} resourceUri
 * @param {string} signingKey
 * @param {string | null} policyName
 * @param {number} expiresInMins
 * @returns {Promise<string>}
 */
async function generateSasToken (resourceUri, signingKey, policyName, expiresInMins) {
  resourceUri = encodeURIComponent(resourceUri)
  let expires = (Date.now() / 1000) + expiresInMins * 60
  expires = Math.ceil(expires)
  const toSign = resourceUri + '\n' + expires
  const hmac = await createHmac(signingKey, toSign)
  const base64UriEncoded = encodeURIComponent(hmac)
  let token = 'SharedAccessSignature sr=' + resourceUri + '&sig=' + base64UriEncoded + '&se=' + expires
  if (policyName) token += '&skn=' + policyName
  return token
}

export class AzIoTHubClient {
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

    /**
     * @description Callback when a commnand invocation is received
     * @param {string} method
     * @param {string} payload
     * @param {number} rid
     */
    this.c2dCallback = (method, payload, rid) => { }

    /**
     * @description Callback for desired properties upadtes
     * @param {string} desired
     */
    this.desiredPropCallback = (desired) => { }
    /**
     * @param {any} err
     */
    this.disconnectCallback = (err) => { console.log(err) }
    /**
     * @param {any} twin
     */
    this._onReadTwinCompleted = (twin) => { }
    this._onUpdateTwinCompleted = () => { }
  }

  /**
   * @description Connects to Azure IoT Hub using MQTT over websockets
   */
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
        // console.log('On Msg Arrived to ' + destinationName)
        // console.log(payloadString)
        if (destinationName === '$iothub/twin/res/200/?$rid=' + this.rid) {
          this._onReadTwinCompleted(payloadString)
        }
        if (destinationName.startsWith('$iothub/twin/res/204/?$rid=' + this.rid)) {
          this._onUpdateTwinCompleted()
        }
        if (destinationName.indexOf('methods/POST') > 1) {
          const destParts = destinationName.split('/') // $iothub/methods/POST/myCommand/?$rid=2
          const methodName = destParts[3]
          const ridPart = destParts[4]
          const rid = parseInt(ridPart.split('=')[1])
          this.c2dCallback(methodName, payloadString, rid)
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
          resolve(this.deviceId)
        }
      })
    })
  }

  /**
   * @return {Promise<DeviceTwin>}
   */
  getTwin () {
    this.rid = Date.now()
    // console.log(this.rid)
    const readTwinMessage = new Paho.MQTT.Message('')
    readTwinMessage.destinationName = DEVICE_TWIN_GET_TOPIC + this.rid
    this.client.send(readTwinMessage)
    return new Promise((resolve, reject) => {
      /**
       * @param {string} twin
       */
      this._onReadTwinCompleted = (twin) => {
        resolve(JSON.parse(twin))
      }
    })
  }

  /**
   * @param {string} reportedProperties
   */
  updateTwin (reportedProperties) {
    this.rid = Date.now()
    // console.log(this.rid)
    const reportedTwinMessage = new Paho.MQTT.Message(reportedProperties)
    reportedTwinMessage.destinationName = DEVICE_TWIN_PUBLISH_TOPIC + this.rid
    this.client.send(reportedTwinMessage)
    return new Promise((resolve, reject) => {
      this._onUpdateTwinCompleted = () => {
        resolve(204)
      }
    })
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
   * @param {{ (methodName: string, payload:string, rid:number): void}} c2dCallback
   */
  setDirectMehodCallback (c2dCallback) {
    this.c2dCallback = c2dCallback
  }

  /**
   * @param {string} methodName
   * @param {string} payload
   * @param {number} rid
   * @param {number} status
   */
  commandResponse (methodName, payload, rid, status) {
    const response = new Paho.MQTT.Message(payload)
    response.destinationName = DIRECT_METHOD_RESPONSE_TOPIC.replace('{status}', status.toString()) + rid.toString()
    this.client.send(response)
  }

  /**
   * @param {{ (desired: string): void}} desiredPropCallback
   */
  setDesiredPropertyCallback (desiredPropCallback) {
    this.desiredPropCallback = desiredPropCallback
  }
}

export /**
 * @param {{ [x: string]: any; }} propValues
 * @param {number} ac
 * @param {number} av
 */
const ackPayload = (propValues, ac, av) => {
  const payload = {}
  Object.keys(propValues).filter(k => k !== '$version').forEach(k => {
    const value = propValues[k]
    if (value.__t === 'c') { // is Component
      delete value.__t
      payload[k] = { __t: 'c' }
      Object.keys(value).forEach(v => {
        payload[k][v] = { ac, av, value: value[v] }
      })
    } else {
      payload[k] = { ac, av, value }
    }
  })
  return payload
}
