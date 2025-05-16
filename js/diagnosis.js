import { generateGradCAM, initGradCAM } from './gradcam.js';

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyB8B1ZKOK6T0JIehHCrXB8oi_NGOWs2VHk",
    authDomain: "skin-disease-3cbf9.firebaseapp.com",
    projectId: "skin-disease-3cbf9",
    storageBucket: "skin-disease-3cbf9.appspot.com",
    messagingSenderId: "117215400065",
    appId: "1:117215400065:web:4975b24971af7a37fc3d80"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Debug mode
const DEBUG_MODE = true;

document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const imageUpload = document.getElementById('image-upload');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const removeImageBtn = document.getElementById('remove-image');
    const diagnoseBtn = document.getElementById('diagnose-btn');
    const resultsSection = document.getElementById('results-section');
    const originalImage = document.getElementById('original-image');
    const gradcamImage = document.getElementById('gradcam-image');
    const topDiagnosis = document.getElementById('top-diagnosis');
    const otherDiagnoses = document.getElementById('other-diagnoses');
    const recommendations = document.getElementById('recommendations');
    const loadingModal = document.getElementById('loading-modal');
    const generateReportBtn = document.getElementById('generate-report');
    const newDiagnosisBtn = document.getElementById('new-diagnosis');
    const logoutBtn = document.getElementById('logout-btn');
    const historyBtn = document.getElementById('history-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const cameraModal = document.getElementById('camera-modal');
    const cameraFeed = document.getElementById('camera-feed');
    const captureBtn = document.getElementById('capture-btn');
    const closeCamera = document.querySelector('.close-camera');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');
    let stream = null;

    // Initialize GradCAM
    initGradCAM();

    // Event Listeners
    uploadArea.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', resetImageUpload);
    diagnoseBtn.addEventListener('click', startDiagnosis);
    generateReportBtn.addEventListener('click', generatePDFReport);
    newDiagnosisBtn.addEventListener('click', resetDiagnosis);
    logoutBtn.addEventListener('click', logoutUser);
    historyBtn.addEventListener('click', () => window.location.href = 'history.html');
    cameraBtn.addEventListener('click', startCamera);
    uploadBtn.addEventListener('click', () => imageUpload.click());
    closeCamera.addEventListener('click', stopCamera);
    captureBtn.addEventListener('click', capturePhoto);
    cancelCameraBtn.addEventListener('click', stopCamera);
    closeCamera.addEventListener('click', stopCamera);

    // Drag and Drop Handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            imageUpload.files = e.dataTransfer.files;
            handleImageUpload({ target: imageUpload });
        }
    });

    // Functions
    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.match('image.*')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImage.src = e.target.result;
                originalImage.src = e.target.result;
                previewContainer.style.display = 'block';
                uploadArea.style.display = 'none';
                diagnoseBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }
    }

    async function startDiagnosis() {
        // In diagnosis.js (inside startDiagnosis())
        diagnoseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        const symptoms = {
            itching: document.getElementById('itching').checked,
            bleeding: document.getElementById('bleeding').checked,
            scaly_skin: document.getElementById('scaly_skin').checked,
            white_patches: document.getElementById('white_patches').checked,
            sudden_onset: document.getElementById('sudden_onset').checked
        };

        const file = imageUpload.files[0];
        if (!file) return alert("Please upload an image.");

        loadingModal.style.display = 'flex';

        try {
            const formData = new FormData();
            formData.append("image", file);
            Object.entries(symptoms).forEach(([key, value]) => {
                formData.append(key, value ? '1' : '0');
            });

            const response = await fetch("http://127.0.0.1:5000/predict", {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            if (!result.success) throw new Error(result.error || "API error");

            const predictions = {};
            result.predictions.forEach(pred => {
                predictions[pred.name] = pred.prob;
            });

            await displayResults(predictions);
            await saveDiagnosisToHistory(predictions);

        } catch (error) {
            console.error("Diagnosis failed:", error);
            alert("Diagnosis failed. Please try again.");
        } finally {
            loadingModal.style.display = 'none';
        }
    }

    async function saveDiagnosisToHistory(diagnosis) {
        if (DEBUG_MODE) console.group("[DEBUG] Saving Diagnosis History");

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            if (DEBUG_MODE) {
                console.log("User ID:", user.uid);
                console.log("Diagnosis data:", diagnosis);
            }

            const diagnosisData = {
                date: firebase.firestore.FieldValue.serverTimestamp(),
                imageUrl: previewImage.src,
                results: diagnosis,
                symptoms: {
                    itching: document.getElementById('itching').checked,
                    bleeding: document.getElementById('bleeding').checked,
                    scaly_skin: document.getElementById('scaly_skin').checked,
                    white_patches: document.getElementById('white_patches').checked,
                    sudden_onset: document.getElementById('sudden_onset').checked
                },
                userId: user.uid,
                patientName: user.displayName || 'Anonymous'
            };

            // Save to both collections for redundancy
            const docRef = await db.collection('diagnoses').add(diagnosisData);
            await db.collection('users').doc(user.uid).collection('diagnoses').doc(docRef.id).set(diagnosisData);

            if (DEBUG_MODE) {
                console.log("Successfully saved diagnosis with ID:", docRef.id);
                console.groupEnd();
            }
            return true;
        } catch (error) {
            console.error("Error saving diagnosis:", error);
            if (DEBUG_MODE) {
                console.groupEnd();
                alert(`Save failed: ${error.message}`);
            }
            return false;
        }
    }

    async function displayResults(results) {
        const resultsArray = Object.entries(results)
            .map(([name, prob]) => ({ name, prob }))
            .sort((a, b) => b.prob - a.prob);

        const topResult = resultsArray[0];
        const topProbPercent = (topResult.prob * 100).toFixed(1);

        // Update top diagnosis with confidence meter
        topDiagnosis.querySelector('.diagnosis-name').textContent = topResult.name;
        topDiagnosis.querySelector('.diagnosis-probability').textContent = `${topProbPercent}%`;
        topDiagnosis.querySelector('.confidence-bar').style.width = `${topProbPercent}%`;

        await generateGradCAM(previewImage, gradcamImage, topResult.name);

        // Clear and rebuild other diagnoses with confidence meters
        otherDiagnoses.innerHTML = '';
        for (let i = 1; i < Math.min(4, resultsArray.length); i++) {
            const result = resultsArray[i];
            const probPercent = (result.prob * 100).toFixed(1);

            const diagnosisItem = document.createElement('div');
            diagnosisItem.className = 'diagnosis-item';
            diagnosisItem.innerHTML = `
            <div class="diagnosis-name">${result.name}</div>
            <div class="diagnosis-probability">${probPercent}%</div>
            <div class="confidence-meter">
                <div class="confidence-bar" style="width: ${probPercent}%"></div>
            </div>
        `;
            otherDiagnoses.appendChild(diagnosisItem);
        }

        // Show recommendations and enable "Ask Doctor" button
        displayRecommendations(topResult.name);
        document.getElementById('ask-doctor').style.display = 'block';

        // Show results section
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Show success message
        showToast(`Diagnosis complete! Found ${topResult.name} with ${topProbPercent}% confidence`);
    }

    // Helper function for toast notifications
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => document.body.removeChild(toast), 300);
            }, 3000);
        }, 100);
    }

    function displayRecommendations(diagnosis) {
        const recommendationMap = {
            'Acne': [
                'Use gentle, non-comedogenic skincare products',
                'Avoid picking or squeezing pimples',
                'Consider benzoyl peroxide or salicylic acid treatments',
                'Consult a dermatologist for severe cases'
            ],
            'Eczema': [
                'Moisturize regularly with fragrance-free creams',
                'Avoid harsh soaps and known allergens',
                'Use mild laundry detergents',
                'See a dermatologist for prescription treatments'
            ],
            'Psoriasis': [
                'Use thick creams or ointments to moisturize',
                'Get moderate sunlight exposure (avoid sunburn)',
                'Reduce stress through relaxation techniques',
                'Consult a dermatologist for treatment options'
            ],
            'Vitiligo': [
                'Use sun protection on depigmented areas',
                'Consider cosmetic cover-ups if desired',
                'Consult a dermatologist about treatment options',
                'Join a support group if needed'
            ],
            'default': [
                'Keep the affected area clean and dry',
                'Avoid scratching or irritating the area',
                'Monitor for changes in size or appearance',
                'Consult a dermatologist for proper diagnosis'
            ]
        };

        const recs = recommendationMap[diagnosis] || recommendationMap['default'];
        recommendations.innerHTML = `
            <ul>
                ${recs.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        `;
    }

    async function generatePDFReport() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            // Fetch user details
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const patientName = userData?.fullName || user.displayName || 'Patient';

            // Document setup
            doc.setProperties({
                title: 'DermaScan Diagnosis Report',
                subject: 'Skin Disease Diagnosis Results',
                author: 'DermaScan AI'
            });

            // Add header
            doc.setFontSize(20);
            doc.setTextColor(33, 150, 243);
            doc.setFont('helvetica', 'bold');
            doc.text('DERMASCAN AI DIAGNOSIS REPORT', 105, 20, { align: 'center' });

            // Patient information
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Patient Information:', 15, 35);
            doc.setFont('helvetica', 'normal');
            doc.text(`Name: ${patientName}`, 15, 45);
            doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 15, 55);

            // Diagnosis results section
            doc.setFontSize(16);
            doc.setTextColor(33, 150, 243);
            doc.setFont('helvetica', 'bold');
            doc.text('Diagnosis Results', 15, 75);

            const topDiag = topDiagnosis.querySelector('.diagnosis-name').textContent;
            const topProb = topDiagnosis.querySelector('.diagnosis-probability').textContent;

            // Primary Diagnosis - Now on separate lines
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Primary Diagnosis:', 20, 90);  // Label on line 1
            doc.setFont('helvetica', 'bold');
            doc.text(`${topDiag} (${topProb})`, 20, 100);  // Value on line 2 (10 units below)

            // Other diagnoses
            doc.setFont('helvetica', 'normal');
            doc.text('Other Possible Conditions:', 20, 115);

            const otherItems = otherDiagnoses.querySelectorAll('.diagnosis-item');
            let yPos = 125; // Starting Y position for other diagnoses
            otherItems.forEach((item) => {
                const name = item.querySelector('.diagnosis-name').textContent;
                const prob = item.querySelector('.diagnosis-probability').textContent;
                doc.text(`• ${name}: ${prob}`, 25, yPos);
                yPos += 7; // Increment Y position
            });

            // Recommendations
            doc.setFontSize(16);
            doc.setTextColor(33, 150, 243);
            doc.setFont('helvetica', 'bold');
            doc.text('Medical Recommendations', 15, yPos + 15);

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            const recItems = recommendations.querySelectorAll('li');
            yPos += 25; // Adjust Y position for recommendations
            recItems.forEach((item) => {
                doc.text(`✓ ${item.textContent}`, 20, yPos);
                yPos += 7;
            });

            // Footer
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('This report is generated by DermaScan AI and should be reviewed by a healthcare professional.',
                105, 280, { align: 'center' });
            doc.text('Confidential Patient Report - © 2025 DermaScan AI', 105, 285, { align: 'center' });

            // Save PDF
            const fileName = `DermaScan_${patientName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            alert('✅ Report downloaded!');

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Error generating report. Please try again.");
        }
    }

    // Camera functions
    async function startCamera() {
        try {
            cameraModal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent scrolling

            // Reset camera feed first
            cameraFeed.srcObject = null;

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            cameraFeed.srcObject = stream;

            // Add keyboard escape handler
            document.addEventListener('keydown', handleEscapeKey);
        } catch (err) {
            console.error("Camera error:", err);
            alert("Camera access denied. Please check permissions.");
            stopCamera();
        }
    }

    function stopCamera() {
        document.removeEventListener('keydown', handleEscapeKey);

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        cameraFeed.srcObject = null;
    }

    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            stopCamera();
        }
    }

    // Update your close button event listener
    closeCamera.addEventListener('click', stopCamera);

    function capturePhoto() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

        // Convert to blob and create file object
        canvas.toBlob((blob) => {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            imageUpload.files = dataTransfer.files;

            // Display preview
            previewImage.src = URL.createObjectURL(blob);
            originalImage.src = URL.createObjectURL(blob);
            previewContainer.style.display = 'block';
            uploadArea.style.display = 'none';
            diagnoseBtn.disabled = false;

            stopCamera();
        }, 'image/jpeg', 0.9);
    }

    function resetDiagnosis() {
        previewContainer.style.display = 'none';
        uploadArea.style.display = 'flex';
        resultsSection.style.display = 'none';
        diagnoseBtn.disabled = true;
        imageUpload.value = '';
        document.querySelectorAll('.symptom-checkbox input').forEach(cb => cb.checked = false);
    }

    function resetImageUpload() {
        previewContainer.style.display = 'none';
        uploadArea.style.display = 'flex';
        diagnoseBtn.disabled = true;
        imageUpload.value = '';
    }

    function logoutUser() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        }).catch(error => {
            console.error('Logout error:', error);
        });
    }
});