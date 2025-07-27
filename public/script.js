// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyA3tUEHVe_y8BQ_3_16YsKlokc10qDox-8",
    authDomain: "mercy-s-closet-ceo-app.firebaseapp.com",
    projectId: "mercy-s-closet-ceo-app",
    storageBucket: "mercy-s-closet-ceo-app.firebasestorage.app",
    messagingSenderId: "102114420195",
    appId: "1:102114420195:web:af33297eab51e9c0032cd6"
};
const appId = "1:102114420195:web:af33297eab51e9c0032cd6";

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    updateDoc, 
    getDoc // <-- Added getDoc here
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Initialize Firebase app
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
const loginSpinner = document.getElementById('loginSpinner');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const uploadForm = document.getElementById('uploadForm');
const productImageInput = document.getElementById('productImage');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const productNameInput = document.getElementById('productName');
const productCategorySelect = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const uploadSpinner = document.getElementById('uploadSpinner');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadCancelBtn = document.getElementById('uploadCancelBtn');

const uploadedProductsList = document.getElementById('uploadedProductsList');
const productListSection = document.getElementById('productListSection');

// New DOM Elements for Edit Modal
const editProductModal = new bootstrap.Modal(document.getElementById('editProductModal')); // Initialize Bootstrap Modal object
const editProductForm = document.getElementById('editProductForm');
const editProductIdInput = document.getElementById('editProductId');
const editProductNameInput = document.getElementById('editProductName');
const editProductCategorySelect = document.getElementById('editProductCategory');
const editProductPriceInput = document.getElementById('editProductPrice');
const saveEditBtn = document.getElementById('saveEditBtn');
const editMessage = document.getElementById('editMessage');

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
    uploadBtn.disabled = true;
    uploadCancelBtn.disabled = false;
}

function updateUploadProgress(percentage) {
    uploadProgressBar.style.width = `${percentage}%`;
    uploadProgressBar.setAttribute('aria-valuenow', percentage);
    uploadProgressBar.textContent = `${percentage}%`;
}

function hideUploadProgress() {
    uploadProgressContainer.classList.add('d-none');
    uploadBtn.disabled = false;
    uploadCancelBtn.disabled = true;
}

// --- Authentication Logic ---

async function handleLogin(e) {
    e.preventDefault();
    hideMessage(loginMessage);

    // Show spinner and disable button at the start of login
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
        // Hide spinner and re-enable button regardless of outcome
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
    const productPrice = parseFloat(productPriceInput.value); // Get price as number

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
                // Check if it's a cancellation error
                if (error.code === 'storage/canceled') {
                    showMessage(uploadMessage, 'Upload cancelled by user.', 'info');
                } else {
                    showMessage(uploadMessage, `Image upload failed: ${error.message}`, 'danger');
                }
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
                    price: productPrice,
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
        // The 'state_changed' error handler will catch the cancellation
    } else {
        showMessage(uploadMessage, 'No active upload to cancel.', 'info');
        hideSpinner(uploadSpinner);
        hideUploadProgress();
        uploadForm.reset();
        imagePreviewContainer.innerHTML = '<span class="text-muted">Image preview will appear here</span>';
    }
    currentUploadTask = null; // Ensure task is cleared regardless
}

// --- Product Listing, Editing, and Deletion Logic ---

// Function to handle the "Edit" button click
async function handleEditButtonClick(productId) {
    hideMessage(editMessage); // Clear any previous messages in the modal
    saveEditBtn.disabled = true; // Disable save button while loading data

    try {
        const productDocRef = doc(db, `artifacts/${appId}/public/data/products`, productId);
        const productSnapshot = await getDoc(productDocRef);

        if (productSnapshot.exists()) {
            const productData = productSnapshot.data();
            editProductIdInput.value = productId;
            editProductNameInput.value = productData.name;
            editProductCategorySelect.value = productData.category;
            editProductPriceInput.value = productData.price;
            editProductModal.show(); // Show the Bootstrap modal
        } else {
            showMessage(uploadMessage, 'Product not found for editing.', 'danger');
            console.error("Product document not found:", productId);
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        showMessage(uploadMessage, `Error loading product for edit: ${error.message}`, 'danger');
    } finally {
        saveEditBtn.disabled = false; // Re-enable save button
    }
}

// Function to handle saving edited product details
async function handleSaveEditedProduct() {
    hideMessage(editMessage);
    saveEditBtn.disabled = true;

    const productId = editProductIdInput.value;
    const newName = editProductNameInput.value.trim();
    const newCategory = editProductCategorySelect.value;
    const newPrice = parseFloat(editProductPriceInput.value);

    if (!newName || !newCategory || isNaN(newPrice) || newPrice <= 0) {
        showMessage(editMessage, 'Please fill in all fields and enter a valid price.', 'danger');
        saveEditBtn.disabled = false;
        return;
    }

    try {
        const productDocRef = doc(db, `artifacts/${appId}/public/data/products`, productId);
        await updateDoc(productDocRef, {
            name: newName,
            category: newCategory,
            price: newPrice
            // We are not updating imageUrl or imagePath here
        });

        showMessage(uploadMessage, 'Product updated successfully!', 'success');
        editProductModal.hide(); // Hide the modal on success
    } catch (error) {
        console.error("Error updating product:", error);
        showMessage(editMessage, `Failed to update product: ${error.message}`, 'danger');
    } finally {
        saveEditBtn.disabled = false;
    }
}


function setupProductsListener() {
    const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
    const q = query(productsCollectionRef, orderBy('timestamp', 'desc')); // Order by newest first

    // Listen for real-time updates to the products collection in Firestore
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

            // Ensure price is formatted as Naira
            const formattedPrice = new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(product.price);

            li.innerHTML = `
                <div>
                    <img src="${product.imageUrl}" alt="${product.name}" class="img-thumbnail me-3" style="width: 50px; height: 50px; object-fit: cover;">
                    <span>${product.name} (${product.category}) - ${formattedPrice}</span>
                </div>
                <div>
                    <button class="btn btn-info btn-sm edit-btn me-2" data-id="${productId}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${productId}" data-image-path="${product.imagePath}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            uploadedProductsList.appendChild(li);
        });

        // Attach event listeners to new delete and edit buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.id;
                const imagePath = e.currentTarget.dataset.imagePath;
                if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
                    deleteProduct(productId, imagePath);
                }
            });
        });

        // Attach event listeners to new edit buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.id;
                handleEditButtonClick(productId);
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
            setupProductsListener(); // Start listening for product updates from Firestore
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

    if (uploadCancelBtn) {
        uploadCancelBtn.addEventListener('click', handleUploadCancel);
    } else {
        console.warn("Upload cancel button with ID 'uploadCancelBtn' not found.");
    }

    // Add event listener for the Save Changes button in the edit modal
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', handleSaveEditedProduct);
    } else {
        console.warn("Save Edit button with ID 'saveEditBtn' not found.");
    }


    // Hide spinners and progress initially
    hideSpinner(uploadSpinner);
    hideSpinner(loginSpinner, loginBtn); // Ensure login spinner is hidden on page load and button is enabled
    hideUploadProgress();
});
