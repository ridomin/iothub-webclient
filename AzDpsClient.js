const REGISTRATION_TOPIC = '$dps/registrations/res/#'
const REGISTER_TOPIC = '$dps/registrations/PUT/iotdps-register/?$rid='

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

export class AzDpsClient {
  constructor (scopeId, deviceId, key) {
    this.host = 'global.azure-devices-provisioning.net'
    this.scopeId = scopeId
    this.deviceId = deviceId
    this.key = key
    this.client = new Paho.MQTT.Client(this.host, Number(443), deviceId)

    this._onReadTwinCompleted = (twin) => {}
  }

  async connect () {
    const userName = `${this.scopeId}/registrations/${this.deviceId}/api-version=2019-03-31`
    const password = await generateSasToken(`${this.scopeId}/registrations/${this.deviceId}`, this.key, 'registration', 60)

    return new Promise((resolve, reject) => {
      const willMsg = new Paho.MQTT.Message('')
      willMsg.destinationName = 'willMessage'

      this.client.onMessageArrived = (/** @type {Paho.MQTT.Message} */ m) => {
        const destinationName = m.destinationName
        const payloadString = m.payloadString
        console.log('On Msg Arrived to ' + destinationName)
        console.log(payloadString)
        if (destinationName === REGISTRATION_TOPIC) {
          this._onReadTwinCompleted(payloadString)
        }
      }

      this.client.connect({
        useSSL: true,
        userName: userName,
        timeout: 120,
        cleanSession: false,
        invocationContext: {},
        keepAliveInterval: 120,
        willMessage: willMsg,
        password: password,
        onSuccess: () => {
          this.connected = true
          console.log('Connected !!')
          this.client.subscribe(REGISTRATION_TOPIC, {
            qos: 0,
            invocationContext: {},
            onSuccess: () => { },
            onFailure: (err) => { throw err },
            timeout: 120
          })
          resolve()
        },
        onFailure: (e) => console.log(e)
      })
    })
  }

  async register () {
    if (!this.connected) throw new Error('not connected')
    this.rid = Date.now()
    console.log(this.rid)
    const registerMessage = new Paho.MQTT.Message('')
    registerMessage.destinationName = REGISTER_TOPIC + this.rid
    this.client.send(registerMessage)
    return new Promise((resolve, reject) => {
      /**
       * @param {string} twin
       */
      this._onReadTwinCompleted = (twin) => {
        resolve(JSON.parse(twin))
      }
    })
  }
}
