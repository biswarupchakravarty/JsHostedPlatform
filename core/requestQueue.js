var eventEmitter = require('events').EventEmitter;
var fs = require('fs');

var RequestQueue = function(options) {

	"use strict";

	options = options || {};
	if (!this instanceof RequestQueue)
		return new RequestQueue(options);

	var _emitter = new eventEmitter();
	var _fileName = options.logFileName || 'log_' + parseInt(Math.random() * 100, 10) + '.txt';
	var _queue = [], tempQ = [];
	var that = this;

	// try to read from local filesystem first
	fs.exists(_fileName, function (exists) {
		if (exists) {
			fs.readFile(_fileName, function (err, data) {
				if (err) throw err;
				_queue = JSON.parse(data);
				tempQ = JSON.parse(data);
			});
		}
		that.emit('init');
	});

	// to enqueue, first write to the file
	// only on a successfull write, add to queue
	this.enqueue = function(request, callback) {
		tempQ.push(request);
		fs.writeFile(_fileName, JSON.stringify(tempQ), function (err) {
			if (err) {
				if (callback) callback(err);
				return;
			}
			_queue.push(request);
			if (callback) callback(request);
		});
	};

	// first write to file
	// only on successfull write, remove from queue
	this.dequeue = function(callback) {
		var element = tempQ.shift();
		if (!element) return;
		fs.writeFile(_fileName, JSON.stringify(tempQ), function (err) {
			if (err) {
				if (callback) callback(err);
				return;
			}
			if (callback) callback(_queue.shift());
		});
	};

	// proxy method
	this.on = _emitter.on;
	this.emit = _emitter.emit;

};

exports.RequestQueue = RequestQueue;