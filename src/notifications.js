import gql from 'graphql-tag'
import { createApolloProvider } from './apollo'
import config from '../config'
const { getWalletIndex } = require('@lunie/cosmos-keys')

// request permissions to show push notifications
Notification.requestPermission()

const apolloClient = createApolloProvider(config.graphqlHost)

const subscribeToEventsForAddress = (networkId, address) => {
  apolloClient
    .subscribe({
      variables: {
        networkId,
        address
      },
      query: gql`
        subscription($networkId: String!, $address: String!) {
          userTransactionAdded(networkId: $networkId, address: $address) {
            hash
            height
            success
            log
            value
          }
        }
      `
    })
    .subscribe({
      next(data) {
        // ... call updateQuery to integrate the new comment
        // into the existing list of comments
        new Notification(`New TX ${data.data.userTransactionAdded.hash}`)
      },
      error(err) {
        console.error('err', err)
      }
    })
}

const subscribeToEventsForExistingAddress = () => {
  const wallets = getWalletIndex()
  wallets.forEach(({ address }) => {
    subscribeToEventsForAddress('cosmos-hub-mainnet', address)
  })
}

module.exports = {
  subscribeToEventsForExistingAddress,
  subscribeToEventsForAddress
}
