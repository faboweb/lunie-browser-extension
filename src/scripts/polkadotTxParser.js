// import { ApiPromise, WsProvider } from '@polkadot/api'
import BigNumber from 'bignumber.js'
import lunieMessageTypes from './messageTypes'

// async function getPolkadotApi(network) {
//   const api = new ApiPromise({
//     provider: new WsProvider(network.rpc_url) // need to use public polkadot API as ours is IP locked
//   })
//   await api.isReady
//   return api
// }

export const parsePolkadotTx = async (network, lunieTransaction) => {
  // const api = await getPolkadotApi(network)
  // const extrinsic = api.createType('Extrinsic', signMessage) // TODO
  console.log(lunieTransaction)
  const lunieTx = transactionReducerV2(network, lunieTransaction, undefined, {
    coinReducer,
    extractInvolvedAddresses
  })
  return lunieTx
}

// Map Polkadot event method to Lunie message types
function getMessageType(section, method) {
  switch (`${section}.${method}`) {
    case 'balances.transfer':
      return lunieMessageTypes.SEND
    case 'lunie.staking':
      return lunieMessageTypes.STAKE
    default:
      return lunieMessageTypes.UNKNOWN
  }
}

function parsePolkadotTransaction(
  hash,
  message,
  messageIndex,
  signer,
  network,
  blockHeight,
  reducers
) {
  const lunieTransactionType = getMessageType(message.section, message.method)
  return {
    type: lunieTransactionType,
    hash,
    height: blockHeight,
    key: `${hash}_${messageIndex}`,
    details: transactionDetailsReducer(
      network,
      lunieTransactionType,
      reducers,
      signer,
      message
    ),
    timestamp: new Date().getTime(), // FIXME!: pass it from block, we should get current timestamp from blockchain for new blocks
    memo: ``,
    fees: {
      amount: `0`,
      denom: network.coinLookup[0].viewDenom
    }, // FIXME!
    success: true,
    log: ``,
    involvedAddresses: reducers.extractInvolvedAddresses(
      lunieTransactionType,
      signer,
      message
    )
  }
}

function transactionReducerV2(
  network,
  lunieTransaction,
  blockHeight,
  reducers
) {
  const hash = lunieTransaction.hash
  const signer = lunieTransaction.from
  const messages = lunieTransaction.details
  return messages.map((message, messageIndex) =>
    parsePolkadotTransaction(
      hash,
      message,
      messageIndex,
      signer,
      network,
      blockHeight,
      reducers
    )
  )
}

// Map polkadot messages to our details format
function transactionDetailsReducer(
  network,
  lunieTransactionType,
  reducers,
  signer,
  message
) {
  let details
  switch (lunieTransactionType) {
    case lunieMessageTypes.SEND:
      details = sendDetailsReducer(network, message, signer, reducers)
      break
    case lunieMessageTypes.STAKE:
      details = stakeDetailsReducer(network, message, reducers)
      break
    default:
      details = {}
  }
  return {
    type: lunieTransactionType,
    ...details
  }
}

function coinReducer(network, amount) {
  if (!amount) {
    return {
      amount: 0,
      denom: ''
    }
  }

  return {
    denom: network.coinLookup[0].viewDenom,
    amount: BigNumber(amount)
      .times(network.coinLookup[0].chainToViewConversionFactor)
      .toFixed(9)
  }
}

function extractInvolvedAddresses(transaction) {
  // If the transaction has failed, it doesn't get tagged
  if (!Array.isArray(transaction.tags)) return []

  const involvedAddresses = transaction.tags.reduce((addresses, tag) => {
    // temporary in here to identify why this fails
    if (!tag.value) {
      return addresses
    }
    if (tag.value.startsWith(`cosmos`)) {
      addresses.push(tag.value)
    }
    return addresses
  }, [])
  return involvedAddresses
}

function sendDetailsReducer(network, message, signer, reducers) {
  return {
    from: [signer],
    to: [message.args[0]],
    amount: reducers.coinReducer(network, message.args[1])
  }
}

// the message for staking is created by `aggregateLunieStaking`
function stakeDetailsReducer(network, message, reducers) {
  return {
    to: message.validators,
    amount: reducers.coinReducer(network, message.amount)
  }
}
