document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = { 
        apiKey: "AIzaSyB_Dj0ihEIiab61qSpS5FV-Ioj9BkAv3R8", 
        authDomain: "nepali-topup-center-9acb2.firebaseapp.com", 
        databaseURL: "https://nepali-topup-center-9acb2-default-rtdb.firebaseio.com", 
        projectId: "nepali-topup-center-9acb2", 
        storageBucket: "nepali-topup-center-9acb2.appspot.com", 
        messagingSenderId: "1005889507452", 
        appId: "1:1005889507452:web:8968836a7beb96c63f39f9", 
        measurementId: "G-JCZY9J3H6R" 
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // --- Element Selections ---
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sideMenu = document.getElementById('side-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');
    const topupForm = document.getElementById('topup-form');
    const profileForm = document.getElementById('profile-form');
    const paymentMethodSelect = document.getElementById('payment-method');
    const paymentFields = document.getElementById('payment-fields-container');
    const bankNameGroup = document.getElementById('bank-name-group');
    const downloadQrBtn = document.getElementById('download-qr-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const goToProfileBtn = document.getElementById('go-to-profile-btn');
    const profileSaveMessage = document.getElementById('profile-save-message');
    const qrCodeImg = document.getElementById('payment-qr-code');
    const whatsappSupportLink = document.getElementById('whatsapp-support-link');
    let countdownInterval = null;

    // --- Event Listeners ---
    hamburgerBtn.addEventListener('click', () => sideMenu.classList.toggle('open'));

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.getAttribute('data-view');
            switchView(viewName);
            sideMenu.classList.remove('open');
            
            // Load data based on the view
            if (viewName === 'new-topup-view') loadCategoriesView();
            if (viewName === 'admin-videos-view') loadAdminVideos();
            if (viewName === 'my-orders-view') loadUserOrders();
            if (viewName === 'offers-view') loadOffersAndCountdown();
        });
    });

    backToHomeBtn.addEventListener('click', () => {
        switchView('new-topup-view');
        loadCategoriesView();
    });

    goToProfileBtn.addEventListener('click', () => switchView('my-profile-view'));

    downloadQrBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(qrCodeImg.src);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'payment-qr.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Could not download QR code.');
        }
    });

    paymentMethodSelect.addEventListener('change', (e) => {
        const method = e.target.value;
        if (method) {
            paymentFields.classList.remove('hidden');
            bankNameGroup.classList.toggle('hidden', method !== 'Bank');
            document.getElementById('bank-name').required = (method === 'Bank');
            qrCodeImg.classList.remove('hidden');
            downloadQrBtn.classList.remove('hidden');
        } else {
            paymentFields.classList.add('hidden');
            qrCodeImg.classList.add('hidden');
            downloadQrBtn.classList.add('hidden');
        }
    });

    topupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userProfile = JSON.parse(localStorage.getItem('userProfile'));
        if (!userProfile || !userProfile.email) {
            switchView('profile-prompt-view');
            return;
        }

        const orderData = {
            playerId: document.getElementById('user-player-id').value,
            packageName: document.getElementById('package-select').value,
            userName: userProfile.name,
            userEmail: userProfile.email,
            paymentDetails: {
                method: paymentMethodSelect.value,
                remark: document.getElementById('payment-remark').value,
                transactionId: document.getElementById('transaction-id').value,
                bankName: paymentMethodSelect.value === 'Bank' ? document.getElementById('bank-name').value : null,
            },
            timestamp: firebase.database.ServerValue.TIMESTAMP,
        };

        db.ref('pendingOrders').push(orderData)
            .then(() => {
                topupForm.reset();
                paymentFields.classList.add('hidden');
                qrCodeImg.classList.add('hidden');
                downloadQrBtn.classList.add('hidden');
                switchView('order-success-view');
            })
            .catch(err => alert('Error submitting order: ' + err.message));
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const profileData = {
            name: document.getElementById('profile-name').value,
            email: document.getElementById('profile-email').value,
            playerId: document.getElementById('profile-player-id').value,
        };
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        profileSaveMessage.textContent = '✅ Profile saved successfully!';
        setTimeout(() => profileSaveMessage.textContent = '', 3000);
    });

    // --- Core Functions ---
    function switchView(viewId) {
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    async function loadCategoriesView() {
        const container = document.getElementById('selection-container');
        container.innerHTML = '<h2>Select a Category</h2><p id="loading-msg">Loading...</p><div class="grid" id="categories-grid"></div>';
        const grid = document.getElementById('categories-grid');
        const loadingMsg = document.getElementById('loading-msg');

        try {
            const snapshot = await db.ref('categories').once('value');
            if (!snapshot.exists()) {
                loadingMsg.textContent = 'No categories available at the moment.';
                return;
            }
            grid.innerHTML = '';
            loadingMsg.classList.add('hidden');
            snapshot.forEach(childSnapshot => {
                const { name, imageUrl } = childSnapshot.val();
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<img src="${imageUrl}" alt="${name}"><div class="info"><h3>${name}</h3></div>`;
                card.onclick = () => loadPackagesView(childSnapshot.key, name);
                grid.appendChild(card);
            });
        } catch (error) {
            loadingMsg.textContent = 'Failed to load categories.';
        }
    }

    async function loadPackagesView(categoryId, categoryName) {
        const container = document.getElementById('selection-container');
        container.innerHTML = `<button id="back-btn" class="btn btn-back">← Back</button><h2>${categoryName}</h2><p id="loading-msg">Loading...</p><div class="grid" id="packages-grid"></div>`;
        document.getElementById('back-btn').onclick = loadCategoriesView;
        const grid = document.getElementById('packages-grid');
        const loadingMsg = document.getElementById('loading-msg');

        try {
            const snapshot = await db.ref(`packages/${categoryId}`).once('value');
            if (!snapshot.exists()) {
                loadingMsg.textContent = 'No packages available in this category.';
                return;
            }
            grid.innerHTML = '';
            loadingMsg.classList.add('hidden');
            snapshot.forEach(childSnapshot => {
                const { name, price, imageUrl, discountPrice } = childSnapshot.val();
                const card = document.createElement('div');
                card.className = 'card';

                let priceHTML = `<p>${price}</p>`;
                if (discountPrice && discountPrice.trim() !== '') {
                    priceHTML = `<p>${discountPrice} <s>${price}</s></p>`;
                }

                card.innerHTML = `<img src="${imageUrl}" alt="${name}"><div class="info"><h3>${name}</h3>${priceHTML}</div>`;
                card.onclick = () => selectPackage(name);
                grid.appendChild(card);
            });
        } catch (error) {
            loadingMsg.textContent = 'Failed to load packages.';
        }
    }

    function selectPackage(packageName) {
        switchView('topup-form-view');
        document.getElementById('package-select').value = packageName;
        const userProfile = JSON.parse(localStorage.getItem('userProfile'));
        if (userProfile && userProfile.playerId) {
            document.getElementById('user-player-id').value = userProfile.playerId;
        }
    }

    function loadProfile() {
        const userProfile = JSON.parse(localStorage.getItem('userProfile'));
        if (userProfile) {
            document.getElementById('profile-name').value = userProfile.name || '';
            document.getElementById('profile-email').value = userProfile.email || '';
            document.getElementById('profile-player-id').value = userProfile.playerId || '';
        }
    }

    async function loadUserOrders() {
        const list = document.getElementById('my-orders-list');
        list.innerHTML = '<p>Loading...</p>';
        const profile = JSON.parse(localStorage.getItem('userProfile'));
        if (!profile || !profile.playerId) {
            list.innerHTML = '<p>Please save your Player ID in your profile to view your orders.</p>';
            return;
        }

        try {
            const pendingSnap = await db.ref('pendingOrders').orderByChild('playerId').equalTo(profile.playerId).once('value');
            const completedSnap = await db.ref('completedOrders').orderByChild('playerId').equalTo(profile.playerId).once('value');

            const pendingOrders = processSnapshot(pendingSnap, 'Pending');
            const completedOrders = processSnapshot(completedSnap, 'Completed');
            const allOrders = [...pendingOrders, ...completedOrders].sort((a, b) => b.timestamp - a.timestamp);

            if (allOrders.length === 0) {
                list.innerHTML = '<p>You have no orders yet.</p>';
                return;
            }

            list.innerHTML = '';
            allOrders.forEach(order => {
                const item = document.createElement('div');
                item.className = `order-item ${order.status.toLowerCase()}`;
                let details = `<p><strong>Package:</strong> ${order.packageName}</p><p><strong>Status:</strong> ${order.status}</p>`;
                if (order.paymentDetails) {
                    details += `<p><strong>Method:</strong> ${order.paymentDetails.method}</p>`;
                    if (order.paymentDetails.bankName) details += `<p><strong>Bank:</strong> ${order.paymentDetails.bankName}</p>`;
                    details += `<p><strong>Remark:</strong> ${order.paymentDetails.remark}</p><p><strong>Transaction ID:</strong> ${order.paymentDetails.transactionId}</p>`;
                }
                item.innerHTML = details;
                list.appendChild(item);
            });
        } catch (error) {
            list.innerHTML = '<p>Could not load your orders.</p>';
        }
    }
    
    const processSnapshot = (snapshot, status) => {
        if (!snapshot.exists()) return [];
        const ordersArray = [];
        snapshot.forEach(child => {
            const order = child.val();
            order.status = status;
            ordersArray.push(order);
        });
        return ordersArray;
    };

    async function loadAdminVideos() { 
        const list = document.getElementById('promo-videos-list-user'); 
        list.innerHTML = '<p>Loading...</p>'; 
        try { 
            const snapshot = await db.ref('promoVideos').once('value'); 
            if (!snapshot.exists()) { 
                list.innerHTML = '<p>No videos available.</p>'; 
                return; 
            } 
            list.innerHTML = ''; 
            snapshot.forEach(child => { 
                const { title, url } = child.val(); 
                const link = document.createElement('a'); 
                link.href = url; 
                link.target = '_blank'; 
                link.className = 'btn'; 
                link.textContent = `Watch: ${title}`; 
                list.appendChild(link); 
            }); 
        } catch (e) { 
            list.innerHTML = '<p>Could not load videos.</p>'; 
        } 
    }

    async function loadOffersAndCountdown() { 
        const offerBanner = document.getElementById('offer-banner');
        const offerImg = document.getElementById('offer-banner-img');
        const offerTitle = document.getElementById('offer-banner-title'); 
        const countdownDisplay = document.getElementById('countdown-display');
        const countdownTitle = document.getElementById('countdown-title');
        const countdownTimer = document.getElementById('countdown-timer'); 
        
        offerBanner.classList.add('hidden'); 
        countdownDisplay.classList.add('hidden'); 

        // Load Offer
        db.ref('offers').limitToLast(1).once('value').then(s => { 
            if (s.exists()) { 
                s.forEach(c => { 
                    const { title, imageUrl } = c.val(); 
                    offerTitle.textContent = title; 
                    offerImg.src = imageUrl; 
                    offerBanner.classList.remove('hidden'); 
                }); 
            } 
        }); 

        // Load Countdown
        if (countdownInterval) clearInterval(countdownInterval); 
        db.ref('countdown').once('value').then(s => { 
            if (s.exists()) { 
                const { title, endDate } = s.val(); 
                countdownTitle.textContent = title; 
                countdownDisplay.classList.remove('hidden'); 
                const endTime = new Date(endDate).getTime(); 

                countdownInterval = setInterval(() => { 
                    const now = new Date().getTime();
                    const distance = endTime - now; 

                    if (distance < 0) { 
                        clearInterval(countdownInterval); 
                        countdownTimer.textContent = "EXPIRED"; 
                        return; 
                    } 
                    
                    const days = Math.floor(distance / 864e5); 
                    const hours = Math.floor((distance % 864e5) / 36e5); 
                    const minutes = Math.floor((distance % 36e5) / 6e4); 
                    const seconds = Math.floor((distance % 6e4) / 1000); 
                    countdownTimer.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`; 
                }, 1000); 
            } 
        }); 
    }

    async function loadSiteSettings() { 
        const snapshot = await db.ref('settings').once('value'); 
        if(snapshot.exists()){ 
            const { whatsappNumber, qrCodeUrl } = snapshot.val(); 
            if(whatsappNumber) whatsappSupportLink.href = `https://wa.me/${whatsappNumber}`; 
            if(qrCodeUrl) qrCodeImg.src = qrCodeUrl; 
        } 
    }
    
    // --- Initial Load ---
    function initializeApp() {
        loadSiteSettings();
        loadCategoriesView();
        loadProfile();
        switchView('new-topup-view');
    }

    initializeApp();
});
