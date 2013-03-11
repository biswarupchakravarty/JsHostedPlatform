exports.download = function(host, path, callback, errback) {

  var options = {
    host: host,
    port: 443,
    path: path || '/',
    method: 'GET'
  };

  var req = require('https').get(options, function(res) {
    var pageData = "";
    res.setEncoding('utf8');

    res.on('data', function (chunk) {
      pageData += chunk;
    });

    res.on('end', function (){
      callback(pageData);
    });

    res.on('error', function() {
      if (errback) errback();
    });

  });

};