type ConnectionInfo = {
    scopeId: string,
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

type CommandInfo = {
    method: string,
    payload: string,
    response: string,
    rid: number,
    dirty: boolean
}