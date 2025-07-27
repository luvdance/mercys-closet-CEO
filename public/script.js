// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// IMPORTANT: These variables (firebaseConfig, appId) are now expected to be
// defined globally in your HTML <script> tag BEFORE this module is loaded.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

// --- DOM Elements ---
const loginSection = document.getElementById('loginSection');
const uploadSection = document.getElementById('uploadSection');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');
const loginSpinner = document.getElementById('loginSpinner'); // New
const loginBtn = document.getElementById('loginBtn'); // New for disabling
const logoutBtn = document.getElementById('logoutBtn');

const uploadForm = document.getElementById('uploadForm');
const productImageInput = document.getElementById('productImage');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const productNameInput = document.getElementById('productName');
const productCategorySelect = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice'); // New
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const uploadSpinner = document.getElementById('uploadSpinner');
const uploadProgressContainer = document.getElementById('uploadProgressContainer'); // New
const uploadProgressBar = document.getElementById('uploadProgressBar'); // New
const uploadCancelBtn = document.getElementById('uploadCancelBtn'); // New

const uploadedProductsList = document.getElementById('uploadedProductsList'); // New
const productListSection = document.getElementById('productListSection'); // New

let currentUploadTask = null; // To hold the upload task for cancellation

// --- Helper Functions for UI Messages & Loaders ---

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `alert mt-3 ${type === 'success' ? 'alert-success' : type === 'info' ? 'alert-info' : 'alert-danger'}`;
    element.classList.remove('d-none');
}

function hideMessage(element) {
    element.classList.add('d-none');
}

function showSpinner(spinnerElement, buttonElement = null) {
    spinnerElement.classList.remove('d-none');
    if (buttonElement) {
        buttonElement.disabled = true;
    }
}

function hideSpinner(spinnerElement, buttonElement = null) {
    spinnerElement.classList.add('d-none');
    if (buttonElement) {
        buttonElement.disabled = false;
    }
}

function showUploadProgress() {
    uploadProgressContainer.classList.remove('d-none');
    uploadProgressBar.style.width = '0%';
    uploadProgressBar.setAttribute('aria-valuenow', 0);
    uploadProgressBar.textContent = '0%';
    uploadBtn.disabled = true; // Disable upload button during upload
    uploadCancelBtn.disabled = false; // Enable cancel button
}

function updateUploadProgress(percentage) {
    uploadProgressBar.style.width = `${percentage}%`;
    uploadProgressBar.setAttribute('aria-valuenow', percentage);
    uploadProgressBar.textContent = `${percentage}%`;
}

function hideUploadProgress() {
    uploadProgressContainer.classList.add('d-none');
    uploadBtn.disabled = false; // Re-enable upload button
    uploadCancelBtn.disabled = true; // Disable cancel button
}

// --- Authentication Logic ---

async function handleLogin(e) {
    e.preventDefault();
    hideMessage(loginMessage);
    showSpinner(loginSpinner, loginBtn);

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage(loginMessage, 'Login successful!', 'success');
        loginForm.reset();
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
    } finally {
        hideSpinner(loginSpinner, loginBtn);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showMessage(loginMessage, 'Logged out successfully.', 'info');
    } catch (error) {
        console.error("Logout error:", error.message);
        showMessage(loginMessage, 'Failed to log out.', 'danger');
    }
}

// --- Product Upload Logic ---

function handleImagePreview() {
    imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>';
    const file = productImageInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreviewContainer.innerHTML = `<img src="${e.target.result}" class="img-fluid rounded shadow-sm mt-2" alt="Product Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

async function handleUpload(e) {
    e.preventDefault();
    hideMessage(uploadMessage);
    showSpinner(uploadSpinner); // Show the general spinner initially
    showUploadProgress(); // Show progress bar and enable cancel

    const imageFile = productImageInput.files[0];
    const productName = productNameInput.value;
    const productCategory = productCategorySelect.value;
    const productPrice = parseFloat(productPriceInput.value); // New: Get price as number

    if (!imageFile || !productName || !productCategory || isNaN(productPrice) || productPrice <= 0) {
        showMessage(uploadMessage, 'Please fill in all fields, select an image, and enter a valid price.', 'danger');
        hideSpinner(uploadSpinner);
        hideUploadProgress();
        return;
    }

    try {
        // Generate a unique file name to prevent collisions
        const uniqueFileName = `${Date.now()}-${imageFile.name}`;
        const imagePath = `artifacts/${appId}/public/images/${productCategory}/${uniqueFileName}`;
        const storageRef = ref(storage, imagePath);

        // Use uploadBytesResumable for progress and cancellation
        currentUploadTask = uploadBytesResumable(storageRef, imageFile);

        currentUploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                updateUploadProgress(Math.round(progress));
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error("Upload progress error:", error);
                showMessage(uploadMessage, `Image upload failed: ${error.message}`, 'danger');
                hideSpinner(uploadSpinner);
                hideUploadProgress();
                currentUploadTask = null;
            },
            async () => {
                // Handle successful uploads on complete
                const imageUrl = await getDownloadURL(currentUploadTask.snapshot.ref);
                console.log("Image uploaded to Storage:", imageUrl);

                // 2. Save product data to Firestore
                const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
                await addDoc(productsCollectionRef, {
                    name: productName,
                    category: productCategory,
                    price: productPrice, // New: Save price
                    imageUrl: imageUrl,
                    imagePath: imagePath, // Save image path for easy deletion
                    timestamp: serverTimestamp()
                });

                showMessage(uploadMessage, 'Product uploaded successfully!', 'success');
                uploadForm.reset();
                imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>';
                productPriceInput.value = ''; // Clear price input specifically
                console.log("Product data saved to Firestore.");
                hideSpinner(uploadSpinner);
                hideUploadProgress();
                currentUploadTask = null; // Clear the task
            }
        );

    } catch (error) {
        console.error("Initial upload setup error:", error);
        showMessage(uploadMessage, `Failed to initiate upload: ${error.message}`, 'danger');
        hideSpinner(uploadSpinner);
        hideUploadProgress();
        currentUploadTask = null;
    }
}

function handleUploadCancel() {
    if (currentUploadTask) {
        currentUploadTask.cancel();
        showMessage(uploadMessage, 'Upload cancelled by user.', 'info');
        console.log("Upload cancelled.");
    } else {
        showMessage(uploadMessage, 'No active upload to cancel.', 'info');
    }
    hideSpinner(uploadSpinner); // Hide general spinner
    hideUploadProgress(); // Hide progress bar
    uploadForm.reset(); // Clear form
    imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>';
    currentUploadTask = null; // Clear the task
}

// --- Product Listing and Deletion Logic ---

function setupProductsListener() {
    const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
    const q = query(productsCollectionRef, orderBy('timestamp', 'desc')); // Order by newest first

    onSnapshot(q, (snapshot) => {
        uploadedProductsList.innerHTML = ''; // Clear existing list
        if (snapshot.empty) {
            uploadedProductsList.innerHTML = '<li class="list-group-item text-center text-muted">No products uploaded yet.</li>';
            return;
        }

        snapshot.forEach((doc) => {
            const product = doc.data();
            const productId = doc.id;
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    <img src="${product.imageUrl}" alt="${product.name}" class="img-thumbnail me-3" style="width: 50px; height: 50px; object-fit: cover;">
                    <span>${product.name} (${product.category}) - ₦${product.price.toLocaleString()}</span>
                </div>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${productId}" data-image-path="${product.imagePath}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
            uploadedProductsList.appendChild(li);
        });

        // Attach event listeners to new delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.id;
                const imagePath = e.currentTarget.dataset.imagePath;
                if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
                    deleteProduct(productId, imagePath);
                }
            });
        });
    }, (error) => {
        console.error("Error fetching products:", error);
        showMessage(uploadMessage, 'Error fetching product list.', 'danger');
    });
}

async function deleteProduct(productId, imagePath) {
    try {
        // 1. Delete from Firestore
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, productId));
        console.log("Document successfully deleted from Firestore:", productId);

        // 2. Delete from Firebase Storage
        const imageRef = ref(storage, imagePath);
        await deleteObject(imageRef);
        console.log("Image successfully deleted from Storage:", imagePath);

        showMessage(uploadMessage, 'Product deleted successfully!', 'success');
    } catch (error) {
        console.error("Error deleting product:", error);
        showMessage(uploadMessage, `Failed to delete product: ${error.message}`, 'danger');
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginSection.classList.add('d-none');
            uploadSection.classList.remove('d-none');
            productListSection.classList.remove('d-none'); // Show product list
            hideMessage(loginMessage);
            console.log("User is logged in:", user.email);
            setupProductsListener(); // Start listening for product updates
        } else {
            loginSection.classList.remove('d-none');
            uploadSection.classList.add('d-none');
            productListSection.classList.add('d-none'); // Hide product list
            console.log("User is logged out.");
        }
    });

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

    if (uploadCancelBtn) { // New event listener for cancel button
        uploadCancelBtn.addEventListener('click', handleUploadCancel);
    } else {
        console.warn("Upload cancel button with ID 'uploadCancelBtn' not found.");
    }

    // Hide spinners and progress initially
    hideSpinner(uploadSpinner);
    hideSpinner(loginSpinner);
    hideUploadProgress();
});
