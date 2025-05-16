// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB8B1ZKOK6T0JIehHCrXB8oi_NGOWs2VHk",
    authDomain: "skin-disease-3cbf9.firebaseapp.com",
    projectId: "skin-disease-3cbf9",
    storageBucket: "skin-disease-3cbf9.firebasestorage.app",
    messagingSenderId: "117215400065",
    appId: "1:117215400065:web:4975b24971af7a37fc3d80"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Toggle between login and signup forms
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// Login function
loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginError.textContent = '';
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Update last login timestamp
            return db.collection('users').doc(userCredential.user.uid).set({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        })
        .then(() => {
            window.location.href = 'diagnosis.html';
        })
        .catch((error) => {
            loginError.textContent = error.message;
        });
});

// Updated Signup function with proper name handling
signupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    signupError.textContent = '';
    
    if (password !== confirmPassword) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    if (!name) {
        signupError.textContent = 'Please enter your full name';
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Update user profile with display name
            return userCredential.user.updateProfile({
                displayName: name
            }).then(() => {
                // Create user document with additional details
                return db.collection('users').doc(userCredential.user.uid).set({
                    fullName: name,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: userCredential.user.uid
                }, { merge: true });
            });
        })
        .then(() => {
            window.location.href = 'diagnosis.html';
        })
        .catch((error) => {
            signupError.textContent = error.message;
        });
});

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        if (window.location.pathname.includes('index.html')) {
            window.location.href = 'diagnosis.html';
        }
    } else {
        // User is signed out
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
});