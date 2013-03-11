exports.log = function(message, level) {
	if (!level) level = 'info';
	switch (level) {
		case 'info': console.log(message); break
	}
}