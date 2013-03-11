var MessageProcessor = require('./messageProcessor.js');
var defaultOptions = require('./processorDefaults.js');

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

	// Message handlers :
	// 1. for stat message
	this.messageProcessor.register('stats', function (message) {
		this.stats[message.threadId] = message.stats;
	});

	// 2. for ping-responses from threads
	this.messageProcessor.register('ping', function (message) {
		this.pings[message.threadId] = new Date().getTime();
	});

	// 3. for successfull message ack from threads
	this.messageProcessor.register('message-ack', function (message) {
		this.messageBuffer = this.messageBuffer.filter(function (m) {
			return m.id != message.messageId;
		});
		this.stats.waitingForDispatch -= 1;
		console.log('Processor> Received message-ack for message #' + message.messageId);
	});

	// 4. for successfull message completion from threads
	this.messageProcessor.register('message-done', function (message) {
		this.stats.totalMessagesProcessed += 1;
	});
};

Processor.prototype.options = defaultOptions;
Processor.prototype.threads = [];
Processor.prototype.stats = { waitingForDispatch: 0, totalMessagesReceived: 0, totalMessagesProcessed: 0 };
Processor.prototype.pings = { };
Processor.prototype.messageBuffer = [];
Processor.prototype._lastThreadId = 0;

Processor.prototype.process = function(message) {
	this.stats.waitingForDispatch += 1;
	this.stats.totalMessagesReceived += 1;
	this.enqueue(message);
	this.flush();
};

var counter = 0;
Processor.prototype.flush = function() {
	var numThreads = this.threads.length;
	if (numThreads === 0) return;
	var currentTime = new Date().getTime();
	this.messageBuffer.forEach(function (message) {

		// if message has been dispatched less than
		// options.messageAckTimeout ago, ignore it
		if (message._dispatchTime && currentTime - message._dispatchTime < this.options.messageAckTimeout) {
			return;
		}

		counter = counter % numThreads;
		var th = this.threads[counter];
		counter++;
		th.send(JSON.stringify(message));

		// timestamp the dispatch time on the message
		message._dispatchTime = currentTime;

		console.log('Processor> Queued message #' + message.id + ' to thread #' + th._threadId);
	}, this);
};

Processor.prototype.enqueue = function(message) {
	this.messageBuffer.splice(0, 0, message);
};

var statPollingInterval = null;
Processor.prototype.setupStatPolling = function() {
	if (statPollingInterval !== null) return;
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

Processor.prototype.startThread = function() {
	console.log('Processor> Starting thread...');
	var options = this.options;
	options.threadId = this._lastThreadId++;
	var childProcess = require('child_process').fork('./thread.js', [], {
		env: {
			options: JSON.stringify(options)
		}
	});
	childProcess._threadId = options.threadId;
	this.pings[options.threadId] = new Date().getTime();

	// set up pinging
	setInterval(function() {
		if (childProcess.connected === true) {
			childProcess.send(JSON.stringify({ type: 'ping' }));
		}
	}, options.pingInterval);

	// set up stat handling
	childProcess.on('message', function (message) {
		message = JSON.parse(message);
		var handler = processor.messageProcessor.getMessageProcessor(message);
		handler();
	});

	// set up respawn
	childProcess.on('exit', function (code, signal) {
		console.log('Processor> Child process terminated due to receipt of signal '+ signal + ', respawning...');
		processor.threads.push(processor.startThread());
		processor.flush();
	});

	return childProcess;
};

Processor.prototype.getStats = function() {
	return this.stats;
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