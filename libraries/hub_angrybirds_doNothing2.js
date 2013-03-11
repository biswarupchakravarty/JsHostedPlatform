console.log('This is an angry birds handler');
console.log('It will exit after 2 seconds.');
setTimeout(function() {
	console.log('Exiting...');
	done(message.id);
}, 1000);