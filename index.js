import { AzDpsClient, createHmac } from './AzDpsClient.js'
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
      viewDpsForm: false,
      disableDeviceKey: false,
      runningProvision: false,
      /** @type {ConnectionInfo} */
      connectionInfo: {
        scopeId: '',
        hubName: '',
        deviceId: 'device' + Date.now(),
        deviceKey: '',
        modelId: 'dtmi:com:example:Thermostat;1',
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
    async created () {
      /** @type { ConnectionInfo } connInfo */
      const connInfo = JSON.parse(window.localStorage.getItem('connectionInfo') || '{}')

      connInfo.deviceId = connInfo.deviceId || 'device' + Date.now()

      if (connInfo.scopeId) {
        this.connectionInfo.scopeId = connInfo.scopeId
        if (connInfo.masterKey) {
          this.connectionInfo.masterKey = connInfo.masterKey
          this.connectionInfo.deviceKey = await createHmac(this.connectionInfo.masterKey, this.connectionInfo.deviceId)
        }
      }

      if (connInfo.hubName) {
        this.connectionInfo.hubName = connInfo.hubName
        this.connectionInfo.deviceId = connInfo.deviceId
        this.connectionInfo.deviceKey = connInfo.deviceKey
        this.connectionInfo.modelId = connInfo.modelId
      }
    },
    methods: {
      async provision () {
        window.localStorage.setItem('connectionInfo',
            JSON.stringify(
              {
                scopeId: this.connectionInfo.scopeId,
                hubName: this.connectionInfo.hubName,
                deviceId: this.connectionInfo.deviceId,
                deviceKey: this.connectionInfo.deviceKey,
                masterKey: this.connectionInfo.masterKey,
                modelId: this.connectionInfo.modelId
              }))
        const dpsClient = new AzDpsClient(this.connectionInfo.scopeId, this.connectionInfo.deviceId, this.connectionInfo.deviceKey, this.connectionInfo.modelId)
        this.runningProvision = true
        const result = await dpsClient.registerDevice()
        this.runningProvision = false
        if (result.status === 'assigned') {
          this.connectionInfo.hubName = result.registrationState.assignedHub
        } else {
          console.log(result)
          this.connectionInfo.hubName = result.status
        }
        this.viewDpsForm = false
      },
      async refreshDeviceId() {
        this.connectionInfo.deviceId = 'device' + Date.now()
        await this.updateDeviceKey()
      },
      async connect () {
        if (this.saveConfig) {
          window.localStorage.setItem('connectionInfo',
            JSON.stringify(
              {
                scopeId: this.connectionInfo.scopeId,
                hubName: this.connectionInfo.hubName,
                deviceId: this.connectionInfo.deviceId,
                deviceKey: this.connectionInfo.deviceKey,
                masterKey: this.connectionInfo.masterKey,
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
      showDpsForm () {
        this.disableDeviceKey = false
        this.viewDpsForm = !this.viewDpsForm
      },
      clearUpdates () {
        this.desiredCalls = []
      },
      async updateDeviceKey () {
        this.disableDeviceKey = true
        this.connectionInfo.deviceKey = await createHmac(this.connectionInfo.masterKey, this.connectionInfo.deviceId)
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
