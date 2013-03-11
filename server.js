var HttpJSON = require('./jsonWebServer'),
	validator = require('./requestParser'),
	download = require('./downloader').download,
	log = require('./logger').log,
	getHandler = require('./getHandler').getHandler,
	execute = require('./executor').execute,
	Sandbox = require('node-sandbox'),
	fork = require('child_process').fork,
	getFromGithub = require('./githubDownloader').getFromGithub,
	Engine = require('./engine.js');


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
		default: response.write(JSON.stringify(engine.getStats()));
	}
	response.end();
}).listen(8081);
console.log('Stats server started @ :8081');

var engine = new Engine();
var server = new HttpJSON(function (request, response) {

	// validate the request
	parsedRequest = validator.parseRequest(request);

	// handle malformed requests
	if (parsedRequest.isValid === false) {
		response.statusCode = '500';
		response.end(JSON.stringify(parsedRequest), null, 2);
		return;
	}

	getHandler(parsedRequest, function (fileName) {
		console.log('Dispatching message to engine...');
		engine.process(fileName, parsedRequest);
	}, function () {
		console.log('Could not find required handler.');
	});

	response.statusCode = '200';
	response.end(JSON.stringify(parsedRequest, null, 2));

});

boot();