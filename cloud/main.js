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



Parse.Cloud.define("requestSessionToken", function(request, response) {
  const authorizationCode = request.params.authorizationCode;

  getUserAccessToken(authorizationCode)
    .then(accessTokenData => accessTokenData.access_token)
    .then(accessToken => validateUserAccessToken(accessToken))
    .then(account => validateAppId(account))
    .then(account => loginUser(account))
    .then(user => { response.success(user.getSessionToken()) })
    .catch(error => {
      console.error("Error (" + error.code + "): " + error.message);
      response.error("Error (" + error.code + "): " + error.message);
    });

});


const getUserAccessToken = function(authorizationCode) {
  return new Promise((resolve, reject) => {
    const facebookAppId = facebookConfig.APP_ID;
    const appSecret =  facebookConfig.APP_SECRET;
    const url = "https://graph.accountkit.com/v1.2/access_token?grant_type=authorization_code&code=" + authorizationCode + "&access_token=AA|" + facebookAppId + "|" + appSecret;

    console.log("GET ACCESS TOKEN AT " + url);

    get(url)
      .then(data => resolve(JSON.parse(data)))
      .catch(error => reject(error));
  })
};

const validateUserAccessToken = function(token) {
  return new Promise((resolve, reject) => {
    const appSecretProof = getAppSecretProof(token);
    const url = 'https://graph.accountkit.com/v1.2/me/?access_token=' + token + '&appsecret_proof=' + appSecretProof;
    console.log("VALIDATE TOKEN " + token + " AT " + url);

    get(url)
      .then(data => resolve(JSON.parse(data)))
      .catch(error => reject(error));
  })
};

const validateAppId = function(account) {
  return new Promise((resolve, reject) => {
    console.log("VALIDATE APP ID " + account.application.id + " WITH " + facebookConfig.APP_ID)
    if (account.application.id == facebookConfig.APP_ID) {
      return resolve(account);
    } else {
      return reject(new Error('Failed to verify application id, got ' + account.application.id + ', should be ' + facebookConfig.APP_ID));
    }
  })
};

const loginUser = function(account) {
  return new Promise((resolve, reject) => {
    console.log("FIND USER WITH PHONE NUMBER " + account.phone.number);

    let query = new Parse.Query(Parse.User);
    query.equalTo("phoneNumber", account.phone.number);
    query.first()
      .then(user => {
      if(user) {
        console.log("USER EXISTS IN SYSTEM " + user.get('username'));
        // Found user, try to get session
        const randomPassword = getRandomPassword(32);
        user.setPassword(randomPassword);
        user.save(null, {useMasterKey: true})
          .then(user => Parse.User.logIn(user.get("username"), randomPassword))
          .then(user => resolve(user))
          .catch(error => reject(error));

      } else {
        // No user found, sign up user
        console.log("SIGN UP USER");

        let user = new Parse.User();
        user.set("accountKitId", account.id);
        user.set("phoneNumber", account.phone.number);
        user.set("phoneCountryPrefix", account.phone.country_prefix);
        user.set("username", getRandomUsername());
        user.set("password", getRandomPassword(32));

        resolve(user.signUp(null));

      }
    }).catch(error => reject(error));
  })
};


function getAppSecretProof(token) {
  return crypto.createHmac('sha256', facebookConfig.APP_SECRET)
    .update(token)
    .digest('hex');
}

// https://stackoverflow.com/questions/30309496/multiple-queries-with-parse-cloud-code-using-promises
// https://stackoverflow.com/questions/31747100/parse-cloud-code-chain-promises
// https://stackoverflow.com/questions/18229041/use-own-promises-in-parse-cloud-code
// https://github.com/petkaantonov/bluebird/wiki/Promise-anti-patterns
// https://gist.github.com/domenic/3889970

// https://stackoverflow.com/questions/24582031/parse-com-how-to-login-as-a-user-without-knowing-their-password
// http://blog.parse.com/announcements/bring-your-own-login/
// https://stackoverflow.com/questions/28240493/parse-create-save-new-user-without-signup
// https://stackoverflow.com/questions/29489008/parse-why-does-user-getsessiontoken-return-undefined
// https://stackoverflow.com/questions/37754290/parse-server-user-getsessiontoken-not-defined




// https://www.tomas-dvorak.cz/posts/nodejs-request-without-dependencies/
const get = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error('Failed to load ' + url + ' status code: ' + response.statusCode));
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
