const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const multer = require('multer');
const fs = require('fs');

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Set up multer for handling file uploads
const upload = multer({ dest: 'public/uploads/' });

let waitingUser = null;
const otps = new Map();

// Route for the login page
app.get('/', (req, res) => {
    res.render('login');
});

// Route for the chat page
app.get('/chat', (req, res) => {
    res.render('chat');
});

// Route to generate OTP
app.post('/generate-otp', (req, res) => {
    const { phoneNumber } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000);
    otps.set(phoneNumber, otp.toString());
    
    // In a real application, you would send this OTP via SMS
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    
    res.json({ success: true, message: 'OTP sent successfully' });
});

// Route to verify OTP
app.post('/verify-otp', (req, res) => {
    const { phoneNumber, otp } = req.body;
    const storedOTP = otps.get(phoneNumber);
    
    if (storedOTP && storedOTP === otp) {
        otps.delete(phoneNumber);
        res.json({ success: true, message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

io.on('connection', (socket) => {
    socket.on('user login', (username) => {
        if (waitingUser) {
            // Pair the waiting user with the new user
            socket.join(waitingUser.room);
            socket.to(waitingUser.room).emit('chat start', username);
            socket.emit('chat start', waitingUser.username);
            waitingUser = null;
        } else {
            // Set this user as the waiting user
            const room = `room_${Date.now()}`;
            socket.join(room);
            waitingUser = { username, room, socket };
            socket.emit('waiting');
        }
    });

    socket.on('chat message', (msg) => {
        socket.to(Array.from(socket.rooms)[1]).emit('chat message', msg);
    });

    socket.on('image message', (data) => {
        socket.to(Array.from(socket.rooms)[1]).emit('image message', data);
    });

    socket.on('disconnect', () => {
        if (waitingUser && waitingUser.socket === socket) {
            waitingUser = null;
        } else {
            socket.to(Array.from(socket.rooms)[1]).emit('user disconnected');
        }
    });
});

// Handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ success: true, filePath });
    } else {
        res.status(400).json({ success: false, message: 'No file uploaded' });
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.log('Uncaught Exception:', error);
});
