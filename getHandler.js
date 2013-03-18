var fs = require('fs'), getFromGithub = require('./githubDownloader').getFromGithub;

var cached_copy = false;
exports.getHandler = function (parsedRequest, onSuccess, onError) {

	"use strict";

	var noHandler = { isValid: false };

	var fullyQualifiedHandlerName;
	if (parsedRequest.account && parsedRequest.deployment && parsedRequest.handlerName) {
		fullyQualifiedHandlerName = parsedRequest.account.name + '_' + parsedRequest.deployment.name + '_' + parsedRequest.handlerName + '.js';
	} else {
		if (parsedRequest.__pre) {
			fullyQualifiedHandlerName = 'hub_angrybirds_preRequestHook.js';
		} else if (parsedRequest.__post) {
			fullyQualifiedHandlerName = 'hub_angrybirds_preResponseHook.js';
		}
	}
	var host = 'raw.github.com';
	var path = '/biswarupchakravarty/appacitive_js_libraries/master/libraries/';
	path += fullyQualifiedHandlerName;

	var pathSeparator = '\\';
	var fileName = __dirname + pathSeparator + 'libraries' + pathSeparator + fullyQualifiedHandlerName;

	var download = function(onSuccess, onError) {
		getFromGithub({
			owner: 'biswarupchakravarty',
			repo: 'appacitive_js_libraries',
			file: fullyQualifiedHandlerName
		}, onSuccess, onError);
	};

	var readFile = function() {
		if (cached_copy === true) {
			console.log('Reading file from in-memory cache');
			onSuccess(fileName);
			return;
		}
		fs.exists(fileName, function (exists) {
			if (exists) {
				console.log('Found local copy of file @ ' + fileName);
				cached_copy = true;
				// read and return
				onSuccess(fileName);
			} else {
				console.log('Could not find local file. Fetching from github...');
				download(function (downloadedData) {
					console.log('Fetched file from github.');
					fs.writeFile(fileName, downloadedData, 'utf-8', readFile);
				}, onError);
			}
		});
	};
	readFile();
};