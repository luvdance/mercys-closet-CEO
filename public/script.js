// --- Firebase SDK Imports ---
// Using 11.6.1 as per your provided working code
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Changed to uploadBytesResumable for progress and cancel functionality
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
// Added imports for Firestore product management
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Firebase Configuration ---
// IMPORTANT: Please ensure this matches your actual Firebase Project Configuration.
// If you define firebaseConfig in your HTML <script> tag, you can remove this block,
// but make sure `appId` is still available globally if you rely on it for paths.
const firebaseConfig = {
    apiKey: "AIzaSyA3tUEHVe_y8BQ_3_16YsKlokc10qDox-8",
    authDomain: "mercy-s-closet-ceo-app.firebaseapp.com",
    projectId: "mercy-s-closet-ceo-app",
    storageBucket: "mercy-s-closet-ceo-app.appspot.com", // This is confirmed correct for web SDK
    messagingSenderId: "102114420195",
    appId: "1:102114420195:web:af33297eab51e9c0032cd6"
};


// Initialize Firebase app
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get Auth instance
const storage = getStorage(app); // Get Storage instance
const db = getFirestore(app); // Get Firestore instance
const appId = firebaseConfig.appId; // Get appId from config for use in paths

// --- Global Variable for Upload Task (for cancellation) ---
let currentUploadTask = null;

// --- DOM Elements ---
const loginSection = document.getElementById('loginSection');
const uploadSection = document.getElementById('uploadSection');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');

// New/Enhanced DOM Elements for Upload
const uploadForm = document.getElementById('uploadForm');
const productImageInput = document.getElementById('productImage');
const imagePreviewContainer = document.getElementById('imagePreviewContainer'); // This will hold multiple previews
const imagePreview = document.getElementById('imagePreview'); // Inner div to actually show images
const productNameInput = document.getElementById('productName');
const productDescriptionTextarea = document.getElementById('productDescription'); // New
const productCategorySelect = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice'); // New
const productCurrencySelect = document.getElementById('productCurrency'); // New
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const uploadSpinner = document.getElementById('uploadSpinner'); // Keep this for overall form
const uploadProgressBarContainer = document.getElementById('uploadProgressBarContainer'); // New container for individual progress bars
const uploadProgressBarArea = document.getElementById('uploadProgressBarArea'); // Area to append individual bars
const cancelUploadBtn = document.getElementById('cancelUploadBtn'); // New button for cancellation

// New DOM Elements for Product Management
const productManagementSection = document.getElementById('productManagementSection'); // A new section to display products
const productList = document.getElementById('productList'); // Where product cards will be listed

// Modal and fields for Editing Products
const editProductModalElement = document.getElementById('editProductModal');
let editProductModal; // Will be initialized as a Bootstrap modal instance
if (editProductModalElement) {
    editProductModal = new bootstrap.Modal(editProductModalElement);
}
const editProductForm = document.getElementById('editProductForm');
const editProductIdInput = document.getElementById('editProductId');
const editProductNameInput = document.getElementById('editProductName');
const editProductDescriptionTextarea = document.getElementById('editProductDescription');
const editProductCategorySelect = document.getElementById('editProductCategory');
const editProductPriceInput = document.getElementById('editProductPrice');
const editProductCurrencySelect = document.getElementById('editProductCurrency');
const currentImagesPreview = document.getElementById('currentImagesPreview'); // For images currently attached to product
const editProductImagesInput = document.getElementById('editProductImages'); // For adding new images during edit
const saveEditBtn = document.getElementById('saveEditBtn');
const editMessage = document.getElementById('editMessage');
const editUploadProgressBarContainer = document.getElementById('editUploadProgressBarContainer'); // Progress container for edit uploads
const editProgressBarArea = document.getElementById('editProgressBarArea'); // Area for edit upload progress bars


// Global variable to store all products fetched for management
let allManageProducts = [];

// --- Helper Functions for UI Messages & Spinners ---

/**
 * Displays a message in the specified message element.
 * @param {HTMLElement} element The HTML element to display the message in.
 * @param {string} message The message text.
 * @param {string} type Bootstrap alert type (e.g., 'success', 'danger', 'info', 'warning').
 */
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `alert mt-3 ${type === 'success' ? 'alert-success' : type === 'danger' ? 'alert-danger' : type === 'info' ? 'alert-info' : 'alert-warning'}`;
    element.classList.remove('d-none');
}

/**
 * Hides the specified message element.
 * @param {HTMLElement} element The HTML element to hide.
 */
function hideMessage(element) {
    element.classList.add('d-none');
    element.textContent = ''; // Clear content when hidden
}

/**
 * Shows the loading spinner and disables the upload button.
 */
function showSpinner() {
    uploadSpinner.classList.remove('d-none');
    uploadBtn.disabled = true;
    cancelUploadBtn.disabled = false; // Enable cancel button
}

/**
 * Hides the loading spinner and enables the upload button.
 */
function hideSpinner() {
    uploadSpinner.classList.add('d-none');
    uploadBtn.disabled = false;
    cancelUploadBtn.disabled = true; // Disable cancel button
}

/**
 * Creates and returns elements for a single file's upload progress.
 * @param {string} fileName
 * @param {HTMLElement} targetArea
 * @returns {{progressBar: HTMLElement, statusText: HTMLElement, container: HTMLElement}}
 */
function createProgressBar(fileName, targetArea) {
    const div = document.createElement('div');
    div.classList.add('mb-2', 'p-2', 'border', 'rounded', 'bg-light');
    div.innerHTML = `
        <strong>${fileName}</strong>
        <div class="progress mt-1" style="height: 20px;">
            <div class="progress-bar bg-info" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
        <p class="text-muted small mt-1">Uploading...</p>
    `;
    targetArea.appendChild(div);
    return {
        container: div,
        progressBar: div.querySelector('.progress-bar'),
        statusText: div.querySelector('p')
    };
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
 * Handles product image preview for multiple images.
 */
function handleImagePreview() {
    imagePreview.innerHTML = ''; // Clear previous previews
    imagePreviewContainer.classList.add('d-none'); // Hide container by default

    const files = productImageInput.files;
    if (files.length > 0) {
        imagePreviewContainer.classList.remove('d-none'); // Show container

        Array.from(files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgItem = document.createElement('div');
                imgItem.className = 'multi-image-preview-item'; // Use a class for styling
                imgItem.innerHTML = `
                    <img src="${e.target.result}" alt="Image Preview">
                    <button type="button" class="remove-btn" data-file-name="${file.name}" data-file-index="${index}">&times;</button>
                `;
                imagePreview.appendChild(imgItem);

                // Add event listener to remove button for this specific image
                imgItem.querySelector('.remove-btn').addEventListener('click', (removeEvent) => {
                    const fileNameToRemove = removeEvent.target.dataset.fileName;
                    const fileIndexToRemove = parseInt(removeEvent.target.dataset.fileIndex);

                    // Create a new FileList without the removed file
                    const dataTransfer = new DataTransfer();
                    Array.from(productImageInput.files).forEach((f, i) => {
                        if (f.name !== fileNameToRemove || i !== fileIndexToRemove) { // Use name and index for unique identification
                            dataTransfer.items.add(f);
                        }
                    });
                    productImageInput.files = dataTransfer.files; // Update the file input's files

                    imgItem.remove(); // Remove the image preview element
                    if (productImageInput.files.length === 0) {
                        imagePreviewContainer.classList.add('d-none'); // Hide container if no images
                    }
                });
            };
            reader.readAsDataURL(file);
        });
    }
}


/**
 * Handles product upload to Firebase Storage and Firestore.
 * @param {Event} e The form submission event.
 */
async function handleUpload(e) {
    e.preventDefault();
    hideMessage(uploadMessage); // Clear previous messages
    uploadProgressBarArea.innerHTML = ''; // Clear previous progress bars
    uploadProgressBarContainer.classList.add('d-none'); // Hide progress container initially
    showSpinner(); // Show loading spinner and disable upload button

    const productName = productNameInput.value;
    const productDescription = productDescriptionTextarea.value;
    const productCategory = productCategorySelect.value;
    const productPrice = parseFloat(productPriceInput.value);
    const productCurrency = productCurrencySelect.value;
    const productImages = productImageInput.files;

    if (!productName || !productDescription || !productCategory || isNaN(productPrice) || productImages.length === 0) {
        showMessage(uploadMessage, 'Please fill in all fields, select a valid price, and select at least one image.', 'danger');
        hideSpinner();
        return;
    }

    let uploadedImageUrls = [];
    let uploadFailed = false;

    try {
        uploadProgressBarContainer.classList.remove('d-none'); // Show progress container

        for (let i = 0; i < productImages.length; i++) {
            const file = productImages[i];
            const fileName = file.name;
            // Use current timestamp in filename to ensure uniqueness
            const uniqueFileName = `${Date.now()}_${fileName}`;

            // 1. Upload image to Firebase Storage - MATCHING YOUR WORKING RULE
            const storageRef = ref(storage, `artifacts/${appId}/public/images/${productCategory}/${uniqueFileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file); // Use Resumable for progress/cancel

            currentUploadTask = uploadTask; // Store for cancellation

            const { container, progressBar, statusText } = createProgressBar(fileName, uploadProgressBarArea);

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        progressBar.style.width = progress + '%';
                        progressBar.setAttribute('aria-valuenow', progress);
                        progressBar.textContent = `${Math.round(progress)}%`;
                        statusText.textContent = `Uploading: ${Math.round(progress)}%`;
                    },
                    (error) => {
                        console.error("Upload error for", fileName, error);
                        statusText.textContent = `Error: ${error.message}`;
                        progressBar.classList.remove('bg-info');
                        progressBar.classList.add('bg-danger');
                        uploadFailed = true; // Mark that at least one upload failed
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        uploadedImageUrls.push(downloadURL);
                        statusText.textContent = `Complete!`;
                        progressBar.classList.remove('bg-info');
                        progressBar.classList.add('bg-success');
                        resolve();
                    }
                );
            });
        }

        // 2. Save product data to Firestore
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        await addDoc(productsCollectionRef, {
            name: productName,
            description: productDescription,
            category: productCategory,
            price: productPrice,
            currency: productCurrency,
            imageUrls: uploadedImageUrls, // Store all URLs
            imageUrl: uploadedImageUrls[0] || '', // Keep primary for simple display if needed
            timestamp: serverTimestamp() // Add a server-generated timestamp
        });

        showMessage(uploadMessage, 'Product uploaded successfully!', 'success');
        uploadForm.reset(); // Clear form fields
        imagePreview.innerHTML = ''; // Clear image previews
        imagePreviewContainer.classList.add('d-none'); // Hide image preview container
        console.log("Product data saved to Firestore.");

        // Refresh product list in management section
        await fetchAndDisplayProductsForManagement();

    } catch (error) {
        if (error.code === 'storage/canceled') {
            showMessage(uploadMessage, 'Upload canceled by user.', 'info');
        } else {
            console.error("Upload error:", error);
            showMessage(uploadMessage, `Failed to upload product: ${error.message}`, 'danger');
        }
    } finally {
        hideSpinner(); // Hide spinner regardless of success, failure, or cancel
        currentUploadTask = null; // Clear task
        setTimeout(() => {
            uploadProgressBarContainer.classList.add('d-none'); // Hide after a delay
            uploadProgressBarArea.innerHTML = ''; // Clear progress bars
        }, 3000);
    }
}

/**
 * Handles cancelling the current upload task.
 */
function handleCancelUpload() {
    if (currentUploadTask) {
        currentUploadTask.cancel();
        console.log("Upload cancelled.");
        showMessage(uploadMessage, 'Upload process cancelled.', 'info');
        hideSpinner(); // Hide spinner and re-enable upload button immediately
        uploadProgressBarContainer.classList.add('d-none'); // Hide progress container
        uploadProgressBarArea.innerHTML = ''; // Clear progress bars
        currentUploadTask = null; // Clear the reference
    } else {
        showMessage(uploadMessage, 'No active upload to cancel.', 'warning');
    }
}


// --- Product Management Logic (Fetch, Display, Edit, Delete) ---

// Function to fetch and display products for management
async function fetchAndDisplayProductsForManagement() {
    productList.innerHTML = '<p class="col-12 text-center text-muted">Loading products...</p>';
    try {
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        const q = query(productsCollectionRef, orderBy("timestamp", "desc")); // Order by timestamp
        const querySnapshot = await getDocs(q);

        allManageProducts = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderManageProducts();
    } catch (error) {
        console.error("Error fetching products for management:", error);
        productList.innerHTML = '<p class="col-12 text-center text-danger">Failed to load products. Please try again.</p>';
    }
}

// Function to render products in the management section
function renderManageProducts() {
    productList.innerHTML = ''; // Clear previous products

    if (allManageProducts.length === 0) {
        productList.innerHTML = '<p class="col-12 text-center text-muted">No products uploaded yet.</p>';
        return;
    }

    allManageProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'col-md-4 col-sm-6 mb-4'; // Bootstrap grid classes
        productCard.innerHTML = `
            <div class="card h-100 shadow-sm">
                <img src="${product.imageUrl || 'https://via.placeholder.com/200x150?text=No+Image'}" class="card-img-top" alt="${product.name}" style="height: 150px; object-fit: cover;">
                <div class="card-body">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text small text-muted">${product.category || 'N/A'}</p>
                    <p class="card-text">${product.description ? product.description.substring(0, 70) + '...' : 'No description'}</p>
                    <p class="card-text fw-bold">${formatCurrency(product.price || 0, product.currency || 'NGN')}</p>
                    <div class="d-flex justify-content-between mt-3">
                        <button class="btn btn-warning btn-sm edit-product-btn" data-id="${product.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-product-btn" data-id="${product.id}">Delete</button>
                    </div>
                </div>
            </div>
        `;
        productList.appendChild(productCard);
    });

    attachManagementEventListeners();
}

// Attach event listeners for edit/delete buttons dynamically
function attachManagementEventListeners() {
    document.querySelectorAll('.edit-product-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-product-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteProduct(e.target.dataset.id));
    });
}

// Open Edit Product Modal
async function openEditModal(productId) {
    const product = allManageProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found for editing:", productId);
        return;
    }

    editProductIdInput.value = product.id;
    editProductNameInput.value = product.name;
    editProductDescriptionTextarea.value = product.description;
    editProductCategorySelect.value = product.category;
    editProductPriceInput.value = product.price;
    editProductCurrencySelect.value = product.currency;

    // Display current images for deletion in the modal
    currentImagesPreview.innerHTML = '';
    // Ensure imageUrls is an array, fallback for old single imageUrl products
    const imageUrls = product.imageUrls && Array.isArray(product.imageUrls) ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);

    imageUrls.forEach(url => {
        if (!url) return; // Skip empty URLs

        const imgContainer = document.createElement('div');
        imgContainer.className = 'position-relative multi-image-preview-item';
        imgContainer.innerHTML = `
            <img src="${url}" alt="Image Preview">
            <button type="button" class="remove-btn" data-image-url="${url}">&times;</button>
        `;
        const deleteButton = imgContainer.querySelector('.remove-btn');
        deleteButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to remove this image? It will be deleted from storage when you save changes.")) {
                imgContainer.remove();
                // Store URLs to be deleted upon save
                const currentUrls = JSON.parse(editProductForm.dataset.originalImageUrls || '[]');
                const newUrls = currentUrls.filter(u => u !== url);
                editProductForm.dataset.originalImageUrls = JSON.stringify(newUrls);
            }
        });
        currentImagesPreview.appendChild(imgContainer);
    });
    // Store original images to track deletions
    editProductForm.dataset.originalImageUrls = JSON.stringify(imageUrls);


    hideMessage(editMessage);
    editUploadProgressBarContainer.classList.add('d-none'); // Hide progress until new upload
    editProgressBarArea.innerHTML = ''; // Clear progress
    editProductImagesInput.value = ''; // Clear any previously selected new files

    editProductModal.show();
}

// Save Edited Product
editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    saveEditBtn.disabled = true;
    hideMessage(editMessage);
    editProgressBarArea.innerHTML = ''; // Clear progress
    editUploadProgressBarContainer.classList.remove('d-none'); // Show progress container for potential new uploads

    const productId = editProductIdInput.value;
    const existingProduct = allManageProducts.find(p => p.id === productId);
    if (!existingProduct) {
        showMessage(editMessage, "Product not found for update.", 'danger');
        saveEditBtn.disabled = false;
        editUploadProgressBarContainer.classList.add('d-none');
        return;
    }

    // Determine images to delete (those removed from currentImagesPreview)
    const originalImageUrls = JSON.parse(editProductForm.dataset.originalImageUrls || '[]');
    const currentDisplayedImageUrls = Array.from(currentImagesPreview.querySelectorAll('img')).map(img => img.src);
    const imagesToDelete = originalImageUrls.filter(url => !currentDisplayedImageUrls.includes(url));


    // Delete images from Storage that were removed from the UI
    for (const imageUrl of imagesToDelete) {
        try {
            const pathStartIndex = imageUrl.indexOf('/o/');
            if (pathStartIndex !== -1) {
                let path = imageUrl.substring(pathStartIndex + 3);
                const queryIndex = path.indexOf('?');
                if (queryIndex !== -1) {
                    path = path.substring(0, queryIndex);
                }
                path = decodeURIComponent(path);
                const imageRef = ref(storage, path);
                await deleteObject(imageRef);
                console.log(`Deleted image from Storage: ${path}`);
            } else {
                console.warn(`Could not parse storage path from URL for deletion: ${imageUrl}`);
            }
        } catch (imgError) {
            console.warn(`Could not delete image ${imageUrl} from Storage:`, imgError);
        }
    }


    // Upload new images
    const newImages = editProductImagesInput.files;
    let newUploadSuccess = true;
    let newlyUploadedUrls = [];

    for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];
        const fileName = file.name;
        const uniqueFileName = `${Date.now()}_${fileName}`;
        // MODIFIED: Aligning storage path with your working Firebase Storage Rules
        const storagePath = `artifacts/${appId}/public/images/${editProductCategorySelect.value}/${uniqueFileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        const { container, progressBar, statusText } = createProgressBar(fileName, editProgressBarArea);

        await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressBar.style.width = progress + '%';
                    progressBar.setAttribute('aria-valuenow', progress);
                    progressBar.textContent = `${Math.round(progress)}%`;
                    statusText.textContent = `Uploading new image: ${Math.round(progress)}%`;
                },
                (error) => {
                    console.error("New image upload error:", fileName, error);
                    statusText.textContent = `Error: ${error.message}`;
                    progressBar.classList.remove('bg-info');
                    progressBar.classList.add('bg-danger');
                    newUploadSuccess = false;
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    newlyUploadedUrls.push(downloadURL); // Add new URL to the list
                    statusText.textContent = `Complete!`;
                    progressBar.classList.remove('bg-info');
                    progressBar.classList.add('bg-success');
                    resolve();
                }
            );
        });
    }

    if (!newUploadSuccess && newImages.length > 0) {
        showMessage(editMessage, "Some new images failed to upload. Product might not be fully updated.", 'warning');
    }

    try {
        const productRef = doc(db, `artifacts/${appId}/public/data/products`, productId);

        // Combine existing and newly uploaded images
        const finalImageUrls = currentDisplayedImageUrls.concat(newlyUploadedUrls);

        const updatedData = {
            name: editProductNameInput.value,
            description: editProductDescriptionTextarea.value,
            category: editProductCategorySelect.value,
            price: parseFloat(editProductPriceInput.value),
            currency: editProductCurrencySelect.value,
            imageUrls: finalImageUrls, // Save the combined list of image URLs
            imageUrl: finalImageUrls[0] || '', // Update primary image to the first in the list
            lastUpdated: serverTimestamp() // Add a last updated timestamp
        };

        await updateDoc(productRef, updatedData);

        showMessage(editMessage, 'Product updated successfully!', 'success');
        await fetchAndDisplayProductsForManagement(); // Refresh list

        setTimeout(() => {
            editProductModal.hide();
        }, 1500);

    } catch (error) {
        console.error("Error updating product:", error);
        showMessage(editMessage, `Error updating product: ${error.message}`, 'danger');
    } finally {
        saveEditBtn.disabled = false;
        setTimeout(() => {
            editUploadProgressBarContainer.classList.add('d-none');
        }, 1000);
    }
});


// Delete Product
async function deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone and will delete associated images from storage.")) {
        return;
    }

    try {
        const productRef = doc(db, `artifacts/${appId}/public/data/products`, productId);
        const productToDelete = allManageProducts.find(p => p.id === productId);

        // Get all image URLs associated with the product to delete from Storage
        const imagesToDelete = productToDelete.imageUrls && Array.isArray(productToDelete.imageUrls)
            ? productToDelete.imageUrls
            : (productToDelete.imageUrl ? [productToDelete.imageUrl] : []);

        for (const imageUrl of imagesToDelete) {
            try {
                // Extract path from download URL
                const pathStartIndex = imageUrl.indexOf('/o/');
                if (pathStartIndex !== -1) {
                    let path = imageUrl.substring(pathStartIndex + 3);
                    const queryIndex = path.indexOf('?');
                    if (queryIndex !== -1) {
                        path = path.substring(0, queryIndex);
                    }
                    path = decodeURIComponent(path); // Decode any URL-encoded characters
                    const imageRef = ref(storage, path);
                    await deleteObject(imageRef);
                    console.log(`Deleted image from Storage: ${path}`);
                } else {
                    console.warn(`Could not parse storage path from URL for deletion: ${imageUrl}`);
                }
            } catch (imgError) {
                // Log and continue, as one image failing to delete shouldn't stop the others or the document deletion
                console.warn(`Could not delete image ${imageUrl} from Storage:`, imgError);
            }
        }

        await deleteDoc(productRef); // Delete the product document from Firestore
        console.log("Product document deleted successfully:", productId);

        // Update UI
        allManageProducts = allManageProducts.filter(p => p.id !== productId);
        renderManageProducts(); // Re-render the list

        const tempMsg = document.createElement('p');
        tempMsg.textContent = "Product deleted successfully!";
        tempMsg.className = 'text-success text-center my-3 alert alert-success';
        productList.parentNode.insertBefore(tempMsg, productList);
        setTimeout(() => tempMsg.remove(), 3000);

    } catch (error) {
        console.error("Error deleting product:", error);
        alert("Failed to delete product: " + error.message);
    }
}


// --- Utility Functions ---
function formatCurrency(amount, currencyCode = 'NGN') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return 'Price Not Available';
    }
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    if (currencyCode === 'NGN') {
        return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return formatter.format(amount);
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // onAuthStateChanged listener: determines which section to show (login or upload/management)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            loginSection.classList.add('d-none');
            uploadSection.classList.remove('d-none');
            productManagementSection.classList.remove('d-none'); // Show management section
            hideMessage(loginMessage); // Hide any login error messages
            console.log("User is logged in:", user.email);
            fetchAndDisplayProductsForManagement(); // Fetch products on login
        } else {
            // User is signed out
            loginSection.classList.remove('d-none');
            uploadSection.classList.add('d-none');
            productManagementSection.classList.add('d-none'); // Hide management section
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

    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', handleCancelUpload);
    } else {
        console.warn("Cancel upload button with ID 'cancelUploadBtn' not found.");
    }

    // Hide spinner and cancel button initially
    hideSpinner();
    // Hide progress containers initially
    uploadProgressBarContainer.classList.add('d-none');
    editUploadProgressBarContainer.classList.add('d-none');
});
