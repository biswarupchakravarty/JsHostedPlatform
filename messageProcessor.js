var MessageProcessor = function(thread) {
	var map = {};
	var scope = thread;

	this.register = function(messageType, handler) {
		map[messageType] = handler;
	};

	this.getMessageProcessor = function(message) {
		var messageType = message.type || 'payload';
		var m = message;
		var delegate = map[messageType] || function() {};
		return function() {
			delegate.apply(scope, [m]);
		};
	};
};

module.exports = MessageProcessor;