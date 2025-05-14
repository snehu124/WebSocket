const socketIO = require('socket.io');
const connection = require('../config/database');
const path = require('path');

module.exports = (io) => {
    const onlineUsers = {};

    io.on('connection', (socket) => {
        console.log('A user connected');

        socket.on('userLogin', (mobile) => {
            onlineUsers[mobile] = socket.id;
            io.emit('userStatusChange', { mobile, status: 'Online' });
            const sql = `
            SELECT u.mobile,CONCAT(first_name, ' ', last_name ) AS name, MAX(lt.login_time) AS lastOnlineTime,
                   (SELECT COUNT(*) FROM messages WHERE recipient_mobile = u.mobile AND read_status = 0) AS unreadCount
            FROM registration u
            LEFT JOIN login_times lt ON u.mobile = lt.mobile
            GROUP BY u.mobile, u.first_name, u.last_name;
        `;


            connection.query(sql, (err, results) => {
                if (err) {
                    console.error('Error fetching user list:', err);
                    return;
                }


                const users = results.map(row => ({
                    mobile: row.mobile,
                    name: `${row.name}`,
                    lastOnlineTime: row.lastOnlineTime ? new Date(row.lastOnlineTime).toLocaleString() : 'Never',
                    status: onlineUsers[row.mobile] ? 'Online' : 'Offline',
                    unreadCount: row.unreadCount || 0
                }));
                const unreadQuery =
                    `SELECT sender_mobile, COUNT(*) AS unreadCount
                    FROM messages
                    WHERE recipient_mobile = ? AND read_status = 0
                    GROUP BY sender_mobile
                ;`

                connection.query(unreadQuery, [mobile], (err, unreadResults) => {
                    if (err) {
                        console.error('Error fetching unread message counts:', err);
                        return;
                    }

                    const unreadCountMap = {};
                    unreadResults.forEach(unreadRow => {
                        unreadCountMap[unreadRow.sender_mobile] = unreadRow.unreadCount;
                    });

                    // Update unread counts in the users array
                    users.forEach(user => {
                        user.unreadCount = unreadCountMap[user.mobile] || 0;
                    });

                    io.to(socket.id).emit('updateUserList', users);
                });
            });
        });


        socket.on('incomingMessage', (message) => {
            const chatBox = document.getElementById('chat-box');
            const messageElement = document.createElement('p');
            messageElement.classList.add('message-new');
            const senderText = message.sender_mobile === userMobile ? 'You' : message.sender_mobile;
            messageElement.textContent = `${senderText}: ${message.message}`;
            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        socket.on('messageSent', (data) => {
            const sendingElement = document.querySelector('.sending');
            if (sendingElement) {
                sendingElement.classList.remove('sending');
                sendingElement.textContent = `You: ${data.message}`;
            }
        });

        socket.on('updateUserList', (users) => {
            const userListDiv = document.getElementById('user-list');
            userListDiv.innerHTML = '';
            users.forEach(user => {
                if (user.mobile === userMobile) return;

                const userElement = document.createElement('div');
                userElement.classList.add('user-item');
                userElement.setAttribute('data-mobile', user.mobile);
                userElement.innerHTML = `
                <div class="user-info">
                    <div class="name">${user.name}</div>
                    <div class="mobile">${user.mobile}</div>
                </div>
                <span class="status-indicator ${user.status === 'Online' ? 'online' : 'offline'}">
                    ${user.status === 'Online' ? '' : `Last online: ${user.lastOnlineTime}`}
                </span>
                ${user.unreadCount > 0 ? `<span class="unread-count">${user.unreadCount}</span>` : ''}
            `;

                userElement.onclick = () => {
                    document.getElementById('recipient-mobile').value = user.mobile;
                    socket.emit('selectChat', user.mobile);
                    fetchChatMessages(user.mobile);
                };

                userListDiv.appendChild(userElement);
            });
        });

        socket.on('messageRead', (data) => {
            // Notify the recipient's client that the message has been read
            const recipientSocketId = onlineUsers[data.senderMobile];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('messageReadNotification', data);
            }
        });
        socket.on('fetchContacts', (mobile, callback) => {
            const sql = `SELECT CONCAT(first_name, ' ', last_name ) AS name, mobile AS phone FROM registration WHERE mobile != ?`;

            connection.query(sql, [mobile], (err, results) => {
                if (err) {
                    console.error('Error fetching contacts:', err);
                    callback({ error: 'Unable to fetch contacts' });
                    return;
                }
                callback({ success: true, contacts: results });
            });
        });

        socket.on('selectChat', (recipientMobile) => {
            const user = {
                mobile: recipientMobile,
                name: '',
                status: onlineUsers[recipientMobile] ? 'Online' : 'Offline',
                lastOnlineTime: ''
            };

            const sql =
                `SELECT r.mobile, CONCAT(r.first_name, ' ', r.last_name) AS name, MAX(lt.login_time) AS lastOnlineTime
                FROM registration r
                LEFT JOIN login_times lt ON r.mobile = lt.mobile
                WHERE r.mobile = ?
                GROUP BY r.mobile, r.first_name, r.last_name`
                ;
            connection.query(sql, [recipientMobile], (err, results) => {
                if (err) {
                    console.error('Error fetching user details:', err);
                    return;
                }

                if (results.length > 0) {
                    const row = results[0];
                    user.name = row.name;
                    user.lastOnlineTime = row.lastOnlineTime ? new Date(row.lastOnlineTime).toLocaleString() : 'Never';
                }

                socket.emit('userDetails', user);
            });
        });

        socket.on('fetchMessages', ({ senderMobile, recipientMobile }) => {
            const sql = `
            SELECT m.sender_mobile, m.recipient_mobile, m.message, m.attachment, m.read_status, m.timestamp,
                   CONCAT(r1.first_name, ' ', r1.last_name) AS sender_name, 
                   CONCAT(r2.first_name, ' ', r2.last_name) AS recipient_name
            FROM messages m
                JOIN registration r1 ON m.sender_mobile = r1.mobile
                JOIN registration r2 ON m.recipient_mobile = r2.mobile
                WHERE ((m.sender_mobile = ? AND m.recipient_mobile = ?) 
                    OR (m.sender_mobile = ? AND m.recipient_mobile = ?))
                  AND (m.deleted_for IS NULL OR m.deleted_for != ?)
                ORDER BY m.timestamp ASC
            `;

            connection.query(sql, [senderMobile, recipientMobile, recipientMobile, senderMobile, senderMobile], (err, results) => {
                if (err) {
                    console.error('Error fetching messages:', err);
                    return;
                }
                // Mark messages as read
                const updateSql = `
                    UPDATE messages 
                    SET read_status = 1 
                    WHERE sender_mobile = ? AND recipient_mobile = ? AND read_status = 0
                `;

                connection.query(updateSql, [recipientMobile, senderMobile], (err) => {
                    if (err) {
                        console.error('Error updating read status:', err);
                    }
                });

                socket.emit('chatMessages', results.map(row => ({
                    sender_mobile: row.sender_mobile,
                    recipient_mobile: row.recipient_mobile,
                    message: row.message,
                    attachment: JSON.parse(row.attachment),
                    read_status: row.read_status,
                    sender_name: row.sender_name,
                    recipient_name: row.recipient_name,
                    timestamp: row.timestamp
                })));

                if (onlineUsers[senderMobile]) {
                    io.to(onlineUsers[senderMobile]).emit('messageRead', { senderMobile: recipientMobile });
                }
            });
        });

        socket.on('pollVote', ({ question, selectedOption, senderMobile, recipientMobile }) => {
            if (!recipientMobile) {
                console.error('Recipient mobile is missing.');
                return;
            }

            const sqlCheckPoll = `
                SELECT id, attachment
                FROM messages
                WHERE ((sender_mobile = ? AND recipient_mobile = ?) OR (sender_mobile = ? AND recipient_mobile = ?))
                AND JSON_EXTRACT(attachment, '$.type') = 'poll'
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            connection.query(sqlCheckPoll, [senderMobile, recipientMobile, recipientMobile, senderMobile], (err, results) => {
                if (err || results.length === 0) {
                    console.error('Poll not found:', err);
                    return;
                }

                const pollId = results[0].id;
                const attachment = JSON.parse(results[0].attachment);
                if (!attachment.voters) {
                    attachment.voters = {};
                }
                // Ensure the votes array is initialized
                if (!Array.isArray(attachment.votes)) {
                    attachment.votes = Array(attachment.options.length).fill(0);
                }

                // Validate the selectedOption index
                if (selectedOption < 0 || selectedOption >= attachment.votes.length) {
                    console.error('Invalid selectedOption index:', selectedOption);
                    return;
                }

                // Check if the user has already voted
                if (attachment.voters && attachment.voters[senderMobile] !== undefined) {
                    const previousOption = attachment.voters[senderMobile];
                    attachment.votes[previousOption]--; // Decrement the previous vote
                }

                // Update the user's vote
                attachment.voters = attachment.voters || {};
                attachment.voters[senderMobile] = selectedOption;
                attachment.votes[selectedOption]++; // Increment the new vote

                // Update the poll data in the database
                const updatedAttachment = JSON.stringify(attachment);
                const sqlUpdatePoll = `
                    UPDATE messages
                    SET attachment = ?
                    WHERE id = ?
                `;

                connection.query(sqlUpdatePoll, [updatedAttachment, pollId], (err) => {
                    if (err) {
                        console.error('Error updating poll data:', err);
                        return;
                    }

                    // Notify both sender and receiver about the updated poll
                    const senderSocketId = onlineUsers[senderMobile];
                    const recipientSocketId = onlineUsers[recipientMobile];

                    if (senderSocketId) {
                        io.to(senderSocketId).emit('pollUpdated', { senderMobile, recipientMobile, pollData: attachment });
                    }

                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('pollUpdated', { senderMobile, recipientMobile, pollData: attachment });
                    }
                });
            });
        });

        socket.on('chatMessage', (data) => {
            const recipientSocketId = onlineUsers[data.recipientMobile];

            const sql = 'INSERT INTO messages (sender_mobile, recipient_mobile, message, attachment, read_status, timestamp) VALUES (?, ?, ?, ?, 0, NOW())';
            connection.query(sql, [data.senderMobile, data.recipientMobile, data.message || '', JSON.stringify(data.attachment)], (err) => {
                if (err) {
                    console.error('Error inserting message into database:', err);
                }


                // Fetch sender's name
                const nameSql = `SELECT CONCAT(first_name, ' ', last_name) AS name FROM registration WHERE mobile = ?`;
                connection.query(nameSql, [data.senderMobile], (err, userResults) => {
                    if (err) {
                        console.error('Error fetching sender name:', err);
                        return;
                    }

                    const senderName = userResults[0]?.name || data.senderMobile;
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('incomingMessage', {
                            ...data,
                            sender_name: senderName, // Include sender's name
                            timestamp: new Date().toISOString()
                        });

                        const unreadQuery =
                            `SELECT COUNT(*) AS unreadCount FROM messages 
                        WHERE recipient_mobile = ? AND sender_mobile = ? AND read_status = 0`
                            ;
                        connection.query(unreadQuery, [data.recipientMobile, data.senderMobile], (err, result) => {
                            if (err) {
                                console.error('Error fetching unread count:', err);
                                return;
                            }

                            io.to(recipientSocketId).emit('unreadMessagesCount', {
                                senderMobile: data.senderMobile,
                                unreadCount: result[0].unreadCount
                            });
                        });
                    }
                });
            });
            socket.emit('messageSent', data);
        });

        socket.on('incomingMessage', (message) => {
            const chatBox = document.getElementById('chat-box');
            const messageElement = document.createElement('p');
            messageElement.classList.add('message-new');

            // Fetch sender's name based on mobile number
            const nameSql = `SELECT CONCAT(first_name, ' ', last_name ) AS name FROM registration WHERE mobile = ?`;
            connection.query(nameSql, [message.sender_mobile], (err, userResults) => {
                if (err) {
                    console.error('Error fetching sender name:', err);
                    return;
                }

                const sendername = userResults[0]?.name || message.sender_mobile;
                const senderText = message.sender_mobile === userMobile ? 'You' : sendername;

                messageElement.textContent = `${senderText}: ${message.message}`;
                chatBox.appendChild(messageElement);
                chatBox.scrollTop = chatBox.scrollHeight;

                if (message.sender_mobile !== userMobile && message.sender_mobile !== document.getElementById('recipient-mobile').value) {
                    socket.emit('increaseUnreadCount', { senderMobile: message.sender_mobile });
                    console.log({ senderMobile: message.sender_mobile }, "receiving mobile number");
                }
            });
        });

        socket.on('increaseUnreadCount', (data) => {
            const userMobile = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
            if (!userMobile) {
                console.error('User mobile not found for the current socket.');
                return;
            }

            const sql =
                `SELECT COUNT(*) AS unreadCount FROM messages 
                WHERE sender_mobile = ? AND recipient_mobile = ? AND read_status = 0`
                ;
            connection.query(sql, [data.senderMobile, userMobile], (err, results) => {
                if (err) {
                    console.error('Error fetching unread count:', err);
                    return;
                }

                const recipientSocketId = onlineUsers[userMobile];
                if (recipientSocketId) {
                    console.log(data.senderMobile, "senderMobile");
                    console.log(sendername, "sendername");
                    console.log(results[0].unreadCount, "unreadCount");

                    // Fetch name of the sender
                    const nameSql = `SELECT CONCAT(first_name, ' ', last_name ) AS name FROM registration WHERE mobile = ?`;
                    connection.query(nameSql, [data.senderMobile], (err, userResults) => {
                        if (err) {
                            console.error('Error fetching sender name:', err);
                            return;
                        }

                        const sendername = userResults[0]?.name || data.senderMobile; // Fallback to mobile if name not found

                        io.to(recipientSocketId).emit('unreadMessagesCount', {
                            senderMobile: data.senderMobile,
                            sendername: sendername,
                            unreadCount: results[0].unreadCount
                        });
                    });
                }
            });
        });


        socket.on('clearChat', ({ senderMobile, recipientMobile }) => {
            const checkSql = `
                SELECT id, deleted_for 
                FROM messages 
                WHERE (sender_mobile = ? AND recipient_mobile = ?) 
                   OR (sender_mobile = ? AND recipient_mobile = ?)
            `;

            connection.query(checkSql, [senderMobile, recipientMobile, recipientMobile, senderMobile], (err, results) => {
                if (err) {
                    console.error('Error checking chat deletion status:', err);
                    return;
                }

                const deleteIds = [];
                const updateIds = [];

                results.forEach(row => {
                    if (row.deleted_for === null) {
                        // Mark as deleted for the current user
                        updateIds.push(row.id);
                    } else if (row.deleted_for !== senderMobile) {
                        // If already deleted for the other user, mark for permanent deletion
                        deleteIds.push(row.id);
                    }
                });

                if (updateIds.length > 0) {
                    const updateSql = `
                        UPDATE messages 
                        SET deleted_for = ? 
                        WHERE id IN (?)
                    `;
                    connection.query(updateSql, [senderMobile, updateIds], (err) => {
                        if (err) {
                            console.error('Error marking chat messages as deleted:', err);
                        }
                    });
                }

                if (deleteIds.length > 0) {
                    const deleteSql = `
                        DELETE FROM messages 
                        WHERE id IN (?)
                    `;
                    connection.query(deleteSql, [deleteIds], (err) => {
                        if (err) {
                            console.error('Error deleting chat messages:', err);
                        }
                    });
                }

                // Notify the sender to clear their chat view
                io.to(onlineUsers[senderMobile]).emit('chatMessages', []);
            });
        });
        // Handle logout and update logout_time
        socket.on('logout', (mobile) => {
            if (onlineUsers[mobile]) {
                delete onlineUsers[mobile];
                const updateLastOnlineTimeSql = 'UPDATE login_times SET logout_time = NOW() WHERE mobile = ?';
                connection.query(updateLastOnlineTimeSql, [mobile], (err) => {
                    if (err) {
                        console.error('Error updating last online time:', err);
                    }
                });
            }
        });

        socket.on('disconnect', () => {
            const userMobile = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
            if (userMobile) {

                delete onlineUsers[userMobile];
                io.emit('userStatusChange', { mobile: userMobile, status: 'Offline' });
            }
        });
    });
};
