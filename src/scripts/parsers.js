'use strict'

import { parseCosmosTx } from './cosmosTxParser'

export const parseTx = (signRequest, network, lunieTransaction) => {
  console.log('signRequest', signRequest) // for now because of linter
  return parseCosmosTx(network, lunieTransaction)

  // if (network.network_type === 'polkadot') {
  //   return parsePolkadotTx(network, lunieTransaction)
  // }
}
