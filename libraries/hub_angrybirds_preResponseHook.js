console.log('Response Hook activated for: ' + message.id);
message.senderName = 'Chirag Sanghvi';
done(message.id, message);