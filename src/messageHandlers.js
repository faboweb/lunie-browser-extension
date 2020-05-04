const {
  getWalletIndex,
  getStoredWallet,
  signWithPrivateKey,
  testPassword,
  removeWallet
} = require('@lunie/cosmos-keys')
const TransactionManager = require('src/signing/transaction-manager')

export async function signMessageHandler(
  signRequestStore,
  event,
  sender,
  sendResponse
) {
  try {
    switch (event.type) {
      // DEPRECATE
      case 'LUNIE_SIGN_REQUEST_CANCEL': {
        signRequestStore.removeSignRequestForTab(sender.tab.id)
        break
      }
      // DEPRECATE
      case 'LUNIE_GET_SIGN_QUEUE': {
        sendAsyncResponseToLunie(sender.tab.id, {
          type: 'LUNIE_GET_SIGN_QUEUE_RESPONSE',
          payload: {
            amount: signRequestStore.getSignRequest() ? 1 : 0
          }
        })
        break
      }
      case 'LUNIE_SIGN_REQUEST': {
        const {
          // old messaging
          signMessage, //DEPRECATE
          displayedProperties, //DEPRECATE

          messageType,
          message,
          transactionData,
          senderAddress,
          network
        } = event.payload
        const wallet = getWalletFromIndex(getWalletIndex(), senderAddress)
        if (!wallet) {
          throw new Error('No wallet found matching the sender address.')
        }

        signRequestStore.storeSignRequest({
          signMessage, // DEPRECATE
          displayedProperties, //DEPRECATE

          messageType,
          message,
          transactionData,
          senderAddress,
          network,
          tabID: sender.tab.id
        })
        break
      }
      case 'SIGN': {
        const {
          signMessage, // DEPRECATE

          messageType,
          message,
          transactionData,
          senderAddress,
          network,
          password,
          id
        } = event.payload

        const { tabID } = signRequestStore.removeSignRequest(id)
        if (signMessage) {
          const wallet = getStoredWallet(senderAddress, password)
          const signature = signWithPrivateKey(
            signMessage,
            Buffer.from(wallet.privateKey, 'hex')
          )

          sendAsyncResponseToLunie(tabID, {
            type: 'LUNIE_SIGN_REQUEST_RESPONSE',
            payload: {
              signature: signature.toString('hex'),
              publicKey: wallet.publicKey
            }
          })
        } else {
          const transactionManager = new TransactionManager()
          const broadcastableObject = await transactionManager.createAndSignLocally(
            messageType,
            message,
            transactionData,
            senderAddress,
            network,
            'local',
            password
          )

          sendAsyncResponseToLunie(tabID, {
            type: 'LUNIE_SIGN_REQUEST_RESPONSE',
            payload: broadcastableObject
          })
        }

        sendResponse() // to popup
        break
      }
      case 'GET_SIGN_REQUEST': {
        sendResponse(signRequestStore.getSignRequest())
        break
      }
      case 'REJECT_SIGN_REQUEST': {
        const { id, tabID } = event.payload
        sendAsyncResponseToLunie(tabID, {
          type: 'LUNIE_SIGN_REQUEST_RESPONSE',
          payload: { rejected: true }
        })
        signRequestStore.removeSignRequest(id)
        sendResponse() // to popup
        break
      }
    }
  } catch (error) {
    const { tabID } = event.payload
    sendAsyncResponseToLunie(tabID || sender.tab.id, {
      type: 'LUNIE_SIGN_REQUEST_RESPONSE',
      payload: { error: error.message }
    })
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
