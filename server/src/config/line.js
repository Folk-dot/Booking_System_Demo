import * as line from '@line/bot-sdk';

// Default client for single-tenant. For multi-tenant, create per request using tenant's credentials.
function createLineClient(channelAccessToken, channelSecret) {
  return new line.messagingApi.MessagingApiClient({ channelAccessToken });
}

function createLineSdkMiddleware(channelSecret) {
  return line.middleware({ channelSecret });
}

export { createLineClient, createLineSdkMiddleware };
