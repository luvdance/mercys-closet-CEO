// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// IMPORTANT: These variables (firebaseConfig, appId) are now expected to be
// defined globally in your HTML <script> tag BEFORE this module is loaded.
// This ensures the correct configuration is used when deployed to Firebase Hosting.

// Initialize Firebase app
// Ensure firebaseConfig is accessible globally from the HTML
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get Auth instance
const storage = getStorage(app); // Get Storage instance
const db = getFirestore(app); // Get Firestore instance

// --- DOM Elements ---
const loginSection = document.getElementById('loginSection');
const uploadSection = document.getElementById('uploadSection');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');

const uploadForm = document.getElementById('uploadForm');
const productImageInput = document.getElementById('productImage');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const productNameInput = document.getElementById('productName');
const productCategorySelect = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice'); // ADDED: Price input element
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const uploadSpinner = document.getElementById('uploadSpinner');

// --- Helper Functions for UI Messages ---

/**
 * Displays a message in the specified message element.
 * @param {HTMLElement} element The HTML element to display the message in.
 * @param {string} message The message text.
 * @param {string} type Bootstrap alert type (e.g., 'success', 'danger', 'info').
 */
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `alert mt-3 ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
    element.classList.remove('d-none');
}

/**
 * Hides the specified message element.
 * @param {HTMLElement} element The HTML element to hide.
 */
function hideMessage(element) {
    element.classList.add('d-none');
}

/**
 * Shows the loading spinner and disables the upload button.
 */
function showSpinner() {
    uploadSpinner.classList.remove('d-none');
    uploadBtn.disabled = true;
}

/**
 * Hides the loading spinner and enables the upload button.
 */
function hideSpinner() {
    uploadSpinner.classList.add('d-none');
    uploadBtn.disabled = false;
}

// --- Authentication Logic ---

/**
 * Handles user login with email and password.
 * @param {Event} e The form submission event.
 */
async function handleLogin(e) {
    e.preventDefault();
    hideMessage(loginMessage); // Clear previous messages

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        // Attempt to sign in with email and password
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged listener will handle UI update on successful login
        showMessage(loginMessage, 'Login successful!', 'success');
        loginForm.reset(); // Clear form fields
    } catch (error) {
        console.error("Login error:", error.code, error.message);
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No user found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Too many failed login attempts. Please try again later.";
        }
        showMessage(loginMessage, errorMessage, 'danger');
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // onAuthStateChanged listener will handle UI update on successful logout
        showMessage(loginMessage, 'Logged out successfully.', 'info');
    } catch (error) {
        console.error("Logout error:", error.message);
        showMessage(loginMessage, 'Failed to log out.', 'danger');
    }
}

// --- Product Upload Logic ---

/**
 * Handles product image preview.
 */
function handleImagePreview() {
    imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>'; // Clear previous preview
    const file = productImageInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreviewContainer.innerHTML = `<img src="${e.target.result}" class="img-fluid rounded shadow-sm mt-2" alt="Product Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Handles product upload to Firebase Storage and Firestore.
 * @param {Event} e The form submission event.
 */
async function handleUpload(e) {
    e.preventDefault();
    hideMessage(uploadMessage); // Clear previous messages
    showSpinner(); // Show loading spinner

    const imageFile = productImageInput.files[0];
    const productName = productNameInput.value;
    const productCategory = productCategorySelect.value;
    const productPrice = parseFloat(productPriceInput.value); // ADDED: Get price and convert to number

    if (!imageFile || !productName || !productCategory || isNaN(productPrice) || productPrice <= 0) { // MODIFIED: Added price validation
        showMessage(uploadMessage, 'Please fill in all fields, select an image, and provide a valid price (must be a number greater than 0).', 'danger');
        hideSpinner();
        return;
    }

    try {
        // 1. Upload image to Firebase Storage
        // Use the globally available 'appId' from the HTML
        const storageRef = ref(storage, `artifacts/${appId}/public/images/${productCategory}/${imageFile.name}`);
        const uploadTask = await uploadBytes(storageRef, imageFile);
        const imageUrl = await getDownloadURL(uploadTask.ref);

        console.log("Image uploaded to Storage:", imageUrl);

        // 2. Save product data to Firestore
        // Use the globally available 'appId' from the HTML
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        await addDoc(productsCollectionRef, {
            name: productName,
            category: productCategory,
            imageUrl: imageUrl,
            price: productPrice, // ADDED: Save the price
            currency: "NGN", // ADDED: Explicitly state currency as Naira
            timestamp: serverTimestamp() // Add a server-generated timestamp
        });

        showMessage(uploadMessage, 'Product uploaded successfully!', 'success');
        uploadForm.reset(); // Clear form fields
        imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>'; // Clear image preview
        console.log("Product data saved to Firestore.");

    } catch (error) {
        console.error("Upload error:", error);
        showMessage(uploadMessage, `Failed to upload product: ${error.message}`, 'danger');
    } finally {
        hideSpinner(); // Hide spinner regardless of success or failure
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged listener: determines which section to show (login or upload)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            loginSection.classList.add('d-none');
            uploadSection.classList.remove('d-none');
            hideMessage(loginMessage); // Hide any login error messages
            console.log("User is logged in:", user.email);
        } else {
            // User is signed out
            loginSection.classList.remove('d-none');
            uploadSection.classList.add('d-none');
            console.log("User is logged out.");
        }
    });

    // Attach form submission and button click listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.warn("Login form with ID 'loginForm' not found.");
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    } else {
        console.warn("Logout button with ID 'logoutBtn' not found.");
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    } else {
        console.warn("Upload form with ID 'uploadForm' not found.");
    }

    if (productImageInput) {
        productImageInput.addEventListener('change', handleImagePreview);
    } else {
        console.warn("Product image input with ID 'productImage' not found.");
    }
    
    // ADDED: Check for productPriceInput, though it's not strictly necessary to attach a listener
    // unless you want real-time validation or formatting as the user types.
    if (!productPriceInput) {
        console.warn("Product price input with ID 'productPrice' not found.");
    }

    // Hide spinner initially
    hideSpinner();
});
