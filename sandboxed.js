if (message.id % 199 === 0) {
	console.log('------------------------ LOCKUP --------------------------------');
	while (true) { }
}

setTimeout(function() {
	console.log('<Hosted Code> Executed payload #' + JSON.stringify(message.id));
	done(message.id);
}, 3000);

// while (true) { }