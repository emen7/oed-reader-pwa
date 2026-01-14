// Service Worker Registration
// Add this to app.js init

OEDReaderApp.prototype.registerServiceWorker = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }
};

// Fix the camera stop logic
OEDReaderApp.prototype.switchScreen = function(screenName) {
    // Update nav buttons
    document.querySelectorAll('[data-screen]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');

    // Switch screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${screenName}-screen`).classList.add('active');

    // Special handling for different screens
    if (screenName === 'camera') {
        this.startCamera();
    } else {
        this.stopCamera();
    }
    
    if (screenName === 'collection') {
        this.displayCollection();
    }
};