console.log('Response Hook activated for: ' + message.id);
console.dir(message);
done(message.id, message.json);