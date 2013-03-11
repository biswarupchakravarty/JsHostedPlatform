/*jslint node: true */

"use strict";

var q = require('./requestQueue').RequestQueue;

var queue = new q();

queue.on('init', function() {
	console.log('init fired');
	var written = 0;
	var writeCallback = function() {
		written += 1;
		if (written == 1000 - 1) {
			console.log('Done.');
			var readCallback = function(request) {
				console.dir(request.id);
			};
			for (var i=0;i<1000;i++) {
				queue.dequeue(readCallback);
			}
		}
	};
	for (var i=0;i<1000;i++) {
		queue.enqueue({ _id: i }, writeCallback);
	}
	
	// console.dir(queue.dequeue());
});