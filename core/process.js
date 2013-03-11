var Process = function(options) {

	"use strict";

	options = options || {};
	var callback = options.callback || function() {

	};

	var source = options.source || function() {
		setTimeout(function() {
			console.log("Processing...");
		}, 500);
	};
	var args = [1, { key: 'value' }, "String Input", function() { console.log("this is a delegate..."); }];

	var Sandbox = require('node-sandbox').Sandbox;
	var s = new Sandbox('./sandboxed.js', {
		call_timeout: 3000,
		permissions: ["tty_wrap", "pipe_wrap", "require"]
	});

	s.run();

	s.rpc.expose('log', function (msg) {
		console.log(message);
	});

	var exposed = { argument: 3 };
	s.rpc.expose('exposed', function() {
		throw new Error("Something broke");
	});

	s.on('ready', function() {
		console.log('Ready..');
		takeAction();
	});

	s.on("lockup", function(){
		console.log('Lockup detected, restarting the sandbox...');
		s.kill();
		s.run();
	});

	s.on("stderr", function(text){
		console.log("ERROR........");
		console.log(JSON.parse(text.toString()));
	});

	var takeAction = function() {
		s.rpc.call('execute', args).then(function (result) {
			console.log('Value from sandbox: ');
			var nothing = (result instanceof Object) ? console.log(JSON.stringify(result, null, 2)) : console.log(result);
		}, function (e) {
			console.log('error: ' + e.message);
			s.kill();
		});
	};

};

new Process();