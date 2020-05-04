// requests always reference a tab so that a response finds the right listener
// if a tab is killed or it's url changes the request is not useful anymore
export function bindRequestsToTabs(signRequestQueue) {
  // check if tab got removed
  chrome.tabs.onRemoved.addListener(function(tabID) {
    signRequestQueue.removeSignRequestForTab(tabID)
  })
  // check if url changed
  chrome.tabs.onUpdated.addListener(function(tabID) {
    // interprete any page update as a cancel
    signRequestQueue.removeSignRequestForTab(tabID)
  })
}
