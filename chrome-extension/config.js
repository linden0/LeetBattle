const ENVIRONMENT = 'development';

const DEV_API_URL = 'http://localhost:3000';
const PROD_API_URL = 'https://leet-battle.fly.dev';

export const API_URL = ENVIRONMENT === 'development' ? DEV_API_URL : PROD_API_URL;
