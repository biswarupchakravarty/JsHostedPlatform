var vm = require('vm');
var MessageProcessor = require('./messageProcessor.js');
var messageCodes = require('./ipcMessageCodes.js');

var Thread = function(options) {
	var that = this;
	that.id = options.threadId;

	require('fs').exists(options.fileName, function (exists) {
		if (exists) {
			require('fs').readFile(options.fileName, function (err, data) {
				if (err) throw err;
				that._script = vm.createScript(data, './' + options.fileName + '.vm');
				console.log('Thread> Thread #' + that.id + ' ready to execute messages.');
				that.onReady();
			});
		} else {
			throw new Error('Could not boot thread for file: ' + options.fileName);
		}
	});

    // default options
    options.maxMessagesPerThread = options.maxMessagesPerThread || 3;
    that.options = options;

    // public members
    this.queue = [];
    this.ready = false;
    this.stats = {
		messages: {
			total: 0,
			executing: 0,
			queued: 0,
			completed: 0
		},
		elapsedTime: 0,
		startTime: new Date().getTime()
	};
};

Thread.prototype.enqueue = function(message) {
	this.stats.messages.total += 1;
	console.log('Thread> Thread #' + this.id + ' received message #' + message.id);
	if (this.ready === true && this.stats.messages.executing < this.options.maxMessagesPerThread) {
		this.execute(message);
	} else {
		this.queue.splice(0, 0, message);
		this.stats.messages.queued += 1;
	}
};

var timerMap = { };
Thread.prototype.execute = function(message) {
	this.sandbox.message = message;
	this.stats.messages.executing += 1;
	timerMap[message.id] = new Date().getTime();
	this.currentlyExecuting = true;
	console.log('Thread #' + this.id + '> Executing client code...');
	this._script.runInNewContext(this.sandbox);
};

Thread.prototype.onHandlerCompleted = function(messageId, response) {
	console.log('Thread #' + this.id + '> Done executing');
	this.stats.messages.executing -= 1;
	this.stats.messages.completed += 1;
	this.stats.elapsedTime += (new Date().getTime()) - timerMap[messageId];
	this.currentlyExecuting = false;
	delete timerMap[messageId];
	process.send(JSON.stringify({
		type: messageCodes.EXECUTION_COMPLETED,
		threadId: this.id,
		messageId: messageId,
		response: JSON.stringify(response)
	}));
};

Thread.prototype.onReady = function() {
	this.ready = true;
	this.queue.forEach(function (message) {
		this.stats.messages.queued -= 1;
		this.execute(message);
	}, this);
};

var log = function() {
	if (arguments.length == 2) {
		logMessage(arguments[0], arguments[1]);
	} else {
		logMessage(logLevels.LOG, arguments[0]);
	}
};

var logStorage = [];
var logMessage = function(lvl, msg) {
	switch (lvl) {
		case logLevels.LOG:
			logStorage.splice(0, 0, msg);
			console.log(msg);
			break;
		default: console.log(msg);
	}
};

Thread.prototype.sandbox = {
	Appacitive: { key: 'value' },
	setTimeout: setTimeout,
	console: { log: log, dir: console.dir },
	fs: require('fs'),
	done: function(messageId, response) {
		thread.onHandlerCompleted.apply(thread, [messageId, response]);
	}
};

var logLevels = {
	DEBUG: 0,
	LOG: 1,
	WARN: 2,
	ERROR: 3
};

var options = JSON.parse(process.env.options);
var thread = new Thread(options);

thread.messageProcessor = new MessageProcessor(thread);

// when notified that there is a new message 
// in the queue, ask the processor for a message
thread.messageProcessor.register(messageCodes.NEW_MESSAGE_IN_QUEUE, function(message) {
	console.log('Thread #' + this.id + '> Got notification of new work item.');
	if (this.currentlyExecuting) return;
	console.log('Thread #' + this.id + '> Requesting work from processor.');
	process.send(JSON.stringify({
		type: messageCodes.REQUEST_FOR_MESSAGE,
		threadId: this.id
	}));
});

thread.messageProcessor.register(messageCodes.NEW_MESSAGE_FOR_THREAD, function(message) {
	this.enqueue(message);
});

process.on('message', function(message) {
	thread.messageProcessor.getMessageProcessor(JSON.parse(message))();
});

thread.messageProcessor.register('ping', function(message) {
	process.send(JSON.stringify({
		type: 'ping',
		threadId: this.id
	}));
});

thread.messageProcessor.register('logs', function(message) {
	process.send(JSON.stringify({
		type: 'logs',
		threadId: this.id,
		logs: logStorage
	}));
});

thread.messageProcessor.register('stats', function() {
	process.send(JSON.stringify({
		type: 'stats',
		threadId: this.id,
		stats: this.stats
	}));
});