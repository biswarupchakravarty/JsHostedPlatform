var MessageProcessor = require('./messageProcessor.js');
var defaultOptions = require('./processorDefaults.js');
var messageCodes = require('./ipcMessageCodes.js');

var Processor = function(options) {
	options = options || {};

	var that = this;

	// extend the defaults
	for (var key in options) {
		this.options[key] = options[key];
	}

	// boot up the threads
	for (var x = 0; x < this.options.numThreads; x += 1) {
		this.threads.push(this.startThread());
	}

	// message processing from threads
	this.messageProcessor = new MessageProcessor(this);

	// lockup detection
	setInterval(function() {
		var threshold = that.options.lockTimeout;
		var filterDelegate = function (thread) {
			return thread._threadId == threadId;
		};
		var removeDelegate = function (thread) {
			return thread._threadId != cp._threadId;
		};
		var currentTime = new Date().getTime();
		for (var threadId in that.pings) {
			var ping = that.pings[threadId];
			if (currentTime - ping >= threshold) {
				// disconnect and kill the process
				var cp = that.threads.filter(filterDelegate);
				if (cp.length == 1) {
					cp = cp[0];
					delete that.pings[threadId];
					that.threads = that.threads.filter(removeDelegate);
					cp.disconnect();
					cp.kill();
					console.log('Processor> Detected lockup in thread #' + threadId + '.');
				} else {
					throw new Error('Could not find locked up thread.');
				}
			}
		}
	}, this.options.lockTimeout);

	// set up stat polling
	this.setupStatPolling();

	// set up log polling
	this.setupLogPolling();

	// Message handlers :
	// 1. for stat message
	this.messageProcessor.register('stats', function (message) {
		this.stats[message.threadId] = message.stats;
	});

	// 2. for ping-responses from threads
	this.messageProcessor.register('ping', function (message) {
		this.pings[message.threadId] = new Date().getTime();
	});

	// 3. for logs from threads
	this.messageProcessor.register('logs', function (message) {
		this.logs[message.threadId] = message.logs;
	});

	// 6. to respond to requests for messages from threads
	this.messageProcessor.register(messageCodes.REQUEST_FOR_MESSAGE, function (message) {
		console.log('Processor> Received request for message, ' + this.messageBuffer.length + ' messages in queue');
		if (this.messageBuffer.length === 0) return;
		var thread = this.threads.filter(function (thread) {
			return thread._threadId == message.threadId;
		})[0];
		var messageToSend = this.messageBuffer.pop();
		thread.send(JSON.stringify(messageToSend));
		console.log('Processor> Served request for message, ' + this.messageBuffer.length + ' messages in queue');
	});

	// 7. to respond to messages from threads signifying completion of execution
	this.messageProcessor.register(messageCodes.EXECUTION_COMPLETED, function (message) {
		console.log('Processor> Some thread got done with execution, there are ' + this.messageBuffer.length + ' messages in queue.');
		this.stats.totalMessagesProcessed += 1;
		this.executeCallbacks(message.messageId, message.response);
		if (this.messageBuffer.length === 0) return;
		console.log('Processor> Gonna give him more work...');
		var messageToSend = this.messageBuffer.pop();
		var thread = this.threads.filter(function (thread) {
			return thread._threadId == message.threadId;
		})[0];
		thread.send(JSON.stringify(messageToSend));
	});
};

Processor.prototype.options = defaultOptions;
Processor.prototype.threads = [];
Processor.prototype.stats = { waitingForDispatch: 0, totalMessagesReceived: 0, totalMessagesProcessed: 0 };
Processor.prototype.pings = { };
Processor.prototype.messageBuffer = [];
Processor.prototype.callbacks = {};
Processor.prototype._lastThreadId = 0;
Processor.prototype.logs = { };

Processor.prototype.process = function(message, callback) {
	this.stats.waitingForDispatch += 1;
	this.stats.totalMessagesReceived += 1;
	this.enqueue(message);
	this.registerCallback(message.id, callback);
	this.flush();
};

// do this async, the request has been processed
// sending the response isnt super critical
// and it has to travel up the stack a few layers (in-process though)
Processor.prototype.executeCallbacks = function(messageId, response) {
	var that = this;
	setTimeout(function() {
		var callback = that.callbacks[messageId];
		if (!callback) return;
		callback(response);
		delete that.callbacks[messageId];
	}, 0);
};

// broadcast to all the threads
// there there are new messages to pick up
Processor.prototype.flush = function() {
	this.broadcast({
		type: messageCodes.NEW_MESSAGE_IN_QUEUE
	});
};

Processor.prototype.broadcast = function(message) {
	this.threads.forEach(function (thread) {
		thread.send(JSON.stringify(message));
	});
};

Processor.prototype.enqueue = function(message) {
	message.type = messageCodes.NEW_MESSAGE_FOR_THREAD;
	this.messageBuffer.splice(0, 0, message);
};

Processor.prototype.registerCallback = function(messageId, callback) {
	if (typeof callback != 'function') return;
	this.callbacks[messageId] = callback;
};

var statPollingInterval = null;
Processor.prototype.setupStatPolling = function() {
	if (statPollingInterval !== null) return;
	var options = this.options;
	var that = this;

	statPollingInterval = setInterval(function() {
		// clear the threads' stats
		for (var key in that.stats) {
			if (parseInt(key, 10) == key) {
				delete that.stats[key];
			}
		}

		// request stats from all connected threads
		that.threads.forEach(function (thread) {
			if (thread.connected === true) {
				thread.send(JSON.stringify({ type: 'stats' }));
			}
		});
	}, options.statPollingInterval);
};

var logPollingInterval = null;
Processor.prototype.setupLogPolling = function() {
	if (logPollingInterval !== null) return;
	var options = this.options;
	var that = this;

	logPollingInterval = setInterval(function() {
		// clear the threads' logs
		for (var key in that.logs) {
			if (parseInt(key, 10) == key) {
				delete that.logs[key];
			}
		}

		// request stats from all connected threads
		that.threads.forEach(function (thread) {
			if (thread.connected === true) {
				thread.send(JSON.stringify({ type: 'logs' }));
			}
		});
	}, options.logPollingInterval);
};

var pingIntervalHandlers = { };
Processor.prototype.setupPinging = function(thread, threadId) {
	var options = this.options;

	// set up pinging
	pingIntervalHandlers[threadId] = setInterval(function() {
		if (thread.connected === true) {
			thread.send(JSON.stringify({ type: 'ping' }));
		}
	}, options.pingInterval);
};


Processor.prototype.setupThreadRespawn = function(thread, threadId) {
	var that = this;
	thread.on('exit', function (code, signal) {

		console.log('Processor> Child process terminated due to receipt of signal '+ signal + ', respawning...');

		// Clean up timers
		// 1. ping 
		clearInterval(pingIntervalHandlers[threadId]);
		delete pingIntervalHandlers[threadId];

		// respawn thread
		that.threads.push(that.startThread());

		// flush the queue if requests have piled up
		that.flush();
	});
};

Processor.prototype.startThread = function() {
	console.log('Processor> Starting thread...');
	var options = this.options, that = this;
	options.threadId = this._lastThreadId++;
	var childProcess = require('child_process').fork('./thread.js', [], {
		env: {
			options: JSON.stringify(options)
		}
	});
	childProcess._threadId = options.threadId;
	this.pings[options.threadId] = new Date().getTime();

	// set up pinging
	this.setupPinging(childProcess, options.threadId);

	// set up stat handling
	childProcess.on('message', function (message) {
		message = JSON.parse(message);
		var handler = that.messageProcessor.getMessageProcessor(message);
		handler();
	});

	// set up respawn
	this.setupThreadRespawn(childProcess, options.threadId);

	return childProcess;
};

Processor.prototype.getStats = function() {
	return this.stats;
};

Processor.prototype.getLogs = function() {
	return this.logs;
};

Processor.prototype.mock = function() {
	var that = this;
	var mockMessage = function() {
		var m = {
			id: parseInt(Math.random() * 1000, 10),
			body: 'Hello World'
		};
		that.process(m);
	};

	if (true) {
		// lets burst first
		mockMessage();
		mockMessage();
		mockMessage();
		mockMessage();
	}

	// now interval
	setInterval(mockMessage, 1000);
};

if (false) {
	// testing
	var processor = new Processor({
		fileName: './sandboxed.js'
	});

	setInterval(function() {
		console.log(JSON.stringify(processor.pings, null, 2));
		console.log(JSON.stringify(processor.getStats(), null, 2));
	}, 3000);

	processor.mock();
}

module.exports = Processor;