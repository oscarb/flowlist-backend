'use strict';

const url = require('url');
const crypto = require('crypto');
var ParseServer = require('parse-server').ParseServer;
const https = require('https');
const facebookConfig = require('./config/facebook-app');


// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

Parse.Cloud.define("test", function(request, response) {
  response.success(api);
});



Parse.Cloud.define("requestAccessToken", function(request, response) {
  let authorizationCode = request.params.authorizationCode;
  console.log("Authorization code: " + authorizationCode);
  console.log("Node " + process.version);
  getAccessToken(authorizationCode, function(data) {
    console.log("RESPONSE: " + data);
    const userAccount = JSON.parse(data);
    validateUserAccessToken(userAccount.access_token);
    // TODO Check if it is possible to send an object (and recieve a HashMap..)
    response.success(data);
  });
});


function validateUserAccessToken(token) {
  // URL GET https://graph.accountkit.com/v1.2/me/?access_token=<access_token>
  const appSecretProof = crypto.createHmac('sha256', facebookConfig.APP_SECRET)
                                .update(token)
                                .digest('hex');
  const url = 'https://graph.accountkit.com/v1.2/me/?access_token=' + token + '&appsecret_proof=' + appSecretProof;
  console.log("Validate token at " + url)

  get(url)
    .then(data => loginUser(JSON.parse(data)))
    .catch(err => console.error(err));
}

function loginUser(account) {
  console.log("ACCOUNT", account)
  if(account.application.id != facebookConfig.APP_ID) return;

  getSessionToken(account);
}

function getSessionToken(account) {

  // TODO If user with phone number does not exist, sign up user and store information, otherwise just login
  // TODO Get session token and return to client

  // Save phoneNumber, phoneCountryPrefix and accountKitId

  // https://stackoverflow.com/questions/24582031/parse-com-how-to-login-as-a-user-without-knowing-their-password
  // http://blog.parse.com/announcements/bring-your-own-login/
  // https://stackoverflow.com/questions/28240493/parse-create-save-new-user-without-signup
  // https://stackoverflow.com/questions/29489008/parse-why-does-user-getsessiontoken-return-undefined
  // https://stackoverflow.com/questions/37754290/parse-server-user-getsessiontoken-not-defined

  console.log("Looking for user with phone number ", account.phone.number);
  let query = new Parse.Query(Parse.User);
  query.equalTo("phoneNumber", account.phone.number);
  query.first()
    .then(user => {
      if(user) {
        // Found user, try to get session
      } else {
        // No user found, sign up user
        let user = new Parse.User();
        user.set("accountKitId", account.id);
        user.set("phoneNumber", account.phone.number);
        user.set("phoneCountryPrefix", account.phone.country_prefix);
        user.set("username", getRandomUsername());
        user.set("password", getRandomPassword(32));

        console.log("Random username " + getRandomUsername());
        console.log("Random password " + getRandomPassword(32))

        user.signUp(null).then(user => {
          // TODO Do something with signed up user
          console.log("Signed up user, session token" + user.getSessionToken() );

        }).catch(error => console.error("Error: " + error.code + " " + error.message));

      }
    }).catch(error => console.error(error));


}

function getAccessToken(authorizationCode, callback) {
  const facebookAppId = facebookConfig.APP_ID;
  const appSecret =  facebookConfig.APP_SECRET;
//  let graphUrl = url.parse('https://graph.accountkit.com');
//  graphUrl.pathname = '/v1.2/access_token';
//  graphUrl.query['grant_type'] = 'authorization_code';
//  graphUrl.query['code'] =  authorizationCode;
//  graphUrl.query['access_token'] = 'AA|' + facebookAppId + '|' + appSecret;
//
  const url = "https://graph.accountkit.com/v1.2/access_token?grant_type=authorization_code&code=" + authorizationCode + "&access_token=AA|" + facebookAppId + "|" + appSecret;

  console.log("Getting URL: " + url);

  get(url)
    .then((html) => callback(html))
    .catch((err) => console.error(err));

}

// https://www.tomas-dvorak.cz/posts/nodejs-request-without-dependencies/
const get = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load page, status code: ' + response.statusCode));
      }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on('data', (chunk) => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on('end', () => resolve(body.join('')));
    });
    // handle connection errors of the request
    request.on('error', (err) => reject(err))
  })
};

function getRandomUsername() {
  return generateQuickGuid();
}

function generateQuickGuid() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function getRandomPassword(length) {
  return crypto.randomBytes(Math.ceil(length * 3 / 4))
    .toString('base64')
    .slice(0, length)
    .replace(/\//g,'_')
    .replace(/\+/g,'-');
}
