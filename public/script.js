// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyA3tUEHVe_y8BQ_3_16YsKlokc10qDox-8",
    authDomain: "mercy-s-closet-ceo-app.firebaseapp.com",
    projectId: "mercy-s-closet-ceo-app",
    storageBucket: "mercy-s-closet-ceo-app.appspot.com", // This is confirmed correct for web SDK
    messagingSenderId: "102114420195",
    appId: "1:102114420195:web:af33297eab51e9c0032cd6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = firebaseConfig.appId; // Assuming you'll use this for your collection path

// --- DOM Element References ---
// Login Section
const loginSection = document.getElementById('loginSection');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginLoader = document.getElementById('loginLoader');
const loginMessage = document.getElementById('loginMessage');

// Product Upload Section
const productUploadSection = document.getElementById('productUploadSection');
const logoutBtn = document.getElementById('logoutBtn'); // Added logout button
const productForm = document.getElementById('productForm');
const productNameInput = document.getElementById('productName');
const productDescriptionTextarea = document.getElementById('productDescription');
const productCategorySelect = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice');
const productCurrencySelect = document.getElementById('productCurrency');
const productImageInput = document.getElementById('productImage');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const progressBarArea = document.getElementById('progressBarArea');
const imagePreviewContainer = document.getElementById('imagePreviewContainer'); // For the new product upload preview
const imagePreview = document.getElementById('imagePreview'); // Inner div for images

// Product Management Section
const productList = document.getElementById('productList');
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
const editProductCurrencySelect = document.getElementById('editProductCurrency'); // Fixed this line
const currentImagesPreview = document.getElementById('currentImagesPreview');
const editProductImagesInput = document.getElementById('editProductImages');
const saveEditBtn = document.getElementById('saveEditBtn');
const editMessage = document.getElementById('editMessage');
const editUploadProgressContainer = document.getElementById('editUploadProgressContainer');
const editProgressBarArea = document.getElementById('editProgressBarArea');

// Global variable to store all products fetched for management
let allManageProducts = [];


// --- Authentication Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, show upload/management section
        loginSection.style.display = 'none';
        productUploadSection.style.display = 'block';
        await fetchAndDisplayProductsForManagement(); // Load products for authenticated users
    } else {
        // User is signed out, show login section
        loginSection.style.display = 'block';
        productUploadSection.style.display = 'none';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;

    // Show loader and hide messages
    loginLoader.style.display = 'inline-block';
    loginMessage.style.display = 'none';
    loginMessage.textContent = ''; // Clear previous messages
    loginMessage.classList.remove('alert-success', 'alert-warning'); // Clean up old alert classes
    loginMessage.classList.add('alert-danger'); // Default to danger for errors
    loginBtn.disabled = true; // Disable button during login

    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in successfully!");
        // UI updates are handled by onAuthStateChanged listener
        // Clear form fields
        loginEmail.value = '';
        loginPassword.value = '';
    } catch (error) {
        console.error("Login error:", error);
        loginMessage.textContent = "Login failed: " + error.message;
        loginMessage.style.display = 'block';
    } finally {
        // Hide loader regardless of success or failure
        loginLoader.style.display = 'none';
        loginBtn.disabled = false; // Re-enable button
    }
});

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("Logged out successfully!");
        // Optional: show a logout message
        loginMessage.textContent = "Logged out successfully.";
        loginMessage.className = 'mt-2 alert alert-success';
        loginMessage.style.display = 'block';
        setTimeout(() => {
            loginMessage.style.display = 'none';
        }, 3000); // Hide message after 3 seconds
        // UI updates are handled by onAuthStateChanged listener
    } catch (error) {
        console.error("Logout error:", error);
        alert("Error logging out: " + error.message);
    }
});


// --- Helper function to create a progress bar for an individual file ---
function createProgressBar(fileName, targetArea) {
    const div = document.createElement('div');
    div.classList.add('mb-2', 'p-2', 'border', 'rounded', 'bg-light');
    div.innerHTML = `
        <strong>${fileName}</strong>
        <div class="progress mt-1" style="height: 20px;">
            <div class="progress-bar bg-info" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
        <p class="text-muted small mt-1" id="status-${fileName.replace(/\./g, '-')}-${Date.now()}">Uploading...</p>
    `;
    targetArea.appendChild(div);
    return {
        progressBar: div.querySelector('.progress-bar'),
        statusText: div.querySelector('p')
    };
}

// --- Image Preview Logic for New Product Upload ---
productImageInput.addEventListener('change', (event) => {
    imagePreview.innerHTML = ''; // Clear previous previews
    imagePreviewContainer.style.display = 'none'; // Hide container by default

    const files = event.target.files;
    if (files.length > 0) {
        imagePreviewContainer.style.display = 'flex'; // Show container

        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgItem = document.createElement('div');
                imgItem.className = 'multi-image-preview-item';
                imgItem.innerHTML = `
                    <img src="${e.target.result}" alt="Image Preview">
                    <button type="button" class="remove-btn" data-file-name="${file.name}">&times;</button>
                `;
                imagePreview.appendChild(imgItem);

                // Add event listener to remove button for this specific image
                imgItem.querySelector('.remove-btn').addEventListener('click', (removeEvent) => {
                    const fileNameToRemove = removeEvent.target.dataset.fileName;
                    // Create a new DataTransfer object to modify the FileList
                    const dataTransfer = new DataTransfer();
                    Array.from(productImageInput.files)
                        .filter(f => f.name !== fileNameToRemove)
                        .forEach(f => dataTransfer.items.add(f));
                    productImageInput.files = dataTransfer.files; // Update the file input's files

                    imgItem.remove(); // Remove the image preview element
                    if (productImageInput.files.length === 0) {
                        imagePreviewContainer.style.display = 'none'; // Hide container if no images
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    }
});


// --- Product Upload Logic ---
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productName = productNameInput.value;
    const productDescription = productDescriptionTextarea.value;
    const productCategory = productCategorySelect.value;
    const productPrice = parseFloat(productPriceInput.value);
    const productCurrency = productCurrencySelect.value;
    const productImages = productImageInput.files;

    if (productImages.length === 0) {
        uploadMessage.textContent = "Please select at least one image.";
        uploadMessage.className = 'mt-2 alert alert-danger';
        uploadMessage.style.display = 'block';
        return;
    }

    // Disable button and clear previous messages/progress bars
    uploadBtn.disabled = true;
    uploadMessage.style.display = 'none';
    uploadMessage.classList.remove('alert-success', 'alert-danger', 'alert-warning');
    progressBarArea.innerHTML = ''; // Clear previous progress bars
    uploadProgressContainer.style.display = 'block'; // Show progress container

    let uploadedImageUrls = [];
    let uploadSuccess = true;

    try {
        // Upload each selected image
        for (let i = 0; i < productImages.length; i++) {
            const file = productImages[i];
            const fileName = file.name;
            // Create a unique filename for storage to prevent overwrites
            // MODIFIED: Aligning storage path with your working Firebase Storage Rules
            const storagePath = `artifacts/${appId}/public/images/${productCategory}/${Date.now()}_${fileName}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            // Re-enabling progress bar UI updates
            const { progressBar, statusText } = createProgressBar(fileName, progressBarArea);

            // Listen for state changes, errors, and completion of the upload.
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload of ${fileName} is ${Math.round(progress)}% done`);
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
                        uploadSuccess = false;
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        uploadedImageUrls.push(downloadURL);
                        console.log(`Upload of ${fileName} complete! Download URL: ${downloadURL}`);
                        statusText.textContent = `Complete!`;
                        progressBar.classList.remove('bg-info');
                        progressBar.classList.add('bg-success');
                        resolve();
                    }
                );
            });
        }

        if (!uploadSuccess) {
            uploadMessage.textContent = "Some images failed to upload. Product might not be fully saved.";
            uploadMessage.className = 'mt-2 alert alert-warning'; // Warning instead of danger if some uploaded
            uploadMessage.style.display = 'block';
            // We will still attempt to save the product with successfully uploaded images
        }

        // Save product data to Firestore
        const productData = {
            name: productName,
            description: productDescription,
            category: productCategory,
            price: productPrice,
            currency: productCurrency,
            imageUrls: uploadedImageUrls, // Store all image URLs in an array
            imageUrl: uploadedImageUrls[0] || '', // First image URL as primary (for display elsewhere)
            timestamp: serverTimestamp() // Set server timestamp
        };

        // Ensure Firestore path matches your application's structure
        const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/products`), productData);
        console.log("Document written with ID: ", docRef.id);

        uploadMessage.textContent = "Product uploaded successfully!";
        uploadMessage.className = 'mt-2 alert alert-success';
        uploadMessage.style.display = 'block';

        // Clear form fields after successful upload
        productNameInput.value = '';
        productDescriptionTextarea.value = '';
        productCategorySelect.value = 'Shoes'; // Reset to default
        productPriceInput.value = '';
        productCurrencySelect.value = 'NGN'; // Reset to default
        productImageInput.value = ''; // Clear file input
        progressBarArea.innerHTML = ''; // Clear progress bars after completion
        imagePreview.innerHTML = ''; // Clear image previews
        imagePreviewContainer.style.display = 'none'; // Hide image preview container

        // Refresh the product list in the management section
        await fetchAndDisplayProductsForManagement();

    } catch (error) {
        console.error("Error during product upload:", error);
        uploadMessage.textContent = "Error uploading product: " + error.message;
        uploadMessage.className = 'mt-2 alert alert-danger';
        uploadMessage.style.display = 'block';
    } finally {
        // Re-enable button regardless of success or failure
        uploadBtn.disabled = false;
        // Keep progress container visible for a short period to show "Complete!"
        setTimeout(() => {
            uploadProgressContainer.style.display = 'none';
        }, 3000);
    }
});


// --- Product Management Logic (Fetch, Display, Edit, Delete) ---

// Function to fetch and display products for management
async function fetchAndDisplayProductsForManagement() {
    productList.innerHTML = '<p class="col-12 text-center text-muted">Loading products...</p>';
    try {
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
        // Order by timestamp to show most recent first
        const q = query(productsCollectionRef, orderBy("timestamp", "desc"));
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
        productCard.className = 'col';
        productCard.innerHTML = `
            <div class="card h-100 shadow-sm">
                <img src="${product.imageUrl || 'https://via.placeholder.com/200x150?text=No+Image'}" class="card-img-top" alt="${product.name}" style="height: 150px; object-fit: cover;">
                <div class="card-body">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text small text-muted">${product.category || 'N/A'}</p>
                    <p class="card-text fw-bold">${formatCurrency(product.price || 0, product.currency || 'NGN')}</p>
                    <p class="card-text">${product.description ? product.description.substring(0, 70) + '...' : 'No description'}</p>
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

// Attach event listeners for edit/delete buttons
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

    // Display current images for deletion
    currentImagesPreview.innerHTML = '';
    // Ensure imageUrls is an array, fallback for old single imageUrl products
    const imageUrls = product.imageUrls && Array.isArray(product.imageUrls) ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);

    imageUrls.forEach(url => {
        if (!url) return; // Skip empty URLs

        const imgContainer = document.createElement('div');
        imgContainer.className = 'position-relative multi-image-preview-item'; // Reusing multi-image preview style
        imgContainer.innerHTML = `
            <img src="${url}" alt="Image Preview">
            <button type="button" class="remove-btn" data-image-url="${url}">&times;</button>
        `;
        const deleteButton = imgContainer.querySelector('.remove-btn');
        // When clicking the 'x' button, simply remove it from the displayed preview
        deleteButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to remove this image? This change will be saved when you click 'Save Changes' for the product.")) {
                imgContainer.remove();
            }
        });
        currentImagesPreview.appendChild(imgContainer);
    });

    editMessage.style.display = 'none';
    editMessage.classList.remove('alert-success', 'alert-danger', 'alert-warning');
    editUploadProgressContainer.style.display = 'none'; // Hide progress until new upload
    editProgressBarArea.innerHTML = ''; // Clear progress
    editProductImagesInput.value = ''; // Clear any previously selected new files

    editProductModal.show();
}

// Save Edited Product
editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    saveEditBtn.disabled = true;
    editMessage.style.display = 'none';
    editMessage.classList.remove('alert-success', 'alert-danger', 'alert-warning');
    editProgressBarArea.innerHTML = ''; // Clear progress
    editUploadProgressContainer.style.display = 'block';

    const productId = editProductIdInput.value;
    const existingProduct = allManageProducts.find(p => p.id === productId);
    if (!existingProduct) {
        editMessage.textContent = "Product not found for update.";
        editMessage.className = 'mt-2 alert alert-danger';
        editMessage.style.display = 'block';
        saveEditBtn.disabled = false;
        return;
    }

    // Get current images displayed (these are the ones remaining after any removals from the UI)
    // IMPORTANT: This assumes the images in `currentImagesPreview` are the ones to KEEP.
    let updatedImageUrls = Array.from(currentImagesPreview.querySelectorAll('img')).map(img => img.src);

    const newImages = editProductImagesInput.files;
    let newUploadSuccess = true;

    // Upload new images
    for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];
        const fileName = file.name;
        // MODIFIED: Aligning storage path with your working Firebase Storage Rules
        const storagePath = `artifacts/${appId}/public/images/${editProductCategorySelect.value}/${Date.now()}_${fileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        // Re-enabling progress bar UI updates
        const { progressBar, statusText } = createProgressBar(fileName, editProgressBarArea);

        await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload of new image ${fileName} is ${Math.round(progress)}% done`);
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
                    updatedImageUrls.push(downloadURL); // Add new URL to the list
                    console.log(`Upload of new image ${fileName} complete! Download URL: ${downloadURL}`);
                    statusText.textContent = `Complete!`;
                    progressBar.classList.remove('bg-info');
                    progressBar.classList.add('bg-success');
                    resolve();
                }
            );
        });
    }

    if (!newUploadSuccess && newImages.length > 0) {
        editMessage.textContent = "Some new images failed to upload. Product might not be fully updated.";
        editMessage.className = 'mt-2 alert alert-warning';
        editMessage.style.display = 'block';
        saveEditBtn.disabled = false;
        // Proceed with saving other product data and already successfully uploaded images
    }

    try {
        const productRef = doc(db, `artifacts/${appId}/public/data/products`, productId);

        const updatedData = {
            name: editProductNameInput.value,
            description: editProductDescriptionTextarea.value,
            category: editProductCategorySelect.value,
            price: parseFloat(editProductPriceInput.value),
            currency: editProductCurrencySelect.value,
            imageUrls: updatedImageUrls, // Save the combined list of image URLs
            imageUrl: updatedImageUrls[0] || '', // Update primary image to the first in the list
            lastUpdated: serverTimestamp() // Add a last updated timestamp
        };

        await updateDoc(productRef, updatedData);

        editMessage.textContent = "Product updated successfully!";
        editMessage.className = 'mt-2 alert alert-success';
        editMessage.style.display = 'block';

        await fetchAndDisplayProductsForManagement();

        setTimeout(() => {
            editProductModal.hide();
        }, 1500);

    } catch (error) {
        console.error("Error updating product:", error);
        editMessage.textContent = "Error updating product: " + error.message;
        editMessage.className = 'mt-2 alert alert-danger';
        editMessage.style.display = 'block';
    } finally {
        saveEditBtn.disabled = false;
        setTimeout(() => {
            editUploadProgressContainer.style.display = 'none';
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

        const imagesToDelete = productToDelete.imageUrls && Array.isArray(productToDelete.imageUrls)
            ? productToDelete.imageUrls
            : (productToDelete.imageUrl ? [productToDelete.imageUrl] : []);

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

        await deleteDoc(productRef);
        console.log("Product document deleted successfully:", productId);

        allManageProducts = allManageProducts.filter(p => p.id !== productId);
        renderManageProducts();

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
