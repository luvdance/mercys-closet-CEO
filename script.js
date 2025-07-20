//Firebase SDKs
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

        // Global variables provided by the Canvas environment
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);

        // DOM Elements
        const loginSection = document.getElementById('loginSection');
        const uploadSection = document.getElementById('uploadSection');
        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginMessage = document.getElementById('loginMessage');
        const logoutBtn = document.getElementById('logoutBtn');

        const uploadForm = document.getElementById('uploadForm');
        const productImageInput = document.getElementById('productImage');
        const productNameInput = document.getElementById('productName');
        const productCategorySelect = document.getElementById('productCategory');
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadMessage = document.getElementById('uploadMessage');
        const uploadSpinner = document.getElementById('uploadSpinner');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');

        let currentUser = null; // To store the authenticated user

        // --- Utility Functions ---
        function showMessage(element, message, type) {
            element.textContent = message;
            element.className = `alert mt-3 ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
            element.classList.remove('d-none');
            setTimeout(() => {
                element.classList.add('d-none');
            }, 5000); // Hide after 5 seconds
        }

        function showSpinner(show) {
            uploadSpinner.style.display = show ? 'block' : 'none';
            uploadBtn.disabled = show;
        }

        // --- Authentication Logic ---
        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                loginSection.classList.add('d-none');
                uploadSection.classList.remove('d-none');
                console.log("User is signed in:", user.uid);
            } else {
                currentUser = null;
                loginSection.classList.remove('d-none');
                uploadSection.classList.add('d-none');
                console.log("No user is signed in.");
                // Try to sign in anonymously if no custom token is available
                if (!initialAuthToken) {
                    try {
                        await signInAnonymously(auth);
                        console.log("Signed in anonymously.");
                    } catch (error) {
                        console.error("Error signing in anonymously:", error);
                        showMessage(loginMessage, `Authentication failed: ${error.message}`, 'danger');
                    }
                }
            }
        });

        // Attempt to sign in with custom token if available
        if (initialAuthToken) {
            signInWithCustomToken(auth, initialAuthToken)
                .then(() => {
                    console.log("Signed in with custom token.");
                })
                .catch((error) => {
                    console.error("Error signing in with custom token:", error);
                    showMessage(loginMessage, `Authentication failed: ${error.message}`, 'danger');
                });
        } else {
            // If no initialAuthToken, onAuthStateChanged will handle anonymous sign-in
            console.warn("No __initial_auth_token found. Attempting anonymous sign-in.");
        }


        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                showMessage(loginMessage, 'Login successful!', 'success');
                // UI state will be handled by onAuthStateChanged
            } catch (error) {
                showMessage(loginMessage, `Login failed: ${error.message}`, 'danger');
                console.error("Login error:", error);
            }
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                showMessage(loginMessage, 'Logged out successfully!', 'success');
                // UI state will be handled by onAuthStateChanged
            } catch (error) {
                showMessage(uploadMessage, `Logout failed: ${error.message}`, 'danger');
                console.error("Logout error:", error);
            }
        });

        // --- Image Preview Logic ---
        productImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagePreviewContainer.innerHTML = `<img src="${event.target.result}" alt="Product Preview" class="image-preview">`;
                };
                reader.readAsDataURL(file);
            } else {
                imagePreviewContainer.innerHTML = `<span class="text-muted">Image preview will appear here</span>`;
            }
        });

        // --- Product Upload Logic ---
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                showMessage(uploadMessage, 'You must be logged in to upload products.', 'danger');
                return;
            }

            const imageFile = productImageInput.files[0];
            const productName = productNameInput.value.trim();
            const productCategory = productCategorySelect.value;

            if (!imageFile || !productName || !productCategory) {
                showMessage(uploadMessage, 'Please fill in all fields and select an image.', 'danger');
                return;
            }

            showSpinner(true);
            uploadMessage.classList.add('d-none'); // Hide previous messages

            try {
                // 1. Upload image to Firebase Storage
                const storagePath = `artifacts/${appId}/public/images/${productCategory}/${imageFile.name}_${Date.now()}`;
                const imageRef = ref(storage, storagePath);
                const uploadResult = await uploadBytes(imageRef, imageFile);
                const imageUrl = await getDownloadURL(uploadResult.ref);

                // 2. Save product data to Firestore
                const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);
                await addDoc(productsCollectionRef, {
                    name: productName,
                    category: productCategory,
                    imageUrl: imageUrl,
                    timestamp: serverTimestamp(), // Useful for ordering products
                    uploadedBy: currentUser.uid // Track who uploaded it
                });

                showMessage(uploadMessage, 'Product uploaded successfully!', 'success');
                uploadForm.reset(); // Clear the form
                imagePreviewContainer.innerHTML = `<span class="text-muted">Image preview will appear here</span>`; // Clear preview
                console.log("Product uploaded:", { productName, productCategory, imageUrl });

            } catch (error) {
                showMessage(uploadMessage, `Upload failed: ${error.message}`, 'danger');
                console.error("Upload error:", error);
            } finally {
                showSpinner(false);
            }
        });