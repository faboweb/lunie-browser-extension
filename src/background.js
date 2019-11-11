import 'core-js/stable'
import 'regenerator-runtime/runtime'
import gql from 'graphql-tag'
import { signMessageHandler, walletMessageHandler } from './messageHandlers'
import SignRequestQueue from './requests'
import { bindRequestsToTabs } from './tabsHandler'
import { createApolloProvider } from './apollo'
import config from '../config'
Notification.requestPermission()
console.log(Notification.permission)
new Notification('Hi there!')
const apolloClient = createApolloProvider(config.graphqlHost)
const s = apolloClient
  .subscribe({
    variables: {
      networkId: 'local-cosmos-hub-testnet',
      address: 'abc'
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
      console.log('new TX', data)
      new Notification(`New TX ${data.data.userTransactionAdded.hash}`)
    },
    error(err) {
      console.error('err', err)
    }
  })
// .then(data => console.log(data))
// .catch(error => console.error(error));

console.log(s)

global.browser = require('webextension-polyfill')

const extensionHost = location.origin
const whitelisted = ['https://app.lunie.io', extensionHost]
if (process.env.NODE_ENV === 'development') {
  whitelisted.push('https://localhost')
}

const signRequestQueue = new SignRequestQueue()
signRequestQueue.unqueueSignRequest('')

// main message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!senderAllowed(sender)) {
    console.error('Sender is not whitelisted')
    return
  }

  try {
    signMessageHandler(signRequestQueue, message, sender, sendResponse)
    walletMessageHandler(message, sender, sendResponse)
  } catch (error) {
    // Return this as rejected
    console.error('Error with request', error)
    sendResponse({ error: error.message })
  }

  return true
})
bindRequestsToTabs(signRequestQueue, whitelisted)

// only allow whitelisted websites to send us messages
function senderAllowed(sender) {
  // if sender.tab is not defined, the message comes from the extension
  if (sender.tab && !whitelisted.find(url => sender.tab.url.startsWith(url))) {
    return false
  }
  return true
}
