const socket = io('/');
const videoContainer = document.getElementById('video-container');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
    host: '/',
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs'
});

const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

let videoEnabled = false;
const videoChatBtn = document.getElementById('video-chat-btn');
const closeVideoBtn = document.getElementById('close-video-btn');
const waitingMessage = document.getElementById('waiting-message');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

form.style.display = 'none';

videoChatBtn.addEventListener('click', () => {
    if (!videoEnabled) {
        startVideoChat();
        videoChatBtn.style.display = 'none';
        closeVideoBtn.style.display = 'block';
        videoEnabled = true;
    }
});

closeVideoBtn.addEventListener('click', () => {
    endVideoChat();
    videoChatBtn.style.display = 'block';
    closeVideoBtn.style.display = 'none';
    videoEnabled = false;
});

function startVideoChat() {
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(stream => {
        addVideoStream(myVideo, stream);

        myPeer.on('call', call => {
            call.answer(stream);
            const video = document.createElement('video');
            call.on('stream', userVideoStream => {
                addVideoStream(video, userVideoStream);
            });
        });

        socket.on('user-connected', userId => {
            connectToNewUser(userId, stream);
        });
    }).catch(error => {
        console.error('Error accessing media devices:', error);
    });

    videoContainer.style.display = 'block';
}

function endVideoChat() {
    const videos = document.getElementsByTagName('video');
    for (let i = videos.length - 1; i >= 0; i--) {
        if (videos[i].srcObject) {
            videos[i].srcObject.getTracks().forEach(track => track.stop());
        }
        videos[i].remove();
    }
    videoContainer.style.display = 'none';
}

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
        video.remove();
    });

    peers[userId] = call;
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

const userId = Math.random().toString(36).substr(2, 9);

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        const message = { text: input.value, userId: userId };
        socket.emit('chat message', message);
        input.value = '';
    }
});

socket.on('chat message', (msg) => {
    const item = document.createElement('li');
    item.textContent = msg.text;
    item.className = msg.userId === userId ? 'sent' : 'received';
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

socket.on('start-chat', () => {
    waitingMessage.style.display = 'none';
    form.style.display = 'flex';
    videoChatBtn.style.display = 'block';
});

socket.on('user-disconnected', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
    }
});

myPeer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
});

myPeer.on('error', (error) => {
    console.error('PeerJS error:', error);
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Uncaught error:', error);
};
