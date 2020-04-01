import actions from 'store/actions'

let mockApollo = {
  async query() {
    return {
      data: {
        network: { id: `localnet`, address_prefix: 'lcl' }
      }
    }
  }
}
const {
  createSeed,
  createKey,
  loadAccounts,
  testLogin,
  getSignRequest,
  approveSignRequest,
  rejectSignRequest,
  getValidatorsData,
  parseSignMessageTx
} = actions({
  apollo: mockApollo
})

describe('actions', () => {
  beforeEach(() => {
    window.chrome = {
      runtime: {
        sendMessage: jest.fn((args, callback) => {
          callback()
        })
      }
    }
  })

  it.skip('Create Seed', async () => {
    window.chrome.runtime.sendMessage.mockImplementation((args, callback) =>
      callback('seed words')
    )
    expect(createSeed()).resolves.toBe('seed words')
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_SEED' },
      expect.any(Function)
    )
  })

  it('Create key from existing seed', async () => {
    const dispatch = jest.fn()
    window.chrome.runtime.sendMessage.mockImplementation((args, callback) =>
      callback()
    )
    await createKey(
      { dispatch },
      {
        seedPhrase: 'seed words',
        password: '1234567890',
        name: 'TEST',
        network: 'localnet'
      }
    )
    expect(dispatch).toHaveBeenCalledWith('loadAccounts')
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'IMPORT_WALLET',
        payload: {
          password: '1234567890',
          name: 'TEST',
          network: 'localnet',
          mnemonic: 'seed words',
          prefix: 'lcl'
        }
      },
      expect.any(Function)
    )
  })

  it('Request wallets from extension', async () => {
    const commit = jest.fn()
    loadAccounts({ commit })
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'GET_WALLETS' },
      expect.any(Function)
    )
  })

  it('Test Login', () => {
    window.chrome.runtime.sendMessage
      .mockImplementationOnce((args, callback) => callback(true))
      .mockImplementationOnce((args, callback) => callback(false))
    expect(
      testLogin(null, { address: 'cosmos1234', password: '1234567890' })
    ).resolves.toBe(true)
    expect(
      testLogin(null, { address: 'cosmos1234', password: '1234567890' })
    ).resolves.toBe(false)
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'TEST_PASSWORD',
        payload: { address: 'cosmos1234', password: '1234567890' }
      },
      expect.any(Function)
    )
  })

  it('Get Sign Request', () => {
    const signRequest = {
      signMessage: '',
      id: 12345,
      senderAddress: 'cosmos1234',
      tabId: 123
    }
    const commit = jest.fn()
    window.chrome.runtime.sendMessage.mockImplementationOnce((args, callback) =>
      callback(signRequest)
    )
    expect(getSignRequest({ commit })).resolves.toEqual(signRequest)
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'GET_SIGN_REQUEST'
      },
      expect.any(Function)
    )
    expect(commit).toHaveBeenCalledWith('setSignRequest', signRequest)
  })

  it('Approve Sign Request', async () => {
    const signRequest = {
      signMessage: '',
      id: 12345,
      senderAddress: 'cosmos1234',
      tabId: 123
    }
    const commit = jest.fn()
    window.chrome.runtime.sendMessage.mockImplementationOnce((args, callback) =>
      callback()
    )
    await approveSignRequest(
      { commit },
      { ...signRequest, password: '1234567890' }
    )
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'SIGN',
        payload: {
          signMessage: '',
          senderAddress: 'cosmos1234',
          password: '1234567890',
          id: 12345
        }
      },
      expect.any(Function)
    )
    expect(commit).toHaveBeenCalledWith('setSignRequest', null)
  })

  it('Approve Sign Request Fail', async () => {
    const signRequest = {
      signMessage: '',
      id: 12345,
      senderAddress: 'cosmos1234',
      tabId: 123
    }
    const commit = jest.fn()
    window.chrome.runtime.sendMessage.mockImplementationOnce((args, callback) =>
      callback({ error: 'fail' })
    )
    await expect(
      approveSignRequest({ commit }, { ...signRequest, password: '1234567890' })
    ).rejects.toBe('fail')
  })

  it('Reject Sign Request', async () => {
    const signRequest = {
      signMessage: '',
      id: 12345,
      senderAddress: 'cosmos1234',
      tabId: 123
    }
    const commit = jest.fn()
    window.chrome.runtime.sendMessage.mockImplementationOnce((args, callback) =>
      callback()
    )
    await rejectSignRequest({ commit }, { ...signRequest })
    expect(window.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        type: 'REJECT_SIGN_REQUEST',
        payload: signRequest
      },
      expect.any(Function)
    )
    expect(commit).toHaveBeenCalledWith('setSignRequest', null)
  })

  it('Get Validators Name when Un/Delegating', async () => {
    const mockSuccessResponse = { data: { validator: { name: 'name1' } } }
    const mockJsonPromise = Promise.resolve(mockSuccessResponse)
    const mockFetchPromise = Promise.resolve({
      json: () => mockJsonPromise
    })
    window.fetch = jest.fn(() => mockFetchPromise)

    const v1 = {
      msgs: [
        {
          type: 'cosmos-sdk/MsgDelegate',
          value: {
            validator_address: 'address1'
          }
        }
      ],
      fee: {
        amount: {
          amount: 1,
          denom: 'stake'
        }
      }
    }

    await expect(
      getValidatorsData(parseSignMessageTx(JSON.stringify(v1)))
    ).resolves.toEqual([
      {
        name: 'name1',
        operatorAddress: 'address1',
        picture: undefined
      }
    ])
  })

  it('Get Validators Name when Redelegating', async () => {
    const mockFetchPromise = Promise.resolve({
      json: () => Promise.resolve({ data: { validator: { name: 'dst' } } })
    })

    const mockFetchPromise2 = Promise.resolve({
      json: () => Promise.resolve({ data: { validator: { name: 'src' } } })
    })

    window.fetch = jest
      .fn()
      .mockImplementationOnce(() => mockFetchPromise)
      .mockImplementationOnce(() => mockFetchPromise2)

    const validatorAddress = {
      msgs: [
        {
          type: 'cosmos-sdk/MsgBeginRedelegate',
          value: {
            validator_src_address: 'srcaddress1',
            validator_dst_address: 'dstaddress1'
          }
        }
      ],
      fee: {
        amount: {
          amount: 1,
          denom: 'stake'
        }
      }
    }

    await expect(
      getValidatorsData(parseSignMessageTx(JSON.stringify(validatorAddress)))
    ).resolves.toEqual([
      {
        operatorAddress: 'dstaddress1',
        name: 'dst',
        picture: undefined
      },
      {
        operatorAddress: 'srcaddress1',
        name: 'src',
        picture: undefined
      }
    ])
  })

  it('Get Validators Name with incorrect message type', async () => {
    const validatorAddress = {
      value: {
        msg: [
          {
            type: 'WRONG',
            value: {
              validator_src_address: 'srcaddress1',
              validator_dst_address: 'dstaddress1'
            }
          }
        ]
      }
    }

    await expect(getValidatorsData(validatorAddress)).resolves.toEqual([])
  })
})
