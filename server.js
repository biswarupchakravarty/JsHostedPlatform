var HttpJSON = require('./jsonWebServer'),
	validator = require('./requestParser'),
	download = require('./downloader').download,
	log = require('./logger').log,
	getHandler = require('./getHandler').getHandler,
	execute = require('./executor').execute,
	Sandbox = require('node-sandbox'),
	fork = require('child_process').fork,
	getFromGithub = require('./githubDownloader').getFromGithub,
	Engine = require('./engine.js'),
	sendHttp = require('./sendHttp.js').sendHttp;


if (false) {
	getFromGithub({
		owner: 'biswarupchakravarty',
		repo: 'JavascriptSDK',
		file: 'article.js'
	}, function(text) {
		console.log(text);
	}, function() {
		console.log('Could not get specified file');
	});
}


var boot = function() {
	if (false) {
		log('Started fetching metadata about events-handlers mapping from github...');
		download('raw.github.com', '/biswarupchakravarty/appacitive_js_libraries/master/map.js', function (raw) {
			log('Fetched metadata about events-handlers mapping from github.');
			map = JSON.parse(raw);
			server.listen(8080);
			log('Accepting requests...');
		});
	}
	server.listen(8080);
	log('Accepting requests @ :8080');
};

require('http').createServer(function (request, response) {
	var keyword = request.url.split('/').filter(function (token) {
		return token.trim().length > 0;
	});
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Method', 'GET, POST, UPDATE, DELETE');
	response.setHeader('Content-Type', 'application/javascript');
	response.statusCode = '200';
	if (keyword.length == 1) keyword = keyword[0]; else keyword = 'stats';
	switch (keyword) {
		case 'logs':
			response.write(JSON.stringify(engine.getLogs()));
			break;
		case 'stats':
			response.write(JSON.stringify(engine.getStats()));
			break;
	}
	response.end();
}).listen(8081);
console.log('Stats server started @ :8081');

var engine = new Engine();

var proxyServer = new HttpJSON(function (request, response) {

	var payload = request.json, startTime;
	payload.__pre = true;
	payload.id = require('./guid').GUID();

	console.log('Received request: ' + request.initialMethod + ': ' + request.initialUrl);

	for (var header in request.headers) {
		response.setHeader(header, request.headers[header]);
	}

	if (request.initialMethod == 'OPTIONS') {
		response.statusCode = '200';
		response.end();
		console.log('Sent response successfully.');
		return;
	}

	getHandler(payload, function (fileName) {
		console.log('Sending to the request hooks...');
		engine.process(fileName, payload, function (resp) {
			startTime = new Date().getTime();
			sendHttp({
				host: 'apis.appacitive.com',
				path: request.initialUrl,
				method: request.initialMethod,
				data: request.json,
				headers: {
					'appacitive-session': request.headers['appacitive-session'],
					'appacitive-environment': request.headers['appacitive-environment'],
					'appacitive-user-auth': request.headers['appacitive-user-auth']
				}
			}, function (apiResponse) {
				console.log('Remote response received in ' + (new Date().getTime() - startTime) + 'ms, forwarding.');
				apiResponse.json.__post = true;
				apiResponse.json.id = require('./guid').GUID();
				getHandler(apiResponse.json, function (fileName) {
					console.log('Now sending for the response hooks...');
					engine.process(fileName, apiResponse.json, function (ultimateResponse) {
						for (var header in apiResponse.headers) {
							if (header.toLowerCase() != 'content-length')
								response.setHeader(header, apiResponse.headers[header]);
						}
						response.setHeader('Content-Length', ultimateResponse.length);
						response.statusCode = apiResponse.statusCode;
						response.end(ultimateResponse);
						console.log('Sent response successfully.');
					});
				});
			}, function (err) {
				// nothing to do here!
			});
		});
	}, function () {
		console.log('Could not find required handler.');
		response.statusCode = '404';
		response.end('Could not find required handler.');
		console.log('Sent response successfully.');
	});

});

proxyServer.listen(8082);

var server = new HttpJSON(function (request, response) {

	// validate the request
	parsedRequest = validator.parseRequest(request);

	// handle malformed requests
	if (parsedRequest.isValid === false) {
		response.statusCode = '500';
		response.end(JSON.stringify(parsedRequest), null, 2);
		return;
	}

	// TODO: cleanup
	getHandler(parsedRequest, function (fileName) {
		console.log('Dispatching message to engine...');
		if (parsedRequest.isAsync === false) {
			engine.process(fileName, parsedRequest, function (resp) {
				response.statusCode = '200';
				parsedRequest.response = resp;
				response.end(JSON.stringify(parsedRequest, null, 2));
			});
		} else {
			engine.process(fileName, parsedRequest);
			response.statusCode = '200';
			response.end(JSON.stringify(parsedRequest, null, 2));
		}
	}, function () {
		console.log('Could not find required handler.');
		response.statusCode = '404';
		response.end('Could not find required handler.');
	});

});

boot();