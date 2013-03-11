var http = require('http');

var JsonServer = function(handler) {

	// the internal http server
	var _server = http.createServer(function (request, response) {
		var parsedRequest = null, requestBody = '';

		response.setHeader('Content-Type', 'application/javascript');
		request.setEncoding('utf8');
		request.on('data', function(chunkedData) {
			requestBody += chunkedData;
		});

		// on receiving the completed request
		request.on('end', function() {
			console.log(requestBody);
			try {
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