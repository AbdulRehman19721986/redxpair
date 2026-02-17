# Red X Session Generator

**Created by Abdul Rehman Rajpoot** for educational purposes.

A WhatsApp multi-device session generator that supports both QR code and phone number pairing methods. Built with Node.js and the bailzx library.

## 🌟 Features

- 🔐 **QR Code Authentication**: Traditional QR code scanning
- 📱 **Phone Number Pairing**: Connect using just your phone number
- 🔄 **Session Management**: Create, monitor, and destroy sessions
- 🌐 **Web Interface**: User-friendly UI for all operations
- 🚀 **Vercel Deployed**: Serverless architecture for scalability

## 🧪 How It Works

This tool uses the WhatsApp Web Multi-Device API to create authenticated sessions. When you use the phone number method, it generates an 8-character code that you enter in WhatsApp to pair your device [citation:2].

## ⚠️ Educational Disclaimer

This project is for **educational purposes only**. It demonstrates:

- WebSocket communication with WhatsApp's servers
- Session management and persistence
- QR code generation and processing
- Serverless deployment with Vercel

**Not intended for spam, automation, or violating WhatsApp's Terms of Service.**

## 🚀 Deployment on Vercel

1. Fork this repository
2. Connect to Vercel
3. Deploy!

## 🛠️ Local Development

```bash
npm install
npm run dev
