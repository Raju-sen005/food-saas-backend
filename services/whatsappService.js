// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');

// // Initialize client with local session caching so you only scan once
// const client = new Client({
//     authStrategy: new LocalAuth(),
//     puppeteer: {
//         args: ['--no-sandbox', '--disable-setuid-sandbox'] // Linux/VPS cloud servers validation
//     }
// });

// // Generate QR code in terminal for authentication
// client.on('qr', (qr) => {
//     console.log('============= WHATSAPP AUTHENTICATION REQUIRED =============');
//     qrcode.generate(qr, { small: true });
//     console.log('👉 Scan this QR code using your WhatsApp -> Linked Devices');
// });

// client.on('ready', () => {
//     console.log('✅ WhatsApp Gateway Matrix linked and running for free!');
// });

// client.initialize();

// // Utility function to send beautifully formatted message
// const sendWhatsAppRejection = async (customerPhone, orderDetails) => {
//     try {
//         // Indian country code (91) format filter matrix
//         let formattedPhone = customerPhone.replace(/\D/g, ''); // Extract digits only
//         if (!formattedPhone.startsWith('91')) {
//             formattedPhone = `91${formattedPhone}`;
//         }
//         const chatId = `${formattedPhone}@c.us`;

//         // 📝 Proper Premium Message Format Template
//         const message = 
// `🛑 *Order Update: Cancelled* 🛑

// Hello *${orderDetails.customerName}*,

// We regret to inform you that your order *${orderDetails.orderId}* could not be accepted by the kitchen.

// *🚫 Reason for Rejection:*
// _"${orderDetails.rejectReason}"_

// *💰 Refund Status:*
// If any payment was deducted, it will be automatically reversed to your source account within 2-3 business days.

// We apologize for the inconvenience caused. Feel free to re-order other available treats!

// Thank you,
// *Team Management*`;

//         await client.sendMessage(chatId, message);
//         console.log(`🚀 Automated WhatsApp message executed cleanly to: ${chatId}`);
//     } catch (error) {
//         console.error('❌ Failed to dispatch automated WhatsApp message pipeline:', error.message);
//     }
// };

// module.exports = { sendWhatsAppRejection };