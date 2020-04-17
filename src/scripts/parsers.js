'use strict'

import { parseCosmosTx } from './cosmosTxParser'
import { parsePolkadotTx } from './polkadotTxParser'

export const parseTx = (signRequest, network, lunieTransaction) => {
  console.log('signRequest', signRequest) // for now because of linter
  if (network.network_type === 'cosmos') {
    return parseCosmosTx(network, lunieTransaction)
  }
  if (network.network_type === 'polkadot') {
    return parsePolkadotTx(network, lunieTransaction)
  }
}
