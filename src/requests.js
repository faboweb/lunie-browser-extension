export default class SignRequestQueue {
  constructor() {
    this.signRequest = undefined
    chrome.browserAction.setIcon({ path: 'icons/128x128.png' }) // to reset the icon in the beginning
  }

  storeSignRequest(args) {
    if (this.signRequest) {
      throw new Error(
        'Already sign request pending. Cancel or sign the existing request first.'
      )
    }
    this.signRequest = {
      ...args,
      id: Date.now()
    }
    chrome.browserAction.setIcon({ path: 'icons/128x128-alert.png' })
  }

  removeSignRequest() {
    if (!this.signRequest) {
      throw new Error('No signrequest present')
    }
    const signRequest = this.signRequest
    this.signRequest = undefined
    chrome.browserAction.setIcon({ path: 'icons/128x128.png' })
    return signRequest
  }

  removeSignRequestForTab(tabID) {
    if (this.signRequest && this.signRequest.tabID === tabID) {
      this.removeSignRequest()
    }
  }

  getSignRequest() {
    return this.signRequest
  }
}
