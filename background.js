/*
  Uxento AI Creator - background.js (Service Worker)
  This script listens for the 'CREATE_COIN' action from the content script
  and makes the actual API call to the Uxento backend.
*/

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ensure the message is the one we want to handle
  if (request.action === "CREATE_COIN") {
    console.log("Background script received CREATE_COIN request with payload:", request.payload);

    // Perform the fetch operation to the creation API
    fetch("https://eu-dev.uxento.io/api/v1/create/bonk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.payload),
      credentials: "include" // Important for sending cookies/auth info
    })
    .then(response => {
      // Check if the request was successful
      if (!response.ok) {
        // If not, read the error body and throw an error
        return response.json().then(errorData => {
          throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      // On success, send back a success response
      console.log("API call successful:", data);
      sendResponse({ ok: true, data: data });
    })
    .catch(error => {
      // On failure, send back a failure response
      console.error("API call failed:", error);
      sendResponse({ ok: false, error: error.message });
    });

    // Return true to indicate that we will be sending a response asynchronously
    return true;
  }
});