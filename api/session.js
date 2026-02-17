// api/session.js - Red X Session Generator by Abdul Rehman Rajpoot
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('bailzx');
const qrcode = require('qrcode');
const { PassThrough } = require('stream');

// Store active sessions (in production, use a database)
const activeSessions = new Map();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, sessionId, phoneNumber } = req.body || req.query;

  // Generate a unique session ID if not provided
  const sessionIdentifier = sessionId || `session_${Date.now()}`;

  try {
    switch (action) {
      case 'create':
        return await createSession(sessionIdentifier, res);
      
      case 'pair':
        return await requestPairingCode(sessionIdentifier, phoneNumber, res);
      
      case 'status':
        return await getSessionStatus(sessionIdentifier, res);
      
      case 'destroy':
        return await destroySession(sessionIdentifier, res);
      
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action. Available: create, pair, status, destroy' 
        });
    }
  } catch (error) {
    console.error('Session error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Create a new session and generate QR code
async function createSession(sessionId, res) {
  const { state, saveCreds } = await useMultiFileAuthState(`/tmp/${sessionId}`);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Red X Session', 'Chrome', '1.0.0']
  });

  // Store session info
  activeSessions.set(sessionId, { 
    sock, 
    saveCreds, 
    qr: null,
    status: 'initializing',
    creds: state
  });

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      // Generate QR code as data URL
      const qrDataURL = await qrcode.toDataURL(qr);
      const session = activeSessions.get(sessionId);
      if (session) {
        session.qr = qrDataURL;
        session.status = 'qr_ready';
      }
    }

    if (connection === 'open') {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.status = 'connected';
        session.qr = null;
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        // Attempt reconnect
        setTimeout(() => createSession(sessionId, res), 5000);
      } else {
        activeSessions.delete(sessionId);
      }
    }
  });

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Wait a moment for QR generation
  await new Promise(resolve => setTimeout(resolve, 2000));

  const session = activeSessions.get(sessionId);
  
  return res.json({
    success: true,
    sessionId,
    status: session?.status || 'connecting',
    qr: session?.qr || null,
    message: 'Session created. Use GET /api/session?action=status&sessionId=' + sessionId + ' to check status'
  });
}

// Request pairing code for phone number authentication
async function requestPairingCode(sessionId, phoneNumber, res) {
  if (!phoneNumber) {
    return res.status(400).json({ 
      success: false, 
      error: 'Phone number required' 
    });
  }

  // Clean phone number (remove +, spaces, etc.)
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  
  if (cleanNumber.length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid phone number. Include country code (e.g., 12345678901)' 
    });
  }

  let session = activeSessions.get(sessionId);
  
  if (!session) {
    // Create session first
    const { state, saveCreds } = await useMultiFileAuthState(`/tmp/${sessionId}`);
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Red X Session', 'Chrome', '1.0.0']
    });

    session = { sock, saveCreds, status: 'initializing', creds: state };
    activeSessions.set(sessionId, session);

    sock.ev.on('creds.update', saveCreds);
  }

  try {
    // Request pairing code - this is the key feature!
    // The requestPairingCode method generates an 8-character code [citation:2]
    const pairingCode = await session.sock.requestPairingCode(cleanNumber);
    
    // Format the code nicely (XXXX-XXXX)
    const formattedCode = pairingCode.match(/.{1,4}/g).join('-');
    
    session.status = 'pairing_code_ready';
    session.pairingCode = pairingCode;

    return res.json({
      success: true,
      sessionId,
      phoneNumber: cleanNumber,
      pairingCode: formattedCode,
      rawCode: pairingCode,
      instructions: [
        "1. Open WhatsApp on your phone",
        "2. Go to Settings → Linked Devices",
        "3. Tap 'Link a Device'",
        "4. Select 'Link with phone number instead'",
        "5. Enter this code: " + formattedCode
      ],
      message: "Enter this 8-character code in WhatsApp to connect"
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate pairing code: ' + error.message 
    });
  }
}

// Get session status
async function getSessionStatus(sessionId, res) {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.json({
      success: false,
      sessionId,
      status: 'not_found',
      message: 'Session not found or expired'
    });
  }

  return res.json({
    success: true,
    sessionId,
    status: session.status,
    hasQR: !!session.qr,
    hasPairingCode: !!session.pairingCode,
    connected: session.status === 'connected'
  });
}

// Destroy/Logout session
async function destroySession(sessionId, res) {
  const session = activeSessions.get(sessionId);
  
  if (session && session.sock) {
    try {
      await session.sock.logout();
    } catch (e) {
      // Ignore logout errors
    }
  }
  
  activeSessions.delete(sessionId);
  
  return res.json({
    success: true,
    sessionId,
    message: 'Session destroyed'
  });
}
