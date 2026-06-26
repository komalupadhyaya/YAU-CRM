import axios from 'axios';

export async function getCCAccessToken() {
  const credentials = Buffer.from(
    `${process.env.CC_CLIENT_ID}:${process.env.CC_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    'https://authz.constantcontact.com/oauth2/default/v1/token',
    'grant_type=client_credentials&scope=contact_data',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}
