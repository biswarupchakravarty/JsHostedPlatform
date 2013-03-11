exports.getFromGithub = function (options, onSuccess, onError) {

	"use strict";

	onError = onError || function () {};
	onSuccess = onSuccess || function () {};

	var treePath = '/repos/' + options.owner + '/' + options.repo + '/git/trees/master';
	var blobPath = '/repos/' + options.owner + '/' + options.repo + '/git/blobs/';

	var o = {
		host: 'api.github.com',
		port: 443,
		path: treePath,
		method: 'GET'
	};


	var treeRequest = require('https').get(o, function (res) {
		var pageData = "";
		res.setEncoding('utf8');

		res.on('data', function (chunk) {
			pageData += chunk;
		});

		res.on('end', function () {
			var treeData = JSON.parse(pageData);
			if (!treeData.tree || !treeData.tree.length) {
				onError();
				return;
			}

			var blobData = treeData.tree.filter(function (item) {
				return (item.type == 'blob' && item.path == options.file);
			})[0];
			if (!blobData) {
				onError();
				return;
			}
			o.path = blobPath + blobData.url.split('/')[blobData.url.split('/').length - 1];
			o.headers = {
				'Accept': 'application/vnd.github-blob.raw'
			};
			var blobRequest = require('https').get(o, function (res) {
				var pageData = "";
				res.setEncoding('utf8');

				res.on('data', function (chunk) {
					pageData += chunk;
				});

				res.on('end', function () {
					onSuccess(pageData);
				});

			});
		});
	});

};