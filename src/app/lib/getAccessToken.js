import qs from "qs"
import axios from "axios";

let access_token = null;

const getAccessToken = async() => {
  // if(access_token != null) {
  //   console.log(new Date(access_token.expires_at))
  //   return access_token.access_token
  // } else {
    return await axios.post("https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token", qs.stringify({
      "client_id": "TEST-M23O5AF1YO7TE_25060",
      "client_version": 1,
      "client_secret": "NzJjMDYzNTYtYzYwYi00MjJkLWFhZTEtMWIyMWMxMWRkNzcy",
      "grant_type": "client_credentials"
    }), {
      headers:{
      'Content-Type': 'application/x-www-form-urlencoded'
    }}).then(res=> {
      access_token = res.data;
      // console.log(new Date( Date.now() + access_token.expires_in), new Date())
      return res.data.access_token;
    }).catch(err=> {
      console.log(err)
    })
  // }
}

export default getAccessToken;