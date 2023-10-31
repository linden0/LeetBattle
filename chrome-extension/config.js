const ENVIRONMENT = 'development';
const DEV_WEBSOCKET_URL = 'ws://localhost:8080';
const PROD_WEBSOCKET_URL = 'wss://leet-battle.fly.dev';
const DEV_API_URL = 'http://localhost:8080';
const PROD_API_URL = 'https://leet-battle.fly.dev';

export const API_URL = ENVIRONMENT === 'development' ? DEV_API_URL : PROD_API_URL;
export const WEBSOCKET_URL = ENVIRONMENT === 'development' ? DEV_WEBSOCKET_URL : PROD_WEBSOCKET_URL;
