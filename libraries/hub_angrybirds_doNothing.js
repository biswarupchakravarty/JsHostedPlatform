console.log('This is an angry birds handler');
console.log('It will exit after 2 seconds.');
setTimeout(function() {
	console.log('Exiting...');
	fs.exists('D:\\Repos\\js_hosted_platform\\thread.js', function (exists) {
		console.log('fs.exists value: ' + exists);
		done(message.id, { "myId": message.id });
	});
}, 1000);