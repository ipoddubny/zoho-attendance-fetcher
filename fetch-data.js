var needle = require('needle');
var _ = require('lodash');
var Promise = require('bluebird');
Promise.promisifyAll(needle);
var uuid = require('uuid');
var moment = require('moment');


var config = require('./config');


function fetchAttendance(params, cookies) {

  var dataBuffer = [];
  var startIndex = 1;
  var ttl = 5;
  var requestToken = uuid.v1();
  var attendanceURL = 'https://people.zoho.com/people/AttendanceAction.do';

  var reqParams = _.extend({}, params, {
    mode: 'customReport',
    conreqcsr: requestToken
  });

  var options = {
    cookies: _.extend({}, cookies, {CSRF_TOKEN: requestToken})
  };

  var getNext = function () {

    return needle.postAsync(attendanceURL, reqParams, options)
      .then(function (res) {

        dataBuffer = dataBuffer.concat(res.body.report);

        var len = res.body.report.length;
        // Received all the data, return from the chain
        if (len < 50) {
          return dataBuffer;
        }

        ttl--;
        if (!ttl) {
          throw new Error('oops we have made too many requests, something is wrong');
        }

        startIndex += 50;

        _.extend(reqParams, {startIndex: startIndex});

        return Promise.delay(300).then(function () {
          return getNext();
        });
      });
  };

  return getNext();
}


function logInToZoho(login, password) {

  var loginToken = uuid.v1();

  var data = {
    LOGIN_ID: login,
    PASSWORD: password,
    IS_AJAX: 'true',
    remember: 2592000,
    iamcsrcoo: loginToken
  };

  var loginURL = 'https://accounts.zoho.com/login?servicename=zohopeople';

  return needle.postAsync(loginURL, data, {
    cookies: {
      iamcsr: loginToken
    }
  });
}


function getDataFromZoho(date) {

  var sdate = moment(date).date(1).format('DD-MMM-YYYY');
  var edate = moment(date).add(1, 'months').date(0).format('DD-MMM-YYYY');

  return logInToZoho(config.login, config.password)
    .then(function (res) {

      return fetchAttendance({sdate: sdate, edate: edate}, res.cookies);
    });
}


getDataFromZoho()
  .then(function (data) {

    console.log(JSON.stringify(data, 0, 2));
  })
  .catch(function (err) {

    console.error('FAIL. Something went terribly wrong.');
    console.error(err);
    process.exit(1);
  });
