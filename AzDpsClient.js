const REGISTRATION_TOPIC = '$dps/registrations/res/#'
const REGISTER_TOPIC = '$dps/registrations/PUT/iotdps-register/?$rid='

/**
 *
 * @param {String} key
 * @param {String} msg
 * @returns {Promise<string>}
 */
export const createHmac = async (key, msg) => {
  const keyBytes = Uint8Array.from(window.atob(key), c => c.charCodeAt(0))
  const msgBytes = Uint8Array.from(msg, c => c.charCodeAt(0))
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' },
    true, ['sign']
  )
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgBytes)
  return window.btoa(String.fromCharCode(...new Uint8Array(signature)))
}

export class AzDpsClient {
  constructor (scopeId, deviceId, deviceKey, modelId) {
    this.host = 'global.azure-devices-provisioning.net'
    this.scopeId = scopeId
    this.deviceId = deviceId
    this.deviceKey = deviceKey
    this.modelId = modelId
  }
   
  async registerDevice () {
    const endpoint = 'https://dps-proxy.azurewebsites.net/register'
    const url = `${endpoint}?scopeId=${this.scopeId}&deviceId=${this.deviceId}&deviceKey=${encodeURIComponent(this.deviceKey)}&modelId=${this.modelId}`
    console.log(url)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'utf-8'
      }
    })
    const resp = await response.json()
    console.log(resp)
    return resp
  }
}
