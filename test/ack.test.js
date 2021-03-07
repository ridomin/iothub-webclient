import { ackPayload } from '../AzIoTHubClient.js'

test('singleProp at root', () => {
  const payload = {
    aSingleProp: 1
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      aSingleProp: {
        ac: 200,
        av: 1,
        value: 1
      }
    })
})

test('complexObj at root', () => {
  const payload = {
    aComplexObj: {
      prop1: 1,
      prop2: 2
    }
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      aComplexObj: {
        ac: 200,
        av: 1,
        value: {
          prop1: 1,
          prop2: 2
        }
      }
    })
})

test('complexObj2 at root', () => {
  const payload = {
    aComplexObj: {
      prop1: 1,
      prop2: {
        prop21: 21,
        prop22: '22'
      }
    }
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      aComplexObj: {
        ac: 200,
        av: 1,
        value: {
          prop1: 1,
          prop2: {
            prop21: 21,
            prop22: '22'
          }
        }
      }
    })
})

test('singleProp in comp', () => {
  const payload = {
    MyComponent: {
      __t: 'c',
      aSingleProp: 'aValue'
    }
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      MyComponent: {
        __t: 'c',
        aSingleProp: {
          ac: 200,
          av: 1,
          value: 'aValue'
        }
      }
    })
})

test('complexObj in comp', () => {
  const payload = {
    MyComponent: {
      __t: 'c',
      aComplexObj: {
        prop1: 1,
        prop2: 2
      }
    }
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      MyComponent: {
        __t: 'c',
        aComplexObj: {
          ac: 200,
          av: 1,
          value: {
            prop1: 1,
            prop2: 2
          }
        }
      }
    })
})

test('complexObj2 in comp', () => {
  const payload = {
    MyComponent: {
      __t: 'c',
      aComplexObj: {
        prop1: 1,
        prop2: {
          prop21: 21,
          prop22: '22'
        }
      }
    }
  }
  const ack = ackPayload(payload, 200, 1)
  expect(ack).toStrictEqual(
    {
      MyComponent: {
        __t: 'c',
        aComplexObj: {
          ac: 200,
          av: 1,
          value: {
            prop1: 1,
            prop2: {
              prop21: 21,
              prop22: '22'
            }
          }
        }
      }
    })
})
