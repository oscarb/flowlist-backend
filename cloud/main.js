'use strict';

const https = require('https');
const facebookConfig = require('./config/facebook-app');

// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

Parse.Cloud.define("test", function(request, response) {

  response.success(facebookConfig);
});



Parse.Cloud.define("requestAccessToken", function(request, response) {
  let authorizationCode = request.params.authorizationCode;
  console.log("Authorization code: " + authorizationCode);
  console.log("Node " + process.version);
  getAccessToken(authorizationCode);

  response.success(authorizationCode);
});


function getAccessToken(authorizationCode) {
  const facebookAppId = facebookConfig.APP_ID;
  const appSecret = facebookConfig.APP_SECRET;
  const url = "https://graph.accountkit.com/v1.2/access_token?grant_type=authorization_code&code=" + authorizationCode + "&access_token=AA|" + facebookAppId + "|" + appSecret;

  console.log("Getting URL: " + url);

  https.get(url, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    res.on('data', (d) => {
      process.stdout.write(d);
      console.log(d);
    });

  }).on('error', (e) => {
    console.error(e);
  });

}
