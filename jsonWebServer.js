var http = require('http');

var JsonServer = function(handler) {

	// the internal http server
	var _server = http.createServer(function (request, response) {
		var parsedRequest = null, requestBody = '';

		response.setHeader('Content-Type', 'application/javascript');
		response.setHeader('Access-Control-Allow-Origin', '*');
		response.setHeader('Access-Control-Allow-Methods', 'GET, POST, UPDATE, DELETE, PUT');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type, appacitive-environment, appacitive-session');
		request.setEncoding('utf8');
		request.initialUrl = request.url;
		request.initialMethod = request.method;

		request.on('data', function(chunkedData) {
			requestBody += chunkedData;
		});

		// ignore the query string
		if (request.url.indexOf('?') !== -1) {
			request.url = request.url.substr(0, request.url.indexOf('?'));
		}

		// on receiving the completed request
		request.on('end', function() {
			try {
				if (requestBody.trim().length === 0) requestBody = '{}';
				request.json = JSON.parse(requestBody);
				handler(request, response);
			} catch (e) {
				response.statusCode = '500';
				response.end(JSON.stringify({ isValid: false, message: e.message || 'Broken JSON encountered in request body.' }), null, 2);
				return;
			}
		});

	});

	this.listen = function(port) {
		_server.listen(port);
	};

};

module.exports = JsonServer;