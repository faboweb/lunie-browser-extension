import { ApiPromise, WsProvider } from '@polkadot/api'
import BigNumber from 'bignumber.js'
import lunieMessageTypes from './cosmosTxParser'

async function getPolkadotApi(network) {
  const api = new ApiPromise({
    provider: new WsProvider(network.rpc_url) // need to use public polkadot API as ours is IP locked
  })
  await api.isReady
  return api
}

export const parsePolkadotTx = async (signMessage, network) => {
  const api = await getPolkadotApi(network)
  const extrinsic = api.createType('Extrinsic', signMessage)
  const lunieTx = transactionReducerV2(network, extrinsic, undefined, {
    coinReducer
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

function transactionReducerV2(network, extrinsic, blockHeight, reducers) {
  const hash = extrinsic.hash.toHex()
  const signer = extrinsic.signer.toString()
  const messages = aggregateLunieStaking(
    extrinsic.method.meta.name.toString() === `batch`
      ? extrinsic.method.args[0]
      : [extrinsic.method]
  )
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

// we display staking as one tx where in Polkadot this can be 2
// so we aggregate the messags into 1
// ATTENTION this could be weird for some users
function aggregateLunieStaking(messages) {
  // lunie staking message
  let aggregatedLunieStaking = {
    method: 'staking',
    section: 'lunie',
    validators: [],
    amount: 0
  }
  let hasBond = false
  let hasNominate = false
  let reducedMessages = []
  messages.forEach(current => {
    if (
      current.toHuman().section === 'staking' &&
      current.toHuman().method === 'bond'
    ) {
      aggregatedLunieStaking.amount =
        aggregatedLunieStaking.amount + current.args.value
      hasBond = true
    }

    if (
      current.toHuman().section === 'staking' &&
      current.toHuman().method === 'bondExtra'
    ) {
      aggregatedLunieStaking.amount =
        aggregatedLunieStaking.amount + current.args.max_additional
      hasBond = true
    }

    if (
      current.toHuman().section === 'staking' &&
      current.toHuman().method === 'nominate'
    ) {
      aggregatedLunieStaking.validators = aggregatedLunieStaking.validators.concat(
        current.args[0].toHuman()
      )
      hasNominate = true
    }
    reducedMessages.push({
      section: current.toHuman().section,
      method: current.toHuman().method,
      args: JSON.parse(JSON.stringify(current.args, null, 2))
    })
  })
  return hasBond && hasNominate
    ? reducedMessages.concat(aggregatedLunieStaking)
    : reducedMessages
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
