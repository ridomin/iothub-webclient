import { HubClient } from './hubClient.js'

const createApp = () => {
  let telemetryInterval
  /** @type {HubClient} client */
  let client
  // @ts-ignore
  const app = new Vue({
    el: '#app',
    data: {
      saveConfig: true,
      /** @type {ConnectionInfo} */
      connectionInfo: {
        hubName: '',
        deviceId: '',
        deviceKey: '',
        modelId: 'dtmi:com:example:sampledevice;1',
        status: 'Disconnected',
        connected: false
      },
      commands: [
        {
          method: 'MyCommand',
          payload: JSON.stringify({
            myCommandPayload: {
              param1: 'value1',
              param2: 'value2'
            }
          }, null, 2)
        }
      ],
      reportedJson: '{}',
      desiredJson: '{}',
      reportedPropJson: '{ newProperty: "new value" }',
      telemetryJson: '{ temperature: %d }',
      sentMessages: 0,
      isTelemetryRunning: false
    },
    created () {
      /** @type { ConnectionInfo } connInfo */
      const connInfo = JSON.parse(window.localStorage.getItem('connectionInfo') || '{}')
      if (connInfo.hubName) {
        this.connectionInfo.hubName = connInfo.hubName
        this.connectionInfo.deviceId = connInfo.deviceId
        this.connectionInfo.deviceKey = connInfo.deviceKey
        this.connectionInfo.modelId = connInfo.modelId
      }
    },
    methods: {
      async connect () {
        if (this.saveConfig) {
          window.localStorage.setItem('connectionInfo',
            JSON.stringify(
              {
                hubName: this.connectionInfo.hubName,
                deviceId: this.connectionInfo.deviceId,
                deviceKey: this.connectionInfo.deviceKey,
                modelId: this.connectionInfo.modelId
              }))
        }
        const host = `${this.connectionInfo.hubName}.azure-devices.net`
        client = new HubClient(host,
          this.connectionInfo.deviceId,
          this.connectionInfo.deviceKey,
          this.connectionInfo.modelId)
        client.setDirectMehodCallback((method, payload) => {
          this.commands.push({ method, payload })
        })
        client.setDesiredPropertyCallback((desired) => {
          this.desiredJson = desired
        })
        client.disconnectCallback = (err) => {
          console.log(err)
          this.connectionInfo.connected = false
          this.connectionInfo.status = 'Disconnected'
        }
        await client.connect()
        this.connectionInfo.status = 'Connected'
        this.connectionInfo.connected = true
        await this.readTwin()
      },
      async readTwin () {
        if (client.connected) {
          const twin = await client.getTwin()
          this.reportedJson = JSON.stringify(twin.reported)
          this.desiredJson = JSON.stringify(twin.desired)
        } else {
          console.log('not connected')
        }
      },
      async reportProp () {
        const payload = this.reportedPropJson
        const updateResult = await client.updateTwin(payload)
        if (updateResult === 204) {
          await this.readTwin()
        }
      },
      cmdResponse (method) {
        client.commandResponse()    
      },
      startTelemetry () {
        telemetryInterval = setInterval(() => {
          this.sentMessages++
          const telemetryMessage = this.telemetryJson.replace('%d', this.sentMessages)
          client.sendTelemetry(telemetryMessage)
        }, 1000)
        this.isTelemetryRunning = true
      },
      stopTelemetry () {
        clearInterval(telemetryInterval)
        this.isTelemetryRunning = false
        this.sentMessages = 0
      }
    },
    computed: {
      connectionString () {
        return `HostName=${this.connectionInfo.hubName}.azure-devices.net;DeviceId=${this.connectionInfo.deviceId};ShareddAccessKey=${this.connectionInfo.deviceKey}`
      }
    },
    filters: {
      pretty: function (value) {
        return JSON.stringify(JSON.parse(value), null, 2)
      }
    }
  })
  return app
}

(() => {
  createApp()
})()
