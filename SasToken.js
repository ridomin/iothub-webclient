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

/**
 * @param {string} resourceUri
 * @param {string} signingKey
 * @param {string | null} policyName
 * @param {number} expiresInMins
 * @returns {Promise<string>}
 */
export async function generateSasToken (resourceUri, signingKey, policyName, expiresInMins) {
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
