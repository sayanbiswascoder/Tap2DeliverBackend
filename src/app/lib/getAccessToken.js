import qs from "qs";
import axios from "axios";

let access_token = null;

/**
 * Fetches and caches the access token.
 * Reuses the token if not expired.
 */
const getAccessToken = async () => {
  const now = Date.now();

  // Reuse token if not expired
  if (access_token && access_token.expires_at > now) {
    return access_token.access_token;
  }

  try {
    const response = await axios.post(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
      qs.stringify({
        client_id: "TEST-M23O5AF1YO7TE_25060",
        client_version: 1,
        client_secret: "NzJjMDYzNTYtYzYwYi00MjJkLWFhZTEtMWIyMWMxMWRkNzcy",
        grant_type: "client_credentials",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = response.data;
    // Cache the token with expiry
    access_token = {
      access_token: data.access_token,
      expires_at: now + (data.expires_in || 0) * 1000, // Convert to ms
    };

    return access_token.access_token;
  } catch (err) {
    console.error("Failed to fetch access token:", err.message || err);
    throw err;
  }
};

export default getAccessToken;
