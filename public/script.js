// public/script.js - Frontend for Red X Session Generator
let currentSessionId = null;

const API_BASE = '/api/session';

// Create a new session
async function createSession() {
    const sessionName = document.getElementById('sessionName').value || `session_${Date.now()}`;
    
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'create',
                sessionId: sessionName
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentSessionId = data.sessionId;
            document.getElementById('sessionIdDisplay').textContent = currentSessionId;
            document.getElementById('sessionInfo').style.display = 'flex';
            document.getElementById('authMethods').style.display = 'block';
            
            updateStatusBadge(data.status);
            
            // Start polling for QR code
            if (data.qr) {
                document.getElementById('qrImage').src = data.qr;
            }
            
            pollSessionStatus(currentSessionId);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error creating session:', error);
        alert('Failed to create session. Check console for details.');
    }
}

// Request pairing code
async function requestPairingCode() {
    if (!currentSessionId) {
        alert('Please create a session first');
        return;
    }
    
    const phoneNumber = document.getElementById('phoneNumber').value;
    
    if (!phoneNumber) {
        alert('Please enter a phone number');
        return;
    }
    
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'pair',
                sessionId: currentSessionId,
                phoneNumber: phoneNumber
            })
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('pairingCode').textContent = data.pairingCode;
            
            // Format instructions
            const instructionsHTML = data.instructions.map(step => 
                `<div>${step}</div>`
            ).join('');
            
            document.getElementById('pairingInstructions').innerHTML = instructionsHTML;
            document.getElementById('pairingCodeResult').style.display = 'block';
            
            updateStatusBadge('pairing_code_ready');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error requesting pairing code:', error);
        alert('Failed to generate pairing code');
    }
}

// Poll session status
async function pollSessionStatus(sessionId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}?action=status&sessionId=${sessionId}`);
            const data = await response.json();
            
            if (data.success) {
                updateStatusBadge(data.status);
                
                document.getElementById('statusDetails').textContent = 
                    JSON.stringify(data, null, 2);
                document.getElementById('sessionStatus').style.display = 'block';
                
                // Update QR if available
                if (data.hasQR) {
                    // Fetch QR separately
                    fetchQR(sessionId);
                }
                
                // Stop polling if connected
                if (data.connected) {
                    clearInterval(pollInterval);
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    }, 3000);
}

// Fetch QR code
async function fetchQR(sessionId) {
    try {
        const response = await fetch(`${API_BASE}?action=qr&sessionId=${sessionId}`);
        const data = await response.json();
        
        if (data.qr) {
            document.getElementById('qrImage').src = data.qr;
        }
    } catch (error) {
        console.error('Error fetching QR:', error);
    }
}

// Update status badge
function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = status.replace('_', ' ').toUpperCase();
    badge.className = 'status-badge ' + status;
}

// Helper to format phone number as user types
document.getElementById('phoneNumber')?.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
});
