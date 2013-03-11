var cleanScope = function(func, args) {
	var environmentData = {
		account: args.account,
		deployment: args.deployment,
		authorization: args.authorization,
		handlerName: args.handlerName
	};
	var arguments = [args.eventArgs];
	
	return function() {
		func.apply(environmentData, arguments);
	}
}
exports.execute = function(func, args) {
	(function (args) {
		cleanScope(func, args)();
	})(args);
}