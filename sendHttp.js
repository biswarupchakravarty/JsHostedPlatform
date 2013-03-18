var o = {
    host: 'localhost',
    port: 443,
    path: '',
    data: "{}",
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
    }
};

exports.sendHttp = function(options, onSuccess, onError) {

    options = options || {};
    for (var key in options) {
        if (key == 'headers') {
            for (var header in options.headers) {
                if (options.headers[header]) {
                    o.headers[header] = options.headers[header];
                }
            }
        } else {
            o[key] = options[key];
        }
    }
    if (typeof o.data != 'string') o.data = JSON.stringify(o.data);
    o.headers['Content-Length'] = o.data.length;

    var x = require('https').request(o, function (res) {
        var receivedData = '';

        res.setEncoding('utf8');

        res.on('data', function (data) {
            receivedData += data;
        });


        res.on('end', function() {
            if (receivedData[0] != "{") receivedData = receivedData.substr(1, receivedData.length - 1);
            res.json = JSON.parse(receivedData);
            onSuccess(res);
        });
    });

    x.write(o.data);
    x.end();
};