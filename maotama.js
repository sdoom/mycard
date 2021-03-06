const raw = require("raw-socket");
let socket = raw.createSocket({protocol: raw.Protocol.UDP});

let connect = (local_port, remote_port, remote_address)=> {
    let buffer = new Buffer(9);
    buffer.writeUInt16BE(local_port, 0);
    buffer.writeUInt16BE(remote_port, 2);
    buffer.writeUInt16BE(buffer.length, 4);
    socket.send(buffer, 0, buffer.length, remote_address, (error, bytes) => {
        if (error) {
            throw(error);
        }
    })
};

let handler = {connect: connect};

process.on('message', (message)=> {
    handler[message.action](...message.arguments);
});

process.on('disconnect', process.exit);

process.send('initialized');