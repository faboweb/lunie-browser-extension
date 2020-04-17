'use strict'

import { parseCosmosTx } from './cosmosTxParser'
import { parsePolkadotTx } from './polkadotTxParser'

export const parseTx = (signMessage, network, displayedProperties) => {
  if (network.network_type === 'cosmos') {
    return parseCosmosTx(signMessage, displayedProperties)
  }
  if (network.network_type === 'polkadot') {
    return parsePolkadotTx(signMessage, network, displayedProperties)
  }
}
