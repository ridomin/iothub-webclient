type ConnectionInfo = {
    deviceId: string,
    hubName: string,
    deviceKey: string,
    modelId?: string,
    status: string,
    connected: bool
}

type DeviceTwin = {
    reported: any,
    desired: any
}