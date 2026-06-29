import axios from 'axios';

export async function getCCAccessToken() {
  const refreshToken = process.env.CC_REFRESH_TOKEN || process.env.CC_Refresh_Token;
  
  if (!refreshToken) {
    throw new Error('Constant Contact refresh token (CC_REFRESH_TOKEN) is not defined in environment variables.');
  }

  const credentials = Buffer.from(
    `${process.env.CC_CLIENT_ID}:${process.env.CC_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    'https://authz.constantcontact.com/oauth2/default/v1/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}
