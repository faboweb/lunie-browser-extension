import config from '../../config.js'
import { getNewWalletFromSeed } from '@lunie/cosmos-keys'
import gql from 'graphql-tag'
import { NetworksAll } from '../popup/gql'
import { lunieMessageTypes } from '../scripts/parsers'
import { parseTx } from '../scripts/parsers.js'

export default ({ apollo }) => {
  const createSeed = async ({ dispatch }, { network }) => {
    console.log(dispatch) // hack for linter
    let messageType = ''
    const net = await getNetwork(network, apollo)
    messageType = net.id.startsWith(`polkadot`)
      ? 'GET_POLKADOT_SEED'
      : 'GET_COSMOS_SEED'
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: messageType }, function(seed) {
        resolve(seed)
      })
    })
  }

  const getNetwork = async (networkId, apollo) => {
    const {
      data: { network }
    } = await apollo.query({
      query: gql`
        query Network {
          network(id: "${networkId}") {
            id
            address_creator,
            address_prefix
          }
        }
      `,
      fetchPolicy: `cache-first`
    })

    if (!network)
      throw new Error(
        `Lunie doesn't support address creation for this network.`
      )

    return network
  }

  const preloadNetworkCapabilities = async ({ commit }) => {
    const { data } = await apollo.query({
      query: NetworksAll,
      variables: { experimental: config.development },
      fetchPolicy: 'cache-first'
    })
    commit('setNetworks', data.networks)
  }

  const setNetwork = ({ commit }, network) => {
    commit('setNetworkId', network.id)
  }

  const createKey = ({ dispatch }, { seedPhrase, password, name, network }) => {
    return new Promise(async resolve => {
      const net = await getNetwork(network, apollo)
      chrome.runtime.sendMessage(
        {
          type: 'IMPORT_WALLET',
          payload: {
            password,
            name,
            prefix: net.address_prefix,
            mnemonic: seedPhrase,
            network
          }
        },
        function() {
          resolve()
          dispatch('loadAccounts')
        }
      )
    })
  }

  const loadAccounts = ({ commit }) => {
    chrome.runtime.sendMessage(
      {
        type: 'GET_WALLETS'
      },
      function(response) {
        commit('setAccounts', response || [])
      }
    )
  }

  const testLogin = (store, { address, password }) => {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'TEST_PASSWORD',
          payload: { address, password }
        },
        function(response) {
          resolve(response)
        }
      )
    })
  }

  const getSignRequest = ({ commit }) => {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_SIGN_REQUEST'
        },
        function(response) {
          commit('setSignRequest', response)
          resolve(response)
        }
      )
    })
  }

  const getValidatorsData = async (lunieTx, network) => {
    let validators = []
    if (
      lunieTx.type === lunieMessageTypes.STAKE ||
      lunieTx.type === lunieMessageTypes.RESTAKE
    ) {
      validators.push(...lunieTx.details.to)
    }
    if (
      lunieTx.type === lunieMessageTypes.UNSTAKE ||
      lunieTx.type === lunieMessageTypes.RESTAKE ||
      lunieTx.type === lunieMessageTypes.CLAIM_REWARDS
    ) {
      validators.push(...lunieTx.details.from)
    }
    return await Promise.all(
      validators.map(async validatorAddress => {
        const { name: validatorToMoniker, picture } = await fetchValidatorData(
          validatorAddress,
          network
        )
        return {
          operatorAddress: validatorAddress,
          name: validatorToMoniker,
          picture
        }
      })
    )
  }

  const fetchValidatorData = async (validatorAddress, network) => {
    return fetch(`${config.graphqlHost}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: `{"query": "query{validator(operatorAddress: \\"${validatorAddress}\\", networkId: \\"${network}\\"){ name picture }}"}`
    })
      .then(async function(response) {
        const validatorObject = await response.json()
        return {
          name: validatorObject.data.validator.name,
          picture: validatorObject.data.validator.picture
        }
      })
      .catch(function(error) {
        console.log('Error: ', error)
      })
  }

  const approveSignRequest = (
    { commit },
    { signMessage, senderAddress, password, id }
  ) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'SIGN',
          payload: {
            signMessage,
            senderAddress,
            password,
            id
          }
        },
        function(response) {
          if (response && response.error) {
            return reject(response.error)
          }
          resolve()
          commit('setSignRequest', null)
        }
      )
    })
  }

  const getNetworkByAddress = async (store, address) => {
    const { data } = await apollo.query({
      query: gql`
        query Networks {
          networks {
            testnet
            id
            address_prefix
          }
        }
      `,
      fetchPolicy: 'cache-first'
    })
    const network = data.networks
      .filter(network => address.indexOf(network.address_prefix) == 0)
      .sort(a => a.testnet)
      .shift()
    return network ? network.id : ''
  }

  const rejectSignRequest = ({ commit }, signRequest) => {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'REJECT_SIGN_REQUEST',
          payload: signRequest
        },
        function(_response) {
          resolve()
          commit('setSignRequest', null)
        }
      )
    })
  }

  const signIn = () => {}

  const resetSignUpData = ({ commit }) => {
    commit(`resetSignUpData`)
  }

  const resetRecoverData = ({ commit }) => {
    commit(`resetRecoverData`)
  }

  const getAddressFromSeed = async (store, { seedPhrase, network }) => {
    const net = await getNetwork(network, apollo)
    const wallet = getNewWalletFromSeed(seedPhrase, net.address_prefix)
    return wallet.cosmosAddress
  }

  const parseSignMessageTx = (signRequest, displayedProperties) => {
    return signRequest ? parseTx(signRequest, displayedProperties) : null
  }

  // creates a polkadot address
  async function createPolkadotAddress(seedPhrase, addressPrefix) {
    const [{ Keyring }] = await Promise.all([
      import('@polkadot/api'),
      import('@polkadot/util-crypto').then(async ({ cryptoWaitReady }) => {
        // Wait for the promise to resolve, async WASM or `cryptoWaitReady().then(() => { ... })`
        await cryptoWaitReady()
      })
    ])

    const keyring = new Keyring({
      ss58Format: Number(addressPrefix),
      type: 'ed25519'
    })
    const newPair = keyring.addFromUri(seedPhrase)

    return {
      cosmosAddress: newPair.address,
      publicKey: newPair.publicKey,
      seedPhrase
    }
  }

  return {
    createSeed,
    createKey,
    createPolkadotAddress,
    loadAccounts,
    getNetworkByAddress,
    testLogin,
    getSignRequest,
    getValidatorsData,
    approveSignRequest,
    rejectSignRequest,
    signIn,
    resetSignUpData,
    resetRecoverData,
    getAddressFromSeed,
    setNetwork,
    preloadNetworkCapabilities,
    parseSignMessageTx
  }
}
