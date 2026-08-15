chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.error('Unable to configure Vault side-panel opener.', error);
});
