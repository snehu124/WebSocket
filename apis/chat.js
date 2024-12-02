
// module.exports = (server) => {
// const socket = io();
// const mobile = prompt("Enter your mobile number to log in:");
// socket.emit('userLogin', mobile);

// let currentRecipient = null;

// // Update user list
// socket.on('updateUserList', (users) => {
//     const onlineUsersDiv = document.getElementById('online-users');
//     onlineUsersDiv.innerHTML = '';
//     users.forEach(user => {
//         const userElement = document.createElement('p');
//         userElement.textContent = `${user.mobile} - ${user.status}`;
//         userElement.onclick = () => {
//             currentRecipient = user.mobile;
//             document.getElementById('recipient-mobile').value = user.mobile;
//             document.getElementById('chat-box').innerHTML = ''; 
//         };
//         onlineUsersDiv.appendChild(userElement);
//     });
// });

// // Receive chat message from server
// socket.on('chatMessage', (data) => {
//     if (data.from === currentRecipient || data.to === currentRecipient) {
//         const chatBox = document.getElementById('chat-box');
//         const messageElement = document.createElement('p');
//         messageElement.textContent = `${data.from}: ${data.message}`;
//         chatBox.appendChild(messageElement);
//         chatBox.scrollTop = chatBox.scrollHeight;
//     }
// });

// // Send chat message to server
// document.getElementById('chat-form').addEventListener('submit', (e) => {
//     e.preventDefault();
//     const msg = document.getElementById('msg').value;
//     const recipientMobile = document.getElementById('recipient-mobile').value;
//     if (recipientMobile) {
//         socket.emit('chatMessage', { recipientMobile, message: msg, from: mobile });
//         const chatBox = document.getElementById('chat-box');
//         const messageElement = document.createElement('p');
//         messageElement.textContent = `You: ${msg}`;
//         chatBox.appendChild(messageElement);
//         chatBox.scrollTop = chatBox.scrollHeight;
//         document.getElementById('msg').value = '';
//     } else {
//         alert('Please select a user to chat with.');
//     }
// });
// }