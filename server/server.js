const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const backgroundService = require('./services/backgroundService');
console.log('[startup] Background scheduler initialized');

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// mount your route files
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/request', require('./routes/requestRoutes'));
app.use('/api/notification', require('./routes/notificationRoutes'));
app.use('/api/exercise', require('./routes/exerciseRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/employe', require('./routes/employeRoutes'));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));