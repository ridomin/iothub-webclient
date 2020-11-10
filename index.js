import { AzIoTHubClient, ackPayload } from './AzIoTHubClient.js'

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
      isTelemetryRunning: false
    },
    created () {
      const qs = decodeURIComponent(window.location.search)
      const csqs = new URLSearchParams(qs)
      const hubName = csqs.get('HostName')
      const deviceId = csqs.get('DeviceId')
      const deviceKey = csqs.get('SharedAccessKey')
      const modelId = csqs.get('ModelId')

      /** @type { ConnectionInfo } connInfo */
      const connInfo = JSON.parse(window.localStorage.getItem('connectionInfo') || '{}')

      if (hubName) {
        this.connectionInfo.hubName = hubName
        this.connectionInfo.deviceId = deviceId
        this.connectionInfo.deviceKey = deviceKey
        this.connectionInfo.modelId = modelId
        console.log('connfrom csqs', this.connectionInfo)
      } else if (connInfo.hubName) {
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
        let host = this.connectionInfo.hubName
        if (host.indexOf('.azure-devices.net') === -1) {
          host += '.azure-devices.net'
        }
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
        client.setDesiredPropertyCallback(desired => {
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
        const payload = ackPayload(dco, status, dco.$version)
        const updateResult = await client.updateTwin(JSON.stringify(payload))
        if (updateResult === 204) {
          await this.readTwin()
          this.desiredCalls = []
        } else console.log('error updating ack' + updateResult)
      },
      clearUpdates () {
        this.desiredCalls = []
      }
    },
    computed: {
      connectionString () {
        return `HostName=${this.connectionInfo.hubName}.azure-devices.net;DeviceId=${this.connectionInfo.deviceId};SharedAccessKey=${this.connectionInfo.deviceKey}`
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
