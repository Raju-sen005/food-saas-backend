const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true, // Dev environment wrapper
      credentials: true
    },
    pingTimeout: 60000 // Multi-tenant network stability handle 
  });

  io.on('connection', (socket) => {
    // 1. Establish tenant dashboard isolation channel room
    socket.on('join_restaurant_room', (restaurantId) => {
      socket.join(restaurantId);
      console.log(`🔌 Admin User linked to secure tracking channel: ${restaurantId}`);
    });

    // 2. Establish unique customer real-time tracking scope
    socket.on('join_order_tracker', (orderId) => {
      socket.join(orderId);
      console.log(`📡 Customer tracking channel locked to order ID: ${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log('⚡ Socket pipeline detached smoothly');
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io layer has not been initialized yet!');
  }
  return io;
};

module.exports = { initSocket, getIO };