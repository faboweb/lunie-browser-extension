import lunieMessageTypes from './messageTypes'

export const parseCosmosTx = (network, lunieTransaction) => {
  return transactionReducerV2(lunieTransaction, network.stakingDenom) // TODO get staking denom (apollo/networks)
}

function transactionReducerV2(lunieTransaction, stakingDenom) {
  return {
    type: lunieTransaction.type,
    hash: lunieTransaction.hash,
    height: lunieTransaction.height,
    details: transactionDetailsReducer(lunieTransaction, stakingDenom),
    timestamp: lunieTransaction.timestamp,
    memo: lunieTransaction.memo,
    fees: lunieTransaction.fees,
    success: lunieTransaction.success
  }
}

// function to map cosmos messages to our details format
function transactionDetailsReducer(lunieTransaction, stakingDenom) {
  let details
  switch (lunieTransaction.type) {
    case lunieMessageTypes.SEND:
      details = sendDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.STAKE:
      details = stakeDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.RESTAKE:
      details = restakeDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.UNSTAKE:
      details = unstakeDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.CLAIM_REWARDS:
      details = claimRewardsDetailsReducer(lunieTransaction, stakingDenom)
      break
    case lunieMessageTypes.SUBMIT_PROPOSAL:
      details = submitProposalDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.VOTE:
      details = voteProposalDetailsReducer(lunieTransaction)
      break
    case lunieMessageTypes.DEPOSIT:
      details = depositDetailsReducer(lunieTransaction)
      break
    default:
      details = {}
  }

  return details
}

function sendDetailsReducer(lunieTransaction) {
  return {
    from: [lunieTransaction.details.from],
    to: [lunieTransaction.details.to],
    amount: lunieTransaction.details.amount
  }
}

function stakeDetailsReducer(lunieTransaction) {
  return {
    to: [lunieTransaction.details.to],
    amount: lunieTransaction.details.amount
  }
}

function restakeDetailsReducer(lunieTransaction) {
  return {
    from: [lunieTransaction.details.from],
    to: [lunieTransaction.details.to],
    amount: lunieTransaction.details.amount
  }
}

function unstakeDetailsReducer(lunieTransaction) {
  return {
    from: [lunieTransaction.details.from],
    amount: lunieTransaction.details.amount
  }
}

function claimRewardsDetailsReducer(lunieTransaction) {
  return {
    from: lunieTransaction.details.from,
    amounts: lunieTransaction.details.amounts
  }
}

function submitProposalDetailsReducer(lunieTransaction) {
  return {
    proposalType: lunieTransaction.proposalType,
    proposalTitle: lunieTransaction.proposalTitle,
    proposalDescription: lunieTransaction.proposalDescription,
    initialDeposit: lunieTransaction.initialDeposit
  }
}

function voteProposalDetailsReducer(lunieTransaction) {
  return {
    proposalId: lunieTransaction.proposalId,
    voteOption: lunieTransaction.voteOption
  }
}

function depositDetailsReducer(lunieTransaction) {
  return {
    proposalId: lunieTransaction.proposalId,
    amount: lunieTransaction.details.amount
  }
}
