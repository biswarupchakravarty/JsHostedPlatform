var dummy = require('./dummyData').dummyData;

exports.parseRequest = function(request) {

	"use strict";

	var parsed = { isValid: false };
	var body = request.json || {};

	// extract the url fragments
	var fragments = request.url.split('/').filter(function (fragment) {
		return fragment.trim().length > 0;
	});

	// there should be 2 fragments: the account id and the event
	if (fragments.length != 1) return {
		isValid: false,
		message: 'URL should contain the event name'
	};

	var handlerName = fragments[0];

	// mocking the account, authorization and the deployment information
	var account = body.account || dummy.account,
		deployment = body.deployment || dummy.deployment,
		authorization = body.authorization || dummy.authorization,
		id = body.id || require('./guid').GUID(),
		isAsync = body.isAsync || false;

	// return the final parsed response
	return {
		isValid: true,
		id: id,
		account: account,
		authorization: authorization,
		deployment: deployment,
		handlerName: handlerName,
		isAsync: isAsync,
		eventArgs: body.data
	};
};