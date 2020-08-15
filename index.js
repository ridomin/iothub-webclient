import { AzIoTHubClient } from './AzIoTHubClient.js'
import * as vf from './versionFromFile.js'

const createApp = () => {
  let telemetryInterval
  /** @type {AzIoTHubClient} client */
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
      /** @type {Array<CommandInfo>} */
      commands: [],
      reportedJson: '{}',
      desiredJson: '{}',
      desiredCalls: [],
      reportedPropJson: '{ deviceStatus: "200 OK" }',
      telemetryJson: '{ temperature: %d }',
      sentMessages: 0,
      isTelemetryRunning: false,
      versionInfo: ''
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
      vf.versionFromFile(v => {
        this.versionInfo = v
      })
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
        client = new AzIoTHubClient(host,
          this.connectionInfo.deviceId,
          this.connectionInfo.deviceKey,
          this.connectionInfo.modelId)
        client.setDirectMehodCallback((method, payload, rid) => {
          const response = JSON.stringify({ responsePayload: 'sample response' })
          /** @type {CommandInfo} */
          const command = { method, payload, rid, response, dirty: false }
          this.commands.push(command)
        })
        client.setDesiredPropertyCallback((desired) => {
          this.desiredCalls.push(desired)
          this.readTwin()
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
      /**
       *
       * @param {CommandInfo} cmd
       * @param {number} status
       */
      cmdResponse (cmd, status) {
        // console.log('sending response ' + method + response + rid)
        client.commandResponse(cmd.method, cmd.response, cmd.rid, status)
        cmd.dirty = true
      },
      clearCommands () {
        this.commands = []
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
      },
      async ackDesired (dc, status) {
        const dco = JSON.parse(dc)
        const firstEl = Object.keys(dco)[0]
        const payload = {}
        payload[firstEl] = {
          value: dco[firstEl],
          ac: status,
          av: dco.$version
        }
        const updateResult = await client.updateTwin(JSON.stringify(payload))
        if (updateResult === 204) {
          await this.readTwin()
        }
      },
      clearUpdates () {
        this.desiredCalls = []
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
