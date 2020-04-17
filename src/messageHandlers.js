const {
  getWalletIndex,
  testPassword,
  removeWallet
} = require('@lunie/cosmos-keys')
const { getSigner } = require('src/ActionModal/signer/utils')

export async function signMessageHandler(
  signRequestQueue,
  message,
  sender,
  sendResponse
) {
  switch (message.type) {
    case 'LUNIE_SIGN_REQUEST_CANCEL': {
      signRequestQueue.unqueueSignRequestForTab(sender.tab.id)
      break
    }
    case 'LUNIE_GET_SIGN_QUEUE': {
      sendAsyncResponseToLunie(sender.tab.id, {
        type: 'LUNIE_GET_SIGN_QUEUE_RESPONSE',
        payload: {
          amount: signRequestQueue.getQueueLength()
        }
      })
      break
    }
    case 'LUNIE_SIGN_REQUEST': {
      const {
        signMessage,
        senderAddress,
        network,
        networkType,
        displayedProperties
      } = message.payload
      const wallet = getWalletFromIndex(getWalletIndex(), senderAddress)
      if (!wallet) {
        throw new Error('No wallet found matching the sender address.')
      }
      signRequestQueue.queueSignRequest({
        signMessage,
        senderAddress,
        network,
        networkType,
        displayedProperties,
        tabID: sender.tab.id
      })
      break
    }
    case 'SIGN': {
      const {
        signMessage,
        senderAddress,
        password,
        id,
        network,
        networkType
      } = message.payload
      const signer = await getSigner({}, 'local', {
        address: senderAddress,
        password,
        network,
        networkType
      })

      // for Polkadot this is the signed extrinsic
      // for Cosmos this is signature + publicKey
      const signResponse = await signer(signMessage)

      const { tabID } = signRequestQueue.unqueueSignRequest(id)
      sendAsyncResponseToLunie(tabID, {
        type: 'LUNIE_SIGN_REQUEST_RESPONSE',
        payload: signResponse
      })
      sendResponse() // to popup
      break
    }
    case 'GET_SIGN_REQUEST': {
      sendResponse(signRequestQueue.getSignRequest())
      break
    }
    case 'REJECT_SIGN_REQUEST': {
      const { id, tabID } = message.payload
      sendAsyncResponseToLunie(tabID, {
        type: 'LUNIE_SIGN_REQUEST_RESPONSE',
        payload: { rejected: true }
      })
      signRequestQueue.unqueueSignRequest(id)
      sendResponse() // to popup
      break
    }
  }
}
export function walletMessageHandler(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_WALLETS': {
      sendResponse(getWalletIndex())
      break
    }
    case 'DELETE_WALLET': {
      const { address, password } = message.payload
      removeWallet(address, password)
      sendResponse()
      break
    }
    case 'TEST_PASSWORD': {
      const { address, password } = message.payload
      try {
        testPassword(address, password)
        sendResponse(true)
      } catch (error) {
        sendResponse(false)
      }
      break
    }
  }
}

// for responses that take some time like for a sign request we can't use simple responses
// we instead send a messsage to the sending tab
function sendAsyncResponseToLunie(tabId, { type, payload }) {
  chrome.tabs.sendMessage(tabId, { type, payload })
}

function getWalletFromIndex(walletIndex, address) {
  return walletIndex.find(
    ({ address: storedAddress }) => storedAddress === address
  )
}
