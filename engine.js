var Processor = require('./processor.js');

var Engine = function() {

};

var processorList = [];
var processorCount = 0;

Engine.prototype.process = function(fileName, message, callback) {
	callback = callback || function() {};
	var proc = processorList.filter(function (p) {
		return p.fileName == fileName;
	})[0];
	if (proc) {
		proc.processor.process(message, callback);
	} else {
		processorList.push({
			fileName: fileName,
			processor: new Processor({
				fileName: fileName,
				id: processorCount++
			})
		});
		this.process(fileName, message, callback);
	}
};

Engine.prototype.getStats = function() {
	return processorList.map(function (processor) {
		return {
			fileName: processor.fileName,
			stats: processor.processor.getStats()
		};
	});
};

Engine.prototype.getLogs = function() {
	return processorList.map(function (processor) {
		return {
			fileName: processor.fileName,
			logs: processor.processor.getLogs()
		};
	});
};

module.exports = Engine;