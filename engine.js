var Processor = require('./processor.js');

var Engine = function() {

};

var processorList = [];
Engine.prototype.process = function(fileName, message) {
	var proc = processorList.filter(function (p) {
		return p.fileName == fileName;
	})[0];
	if (proc) {
		proc.processor.process(message);
	} else {
		processorList.push({
			fileName: fileName,
			processor: new Processor({
				fileName: fileName
			})
		});
		this.process(fileName, message);
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