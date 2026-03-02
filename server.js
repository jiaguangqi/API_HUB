require("dotenv").config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SERVER_IP = process.env.SERVER_IP || 'localhost';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';

// Middleware - 动态CORS配置
const allowedOrigins = [
  `http://localhost:${FRONTEND_PORT}`,
  `http://127.0.0.1:${FRONTEND_PORT}`,
  `http://${SERVER_IP}:${FRONTEND_PORT}`
];

app.use(cors({ 
  origin: function(origin, callback) {
    // 允许无origin的请求（如curl/Postman）
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || SERVER_IP === '*') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
  allowedHeaders: ["Content-Type", "Authorization"], 
  credentials: true 
}));
app.use(express.json());

// Database
let db;

async function initDB() {
  db = await open({
    filename: '/tmp/api-hub-v2.db',
    driver: sqlite3.Database
  });

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_users (
      id TEXT PRIMARY KEY,
      account TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      external_user_key TEXT UNIQUE NOT NULL,
      acc_user_id TEXT,
      default_deduct_account_id TEXT,
      binding_status TEXT DEFAULT 'PENDING',
      role_code TEXT DEFAULT 'user',
      status TEXT DEFAULT 'ENABLED',
      group_name TEXT DEFAULT 'default',
      quota INTEGER DEFAULT 0,
      used_quota INTEGER DEFAULT 0,
      invite_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create channels table (V2 with priority, weight, multi-key)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type INTEGER DEFAULT 0,
      key TEXT NOT NULL,
      keys TEXT,
      protocol_type TEXT DEFAULT 'OPENAI_COMPATIBLE',
      base_url TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      model_source_type TEXT DEFAULT 'SYNC',
      status INTEGER DEFAULT 1,
      weight INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      response_time INTEGER DEFAULT 0,
      balance REAL DEFAULT 0,
      balance_updated_time INTEGER DEFAULT 0,
      models TEXT,
      model_mapping TEXT,
      group_name TEXT DEFAULT 'default',
      test_model TEXT,
      test_time INTEGER DEFAULT 0,
      auto_ban INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create channel abilities table (for model routing)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_abilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      model TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      weight INTEGER DEFAULT 1,
      UNIQUE(channel_id, model)
    );
  `);

  // Create models table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_models (
      id TEXT PRIMARY KEY,
      model_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      source_channel TEXT,
      type TEXT DEFAULT 'TEXT',
      tags TEXT,
      description TEXT,
      input_price REAL DEFAULT 0,
      output_price REAL DEFAULT 0,
      enabled_status TEXT DEFAULT 'ENABLED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Add tags column if not exists (for existing databases)
  try {
    await db.run('ALTER TABLE inf_models ADD COLUMN tags TEXT');
  } catch (e) {
    // Column already exists
  }

  // Add rate column to inf_channels if not exists (for existing databases)
  try {
    await db.run('ALTER TABLE inf_channels ADD COLUMN rate REAL DEFAULT 1.0');
  } catch (e) {
    // Column already exists
  }

  // Create payment settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_payment_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      yipay_url TEXT,
      yipay_merchant_id TEXT,
      yipay_merchant_key TEXT,
      callback_url TEXT,
      min_topup INTEGER DEFAULT 10,
      group_rates TEXT DEFAULT '{"default": 1, "svip": 1, "vip": 1}',
      payment_methods TEXT DEFAULT '[{"color":"blue","name":"支付宝","type":"alipay"},{"color":"green","name":"微信","type":"wxpay"}]',
      topup_options TEXT DEFAULT '[10, 20, 50, 100, 200, 500]',
      discount_config TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create site settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_name TEXT DEFAULT 'AI API Hub',
      site_desc TEXT DEFAULT '大模型 API 管理平台',
      logo_url TEXT,
      favicon_url TEXT,
      footer TEXT DEFAULT '© 2024 AI API Hub. All rights reserved.',
      register_enabled INTEGER DEFAULT 1,
      email_verify INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Remove exchange_rate column if exists
  try {
    await db.run('ALTER TABLE inf_payment_settings DROP COLUMN exchange_rate');
  } catch (e) {
    // Column doesn't exist
  }

  // Create topup orders table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_topup_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      amount_usd REAL NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'PENDING',
      trade_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    );
  `);

  // Create logs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      user_id TEXT,
      model TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      status INTEGER DEFAULT 1,
      response_time INTEGER DEFAULT 0,
      ip TEXT,
      request_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create orders table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create user_api_keys table (for personal center)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      api_key_masked TEXT NOT NULL,
      status TEXT DEFAULT 'ENABLED',
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES inf_users(id)
    )
  `).catch(() => {});

  // Create playground_usage table (for trial experience tracking)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playground_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      usage_type TEXT DEFAULT 'chat',
      usage_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  // Create settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inf_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create default admin
  const admin = await db.get('SELECT * FROM inf_users WHERE account = ?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync('password', 10);
    const id = uuidv4();
    await db.run(`
      INSERT INTO inf_users (id, account, name, password_hash, external_user_key, binding_status, role_code, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, 'admin', '系统管理员', hash, 'inf_admin_default', 'SUCCESS', 'admin', 'ENABLED']);
    console.log('Default admin created: admin / password');
  }

  // Create sample channels if none exist
  const channelCount = await db.get('SELECT COUNT(*) as count FROM inf_channels');
  if (channelCount.count === 0) {
    const channelId = uuidv4();
    await db.run(`
      INSERT INTO inf_channels (id, name, type, key, protocol_type, base_url, secret_key, weight, priority, models)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [channelId, 'OpenAI Official', 1, 'sk-test-key-1\nsk-test-key-2', 'OPENAI_COMPATIBLE', 'https://api.openai.com', 'sk-test', 10, 100, 'gpt-3.5-turbo,gpt-4']);
    
    // Create abilities for channel
    await db.run(`INSERT INTO inf_abilities (channel_id, model, enabled, priority, weight) VALUES (?, ?, 1, 100, 10)`, [channelId, 'gpt-3.5-turbo']);
    await db.run(`INSERT INTO inf_abilities (channel_id, model, enabled, priority, weight) VALUES (?, ?, 1, 90, 10)`, [channelId, 'gpt-4']);
    console.log('Sample channel created');
  }

  // Create sample models if none exist
  const modelCount = await db.get('SELECT COUNT(*) as count FROM inf_models');
  if (modelCount.count === 0) {
    await db.run(`INSERT INTO inf_models (id, model_id, name, type, description, input_price, output_price) VALUES 
      (?, 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'TEXT', '适用于各种任务的高性能模型', 0.0005, 0.0015),
      (?, 'gpt-4', 'GPT-4', 'TEXT', '最先进的模型，强大的推理能力', 0.03, 0.06),
      (?, 'gpt-4-turbo', 'GPT-4 Turbo', 'TEXT', '更快更强', 0.01, 0.03)
    `, [uuidv4(), uuidv4(), uuidv4()]);
    console.log('Sample models created');
  }

  console.log('Database initialized with V2 schema');
}

// Auth middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== Routes ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 'v2.0', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { account, password } = req.body;
    const user = await db.get('SELECT * FROM inf_users WHERE account = ?', [account]);
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'ENABLED') return res.status(401).json({ error: 'User disabled' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { userId: user.id, account: user.account, role: user.role_code },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Record login success
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    await db.run("INSERT INTO login_logs (user_id, account, ip, message, status) VALUES (?, ?, ?, ?, ?)", 
      [user.id, account, ip, "登录成功", "SUCCESS"]).catch(e => console.error("Login log error:", e));
    
    res.json({ token, user: { id: user.id, account: user.account, name: user.name, role_code: user.role_code, status: user.status, binding_status: user.binding_status }});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ userId: req.user.userId, account: req.user.account, role: req.user.role });
});

// ==================== Channel Routes ====================

// Get all channels with pagination
app.get('/api/admin/channels', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, type } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status !== undefined) { whereClause += ' AND status = ?'; params.push(parseInt(status)); }
    if (type !== undefined) { whereClause += ' AND type = ?'; params.push(parseInt(type)); }
    
    const total = await db.get(`SELECT COUNT(*) as count FROM inf_channels ${whereClause}`, params);
    
    const queryParams = [...params, parseInt(pageSize), parseInt(offset)];
    const channels = await db.all(`SELECT * FROM inf_channels ${whereClause} ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?`, queryParams);
    
    // Parse keys for each channel
    channels.forEach(ch => {
      if (ch.keys) {
        ch.key_list = ch.keys.split('\n').filter(k => k.trim());
      } else {
        ch.key_list = ch.key ? [ch.key] : [];
      }
    });
    
    res.json({ data: channels, total: total.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create channel
app.post('/api/admin/channels', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, type = 0, key, keys, protocol_type, base_url, secret_key, weight = 1, priority = 0, models = '', group_name = 'default', test_model, rate = 1.0 } = req.body;
    
    // Validate and set defaults for NOT NULL fields
    const safeBaseUrl = base_url || '';
    const safeSecretKey = secret_key || '';
    
    const id = uuidv4();
    const keyString = keys || key;
    
    await db.run(`
      INSERT INTO inf_channels (id, name, type, key, keys, protocol_type, base_url, secret_key, weight, priority, models, group_name, test_model, status, rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [id, name, type, key, keyString, protocol_type, safeBaseUrl, safeSecretKey, weight, priority, models, group_name, test_model, rate]);
    
    // Create abilities
    if (models) {
      const modelList = models.split(',').map(m => m.trim()).filter(m => m);
      for (const model of modelList) {
        await db.run('INSERT INTO inf_abilities (channel_id, model, enabled, priority, weight) VALUES (?, ?, 1, ?, ?)', [id, model, priority, weight]);
      }
    }
    
    const channel = await db.get('SELECT * FROM inf_channels WHERE id = ?', [id]);
    res.status(201).json(channel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update channel
app.put('/api/admin/channels/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, key, keys, protocol_type, base_url, secret_key, weight, priority, models, group_name, test_model, status, auto_ban, rate } = req.body;
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (key !== undefined) { updates.push('key = ?'); params.push(key); }
    if (keys !== undefined) { updates.push('keys = ?'); params.push(keys); }
    if (protocol_type !== undefined) { updates.push('protocol_type = ?'); params.push(protocol_type); }
    if (base_url !== undefined) { updates.push('base_url = ?'); params.push(base_url); }
    if (secret_key !== undefined) { updates.push('secret_key = ?'); params.push(secret_key); }
    if (weight !== undefined) { updates.push('weight = ?'); params.push(weight); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (models !== undefined) { updates.push('models = ?'); params.push(models); }
    if (group_name !== undefined) { updates.push('group_name = ?'); params.push(group_name); }
    if (test_model !== undefined) { updates.push('test_model = ?'); params.push(test_model); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (auto_ban !== undefined) { updates.push('auto_ban = ?'); params.push(auto_ban); }
    if (rate !== undefined) { updates.push('rate = ?'); params.push(rate); }
    
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    params.push(id);
    await db.run(`UPDATE inf_channels SET ${updates.join(', ')} WHERE id = ?`, params);
    
    // Update abilities if models changed
    if (models) {
      await db.run('DELETE FROM inf_abilities WHERE channel_id = ?', [id]);
      const modelList = models.split(',').map(m => m.trim()).filter(m => m);
      for (const model of modelList) {
        await db.run('INSERT INTO inf_abilities (channel_id, model, enabled, priority, weight) VALUES (?, ?, 1, ?, ?)', [id, model, priority || 0, weight || 1]);
      }
    }
    
    const channel = await db.get('SELECT * FROM inf_channels WHERE id = ?', [id]);
    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get channel abilities
app.get('/api/admin/channels/:id/abilities', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const abilities = await db.all('SELECT * FROM inf_abilities WHERE channel_id = ?', [id]);
    res.json({ data: abilities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete channel
app.delete('/api/admin/channels/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM inf_abilities WHERE channel_id = ?', [id]);
    await db.run('DELETE FROM inf_channels WHERE id = ?', [id]);
    res.json({ message: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test channel connectivity - 真正调用上游API测试
app.post('/api/admin/channels/:id/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await db.get('SELECT * FROM inf_channels WHERE id = ?', [id]);
    
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    
    const startTime = Date.now();
    
    // Validate URL
    try {
      new URL(channel.base_url);
    } catch {
      return res.json({ success: false, error: 'Invalid URL format', response_time: 0 });
    }
    
    // Get first available key
    const keys = channel.keys ? channel.keys.split('\n').filter(k => k.trim()) : [channel.key || channel.secret_key];
    const testKey = keys[0] || '';
    
    if (!testKey) {
      return res.json({ success: false, error: 'No API key available', response_time: 0 });
    }
    
    // Try to call upstream API /v1/models endpoint
    try {
      const https = require('https');
      const http = require('http');
      
      const testUrl = new URL('/v1/models', channel.base_url);
      const client = testUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: testUrl.hostname,
        port: testUrl.port || (testUrl.protocol === 'https:' ? 443 : 80),
        path: testUrl.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      };
      
      const requestPromise = new Promise((resolve, reject) => {
        const request = client.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve({ success: true, status: response.statusCode });
            } else {
              resolve({ success: false, status: response.statusCode, error: `HTTP ${response.statusCode}` });
            }
          });
        });
        
        request.on('error', (error) => reject(error));
        request.on('timeout', () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
        
        request.end();
      });
      
      const result = await requestPromise;
      const responseTime = Date.now() - startTime;
      
      // Update response time in DB
      await db.run('UPDATE inf_channels SET response_time = ?, test_time = ? WHERE id = ?', 
        [responseTime, Math.floor(Date.now() / 1000), id]);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Channel connected successfully', 
          response_time: responseTime,
          status: result.status
        });
      } else {
        res.json({ 
          success: false, 
          error: `API returned status ${result.status}`, 
          response_time: responseTime 
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      res.json({ 
        success: false, 
        error: error.message || 'Connection failed', 
        response_time: responseTime 
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test all channels
app.post('/api/admin/channels/test-all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const channels = await db.all('SELECT * FROM inf_channels WHERE status = 1');
    const results = [];
    
    for (const channel of channels) {
      const startTime = Date.now();
      try {
        new URL(channel.base_url);
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
        const responseTime = Date.now() - startTime;
        await db.run('UPDATE inf_channels SET response_time = ?, test_time = ? WHERE id = ?', [responseTime, Math.floor(Date.now() / 1000), channel.id]);
        results.push({ id: channel.id, name: channel.name, success: true, response_time: responseTime });
      } catch {
        results.push({ id: channel.id, name: channel.name, success: false, error: 'Invalid URL' });
      }
    }
    
    res.json({ results, total: results.length, passed: results.filter(r => r.success).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update channel balance
app.post('/api/admin/channels/:id/balance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { balance } = req.body;
    await db.run('UPDATE inf_channels SET balance = ?, balance_updated_time = ? WHERE id = ?', [balance, Math.floor(Date.now() / 1000), id]);
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Model Routes ====================

// Get all models
app.get('/api/admin/models', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const models = await db.all('SELECT * FROM inf_models ORDER BY created_at DESC');
    res.json({ data: models, total: models.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    const models = await db.all(`SELECT * FROM inf_models WHERE enabled_status = 'ENABLED' ORDER BY name`);
    res.json({ data: models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create model
app.post('/api/admin/models', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { model_id, name, type = 'TEXT', tags, description, input_price = 0, output_price = 0, source_channel = 'Manual' } = req.body;
    const id = uuidv4();
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    await db.run(`INSERT INTO inf_models (id, model_id, name, source_channel, type, tags, description, input_price, output_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [id, model_id, name, source_channel, type, tagsStr, description, input_price, output_price]);
    const model = await db.get('SELECT * FROM inf_models WHERE id = ?', [id]);
    res.status(201).json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update model
app.put('/api/admin/models/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const params = [];
    
    ['name', 'description', 'input_price', 'output_price', 'enabled_status'].forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    });
    
    // Handle tags separately
    if (req.body.tags !== undefined) {
      const tagsStr = Array.isArray(req.body.tags) ? req.body.tags.join(',') : req.body.tags;
      updates.push('tags = ?');
      params.push(tagsStr);
    }
    
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    params.push(id);
    await db.run(`UPDATE inf_models SET ${updates.join(', ')} WHERE id = ?`, params);
    const model = await db.get('SELECT * FROM inf_models WHERE id = ?', [id]);
    res.json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete model
app.delete('/api/admin/models/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM inf_models WHERE id = ?', [id]);
    res.json({ message: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test model connectivity - find a channel that supports this model and test it
app.post('/api/admin/models/:id/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const model = await db.get('SELECT * FROM inf_models WHERE id = ?', [id]);
    
    if (!model) return res.status(404).json({ error: 'Model not found' });
    
    let channel = null;
    let abilitySource = null;
    
    // Method 1: Check inf_abilities table
    const abilities = await db.all('SELECT * FROM inf_abilities WHERE model = ? AND enabled = 1', [model.model_id]);
    if (abilities.length > 0) {
      abilitySource = abilities[0];
      channel = await db.get('SELECT * FROM inf_channels WHERE id = ? AND status = 1', [abilities[0].channel_id]);
    }
    
    // Method 2: If model has source_channel, find that channel
    if (!channel && model.source_channel && model.source_channel !== 'Manual') {
      const channels = await db.all('SELECT * FROM inf_channels WHERE name = ? AND status = 1', [model.source_channel]);
      if (channels.length > 0) {
        channel = channels[0];
      }
    }
    
    // Method 3: Try all active channels, check if model is in their models field
    if (!channel) {
      const allChannels = await db.all('SELECT * FROM inf_channels WHERE status = 1');
      for (const ch of allChannels) {
        if (ch.models && ch.models.includes(model.model_id)) {
          channel = ch;
          break;
        }
      }
    }
    
    // Method 4: Last resort - try any tested channel
    if (!channel) {
      channel = await db.get('SELECT * FROM inf_channels WHERE status = 1 AND response_time > 0 ORDER BY response_time ASC LIMIT 1');
    }
    
    if (!channel) {
      return res.json({ success: false, error: 'No available channel found', response_time: 0 });
    }
    
    if (!channel) {
      return res.json({ success: false, error: 'Channel not available', response_time: 0 });
    }
    
    const startTime = Date.now();
    
    try {
      const https = require('https');
      const http = require('http');
      
      const testUrl = new URL('/v1/models', channel.base_url);
      const client = testUrl.protocol === 'https:' ? https : http;
      
      const key = channel.keys ? channel.keys.split('\n')[0] : channel.key;
      
      const options = {
        hostname: testUrl.hostname,
        port: testUrl.port || (testUrl.protocol === 'https:' ? 443 : 80),
        path: testUrl.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      };
      
      const requestPromise = new Promise((resolve, reject) => {
        const request = client.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const json = JSON.parse(data);
              // Check if the model exists in the response
              const modelExists = json.data && json.data.some(m => m.id === model.model_id);
              if (modelExists) {
                resolve({ success: true, status: response.statusCode });
              } else {
                resolve({ success: false, status: response.statusCode, error: 'Model not found in channel' });
              }
            } catch {
              resolve({ success: false, error: 'Invalid response' });
            }
          });
        });
        
        request.on('error', reject);
        request.on('timeout', () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
        
        request.end();
      });
      
      const result = await requestPromise;
      const responseTime = Date.now() - startTime;
      
      if (result.success) {
        res.json({ success: true, message: 'Model available', response_time: responseTime, channel: channel.name });
      } else {
        res.json({ success: false, error: result.error || 'Model not available', response_time: responseTime });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      res.json({ success: false, error: error.message, response_time: responseTime });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== User Routes ====================

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (keyword) {
      whereClause += ' AND (account LIKE ? OR name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const total = await db.get(`SELECT COUNT(*) as count FROM inf_users ${whereClause}`, params);
    const queryParams = [...params, parseInt(pageSize), parseInt(offset)];
    const users = await db.all(`SELECT * FROM inf_users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, queryParams);
    
    res.json({ data: users, total: total.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { account, name, email, password, role_code = 'user', group_name = 'default', quota = 0 } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const externalKey = 'inf_' + uuidv4();
    
    await db.run(`
      INSERT INTO inf_users (id, account, name, email, password_hash, external_user_key, binding_status, role_code, status, group_name, quota)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, account, name, email, hash, externalKey, 'SUCCESS', role_code, 'ENABLED', group_name, quota]);
    
    const user = await db.get('SELECT * FROM inf_users WHERE id = ?', [id]);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: 'Account already exists' });
  }
});

// Get current user profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, account, name, email, role_code, group_name, quota, used_quota, status FROM inf_users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const params = [];
    
    ['name', 'email', 'role_code', 'group_name', 'quota', 'status'].forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    });
    
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    params.push(id);
    await db.run(`UPDATE inf_users SET ${updates.join(', ')} WHERE id = ?`, params);
    const user = await db.get('SELECT * FROM inf_users WHERE id = ?', [id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM inf_users WHERE id = ?', [id]);
    res.json({ message: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Log Routes ====================

app.get('/api/admin/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, channel_id, user_id, model } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (channel_id) { whereClause += ' AND channel_id = ?'; params.push(channel_id); }
    if (user_id) { whereClause += ' AND user_id = ?'; params.push(user_id); }
    if (model) { whereClause += ' AND model = ?'; params.push(model); }
    
    const total = await db.get(`SELECT COUNT(*) as count FROM inf_logs ${whereClause}`, params);
    const queryParams = [...params, parseInt(pageSize), parseInt(offset)];
    const logs = await db.all(`SELECT * FROM inf_logs ${whereClause} ORDER BY request_at DESC LIMIT ? OFFSET ?`, queryParams);
    
    res.json({ data: logs, total: total.count, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Proxy API ====================

// Helper to build upstream URL
function buildUpstreamUrl(baseUrl, path) {
  // Remove trailing slash from baseUrl
  let url = baseUrl.replace(/\/$/, '');
  // Remove /v1 suffix if present
  url = url.replace(/\/v1$/, '');
  // Add path
  return url + path;
}

// Validate API key or JWT token middleware
const validateApiKeyOrToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing authorization header', type: 'authentication_error' } });
  }

  const token = authHeader.substring(7);

  try {
    // Try JWT token first (for playground)
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { userId: decoded.userId, account: decoded.account, role: decoded.role };
      req.isPlayground = true;
      req.apiKeyId = 'playground-key'; // Set default for logging
      return next();
    } catch (jwtErr) {
      // Not a JWT, try API key
    }
    
    // Try API key
    const keyRecord = await db.get('SELECT * FROM user_api_keys WHERE api_key = ? AND status = ?', [token, 'ENABLED']);
    if (!keyRecord) {
      return res.status(401).json({ error: { message: 'Invalid API key or token', type: 'authentication_error' } });
    }

    const user = await db.get('SELECT * FROM inf_users WHERE id = ?', [keyRecord.user_id]);
    if (!user || user.status !== 'ENABLED') {
      return res.status(403).json({ error: { message: 'User disabled', type: 'authentication_error' } });
    }

    req.user = { userId: user.id, account: user.account, role: user.role_code };
    req.apiKeyId = keyRecord.id;
    next();
  } catch (err) {
    res.status(500).json({ error: { message: 'Server error', type: 'server_error' } });
  }
};

app.get('/v1/models', validateApiKeyOrToken, async (req, res) => {
  try {
    const models = await db.all(`SELECT model_id as id, name FROM inf_models WHERE enabled_status = 'ENABLED'`);
    res.json({ 
      object: 'list', 
      data: models.map(m => ({ 
        id: m.id, 
        object: 'model', 
        created: Date.now(), 
        owned_by: 'openai' 
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat completions proxy
app.post('/v1/chat/completions', validateApiKeyOrToken, async (req, res) => {
  try {
    const { model, messages, stream = false } = req.body;
    
    // First check inf_models to get source_channel (case-insensitive match)
    let modelInfo = await db.get('SELECT * FROM inf_models WHERE model_id = ? AND enabled_status = ?', [model, 'ENABLED']);
    
    // Try case-insensitive match if exact match not found
    if (!modelInfo) {
      modelInfo = await db.get("SELECT * FROM inf_models WHERE LOWER(model_id) = LOWER(?) AND enabled_status = ?", [model, 'ENABLED']);
    }
    if (!modelInfo) {
      return res.status(404).json({ error: { message: 'Model not found', type: 'invalid_request_error' } });
    }
    
    // Find channel by source_channel
    const channel = await db.get(
      'SELECT * FROM inf_channels WHERE name = ? AND status = 1',
      [modelInfo.source_channel]
    );
    
    if (!channel) {
      return res.status(404).json({ error: { message: 'Channel not available for this model', type: 'invalid_request_error' } });
    }
    
    // Forward request to upstream
    const response = await fetch(buildUpstreamUrl(channel.base_url, '/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + channel.key
      },
      body: JSON.stringify({ model, messages, stream })
    });
    
    const data = await response.json();
    
    // Record usage if successful
    if (data.usage) {
      const inputTokens = data.usage.prompt_tokens || 0;
      const outputTokens = data.usage.completion_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const rate = channel.rate || 1.0;
      
      // Get API key info for complete logging
      let apiKeyMasked = null;
      if (req.apiKeyId && req.apiKeyId !== 'playground-key') {
        const keyInfo = await db.get('SELECT api_key_masked FROM user_api_keys WHERE id = ?', [req.apiKeyId]);
        apiKeyMasked = keyInfo?.api_key_masked || null;
      } else if (req.apiKeyId === 'playground-key') {
        apiKeyMasked = 'playground';
      }
      
      await db.run(
        'INSERT INTO api_key_usage_logs (api_key_id, api_key_masked, user_id, model_id, input_tokens, output_tokens, total_tokens, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
        [req.apiKeyId, apiKeyMasked, req.user?.userId || null, model, inputTokens, outputTokens, totalTokens, 0]
      );
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});

// Images generations proxy
app.post('/v1/images/generations', validateApiKeyOrToken, async (req, res) => {
  try {
    const { prompt, size = '1024x1024', n = 1 } = req.body;
    
    // Find image generation channel (use first available)
    const channels = await db.all(
      "SELECT * FROM inf_channels WHERE status = 1 AND (models LIKE '%dall%' OR models LIKE '%image%' OR models LIKE '%绘画%') LIMIT 1"
    );
    
    if (channels.length === 0) {
      return res.status(404).json({ error: { message: 'Image generation not available', type: 'invalid_request_error' } });
    }
    
    const channel = channels[0];
    
    const response = await fetch(buildUpstreamUrl(channel.base_url, '/v1/images/generations'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + channel.key
      },
      body: JSON.stringify({ prompt, size, n })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});

// Audio speech proxy
app.post('/v1/audio/speech', validateApiKeyOrToken, async (req, res) => {
  try {
    const { model = 'tts-1', input, voice = 'alloy' } = req.body;
    
    // Find TTS channel
    const channels = await db.all(
      "SELECT * FROM inf_channels WHERE status = 1 AND (models LIKE '%tts%' OR models LIKE '%audio%' OR models LIKE '%语音%') LIMIT 1"
    );
    
    if (channels.length === 0) {
      return res.status(404).json({ error: { message: 'TTS not available', type: 'invalid_request_error' } });
    }
    
    const channel = channels[0];
    
    const response = await fetch(buildUpstreamUrl(channel.base_url, '/v1/audio/speech'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + channel.key
      },
      body: JSON.stringify({ model, input, voice })
    });
    
    // Stream audio response
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      res.set('Content-Type', 'audio/mpeg');
      res.send(Buffer.from(buffer));
    } else {
      const error = await response.text();
      res.status(response.status).send(error);
    }
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});

// ==================== Playground API ====================

// Check playground usage limit
app.get('/api/playground/check', authMiddleware, async (req, res) => {
  try {
    const { model, type = 'chat' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    
    // Count today's usage for this user and model
    const usage = await db.get(
      'SELECT COUNT(*) as count FROM playground_usage WHERE user_id = ? AND model = ? AND usage_date = ?',
      [req.user.userId, model, today]
    );
    
    const remaining = Math.max(0, 2 - (usage.count || 0));
    res.json({ 
      allowed: remaining > 0, 
      remaining, 
      total: 2,
      message: remaining > 0 ? `今日还可体验 ${remaining} 次` : '今日体验次数已达上限（2次/天）'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record playground usage
app.post('/api/playground/record', authMiddleware, async (req, res) => {
  try {
    const { model, type = 'chat' } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    await db.run(
      'INSERT INTO playground_usage (user_id, model, usage_type, usage_date) VALUES (?, ?, ?, ?)',
      [req.user.userId, model, type, today]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get playground API key
app.get('/api/playground/key', authMiddleware, async (req, res) => {
  try {
    const keyRecord = await db.get("SELECT api_key FROM user_api_keys WHERE id = 'playground-key'");
    if (!keyRecord) {
      return res.status(404).json({ error: 'Playground key not found' });
    }
    res.json({ apiKey: keyRecord.api_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Settings Routes ====================

// Helper to get setting
async function getSetting(key) {
  const row = await db.get('SELECT value FROM inf_settings WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : null;
}

// Helper to set setting
async function setSetting(key, value) {
  const valueStr = JSON.stringify(value);
  await db.run(`
    INSERT INTO inf_settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now')) 
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `, [key, valueStr]);
}

// Save SMTP settings
app.post('/api/admin/settings/smtp', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { smtp_account, smtp_password, smtp_server, smtp_port, pop3_server, imap_server, smtp_from_name } = req.body;
    const settings = {
      smtp_account,
      smtp_password,
      smtp_server,
      smtp_port,
      pop3_server,
      imap_server,
      smtp_from_name
    };
    await setSetting('smtp', settings);
    res.json({ success: true, message: 'SMTP settings saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get SMTP settings
app.get('/api/admin/settings/smtp', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await getSetting('smtp');
    if (!settings) {
      return res.json({});
    }
    // Return settings without password for security
    const safeSettings = { ...settings };
    delete safeSettings.smtp_password;
    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SMTP settings - accepts config from request body or database
app.post('/api/admin/settings/smtp/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, config } = req.body;
    
    // Use config from request body if provided, otherwise load from database
    let settings = config;
    if (!settings || !settings.smtp_server) {
      settings = await getSetting('smtp');
    }
    
    if (!settings || !settings.smtp_server || !settings.smtp_account) {
      return res.status(400).json({ success: false, error: '请填写SMTP配置信息' });
    }
    
    if (!settings.smtp_password) {
      return res.status(400).json({ success: false, error: '请填写邮箱密码/授权码' });
    }
    
    // Load nodemailer
    const nodemailer = require('nodemailer');
    console.log('Sending email via SMTP:', settings.smtp_server, 'account:', settings.smtp_account, 'to:', email);
    
    const transporter = nodemailer.createTransport({
      host: settings.smtp_server,
      port: parseInt(settings.smtp_port) || 587,
      secure: (parseInt(settings.smtp_port) === 465),
      auth: {
        user: settings.smtp_account,
        pass: settings.smtp_password
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: true,
      logger: true
    });
    
    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified');
    
    const info = await transporter.sendMail({
      from: `"${settings.smtp_from_name || 'AI API Hub'}" <${settings.smtp_account}>`,
      to: email,
      subject: 'SMTP Test Email - AI API Hub',
      text: 'This is a test email from AI API Hub. If you received this email, your SMTP configuration is working correctly.',
      html: `
        <h2>SMTP Configuration Test</h2>
        <p>This is a test email from AI API Hub.</p>
        <p>If you received this email, your SMTP configuration is working correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
      `
    });
    
    console.log('Email sent:', info.messageId);
    
    res.json({ 
      success: true, 
      message: `Test email sent to ${email}`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error('SMTP Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      code: err.code,
      command: err.command
    });
  }
});

// ==================== User Center Routes ====================

function generateApiKey() {
  const crypto = require('crypto');
  return 'sk-' + crypto.randomBytes(24).toString('hex');
}

// Get user's API keys (updated with quota info)
app.get('/api/user/api-keys', authMiddleware, async (req, res) => {
  try {
    const keys = await db.all(
      `SELECT id, name, api_key_masked, status, quota, used_quota, allowed_models, 
              expires_at, created_at, last_used_at 
       FROM user_api_keys 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ data: keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new API key (updated with quota and expiry)
app.post('/api/user/api-keys', authMiddleware, async (req, res) => {
  try {
    const { name, quota = 100, expiry_days = '365', models = 'all' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const id = uuidv4();
    const apiKey = generateApiKey();
    const masked = apiKey.substring(0, 10) + '******' + apiKey.substring(apiKey.length - 4);
    
    // Calculate expiry date
    let expiresAt = null;
    if (expiry_days && expiry_days !== 'never') {
      const days = parseInt(expiry_days);
      if (!isNaN(days)) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }
    }
    
    const quotaValue = quota === -1 ? -1 : parseInt(quota);
    
    await db.run(
      `INSERT INTO user_api_keys (id, user_id, name, api_key, api_key_masked, status, 
        quota, used_quota, expires_at, allowed_models, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, req.user.userId, name, apiKey, masked, 'ENABLED', quotaValue, 0, 
       expiresAt ? expiresAt.toISOString() : null, models]
    );
    
    res.status(201).json({ 
      id, 
      name, 
      api_key: apiKey, 
      api_key_masked: masked, 
      status: 'ENABLED',
      quota: quotaValue,
      used_quota: 0,
      allowed_models: models,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete API key
app.delete('/api/user/api-keys/:id', authMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM user_api_keys WHERE id = ? AND user_id = ?', 
      [req.params.id, req.user.userId]);
    res.json({ message: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update API key status
app.put('/api/user/api-keys/:id', authMiddleware, async (req, res) => {
  try {
    const { name, status } = req.body;
    const updates = []; const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id, req.user.userId);
    await db.run(`UPDATE user_api_keys SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
    const key = await db.get(
      `SELECT id, name, api_key_masked, status, quota, used_quota, allowed_models, 
              expires_at, created_at, last_used_at 
       FROM user_api_keys WHERE id = ?`, 
      [req.params.id]
    );
    res.json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's token usage
app.get('/api/user/usage', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const total = await db.get(
      'SELECT SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens, SUM(cost) as total_cost FROM inf_logs WHERE user_id = ? AND request_at >= ?',
      [req.user.userId, startDate.toISOString()]
    );
    const daily = await db.all(
      `SELECT date(request_at) as date, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens, SUM(cost) as cost, COUNT(*) as request_count FROM inf_logs WHERE user_id = ? AND request_at >= ? GROUP BY date(request_at) ORDER BY date DESC`,
      [req.user.userId, startDate.toISOString()]
    );
    const byModel = await db.all(
      `SELECT model, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens, SUM(total_tokens) as total_tokens, SUM(cost) as cost, COUNT(*) as request_count FROM inf_logs WHERE user_id = ? AND request_at >= ? GROUP BY model ORDER BY total_tokens DESC`,
      [req.user.userId, startDate.toISOString()]
    );
    res.json({ period: `${days}d`, total: { prompt_tokens: total.prompt_tokens || 0, completion_tokens: total.completion_tokens || 0, total_tokens: total.total_tokens || 0, total_cost: total.total_cost || 0 }, daily, by_model: byModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's logs
app.get('/api/user/logs', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const total = await db.get('SELECT COUNT(*) as count FROM inf_logs WHERE user_id = ?', [req.user.userId]);
    const logs = await db.all('SELECT * FROM inf_logs WHERE user_id = ? ORDER BY request_at DESC LIMIT ? OFFSET ?', [req.user.userId, pageSize, offset]);
    res.json({ data: logs, total: total.count, page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wallet info
app.get('/api/user/wallet', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, account, name, quota, used_quota, (quota - used_quota) as balance FROM inf_users WHERE id = ?', [req.user.userId]);
    const orders = await db.all('SELECT * FROM inf_topup_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.user.userId]);
    res.json({ user_id: user.id, account: user.account, name: user.name, quota: user.quota || 0, used_quota: user.used_quota || 0, balance: user.balance || 0, recent_orders: orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create topup order (user)
app.post('/api/user/topup', authMiddleware, async (req, res) => {
  try {
    const { amount, payment_method } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });
    const orderId = uuidv4();
    await db.run('INSERT INTO inf_topup_orders (id, user_id, amount, amount_usd, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)', [orderId, req.user.userId, amount, amount, payment_method, 'PENDING']);
    const order = await db.get('SELECT * FROM inf_topup_orders WHERE id = ?', [orderId]);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Start Server ====================

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`AI API Hub V2 running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});


// Proxy endpoint to fetch models from upstream channel
app.post('/proxy/models', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { base_url, api_key } = req.body;
    
    if (!base_url || !api_key) {
      return res.status(400).json({ error: 'Missing base_url or api_key' });
    }
    
    const https = require('https');
    const http = require('http');
    const url = new URL('/v1/models', base_url);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };
    
    const requestPromise = new Promise((resolve, reject) => {
      const request = client.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve({ error: 'Invalid JSON response' });
          }
        });
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      
      request.end();
    });
    
    const result = await requestPromise;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Payment Settings Routes ====================

// Get payment settings
app.get('/api/admin/settings/payment', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM inf_payment_settings WHERE id = 1');
    if (!settings) {
      return res.json({
        yipay_url: '',
        yipay_merchant_id: '',
        yipay_merchant_key: '',
        callback_url: '',
        min_topup: 10,
        group_rates: '{"default": 1, "svip": 1, "vip": 1}',
        payment_methods: '[{"color":"blue","name":"支付宝","type":"alipay"},{"color":"green","name":"微信","type":"wxpay"}]',
        topup_options: '[10, 20, 50, 100, 200, 500]',
        discount_config: '{}'
      });
    }
    const safeSettings = { ...settings };
    delete safeSettings.yipay_merchant_key;
    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save payment settings
app.post('/api/admin/settings/payment', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      yipay_url, yipay_merchant_id, yipay_merchant_key, callback_url,
      min_topup, group_rates, payment_methods, topup_options, discount_config
    } = req.body;

    await db.run(`
      INSERT INTO inf_payment_settings (id, yipay_url, yipay_merchant_id, yipay_merchant_key, callback_url,
        min_topup, group_rates, payment_methods, topup_options, discount_config, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        yipay_url = excluded.yipay_url, yipay_merchant_id = excluded.yipay_merchant_id,
        yipay_merchant_key = excluded.yipay_merchant_key, callback_url = excluded.callback_url,
        min_topup = excluded.min_topup, group_rates = excluded.group_rates,
        payment_methods = excluded.payment_methods, topup_options = excluded.topup_options,
        discount_config = excluded.discount_config, updated_at = excluded.updated_at
    `, [yipay_url, yipay_merchant_id, yipay_merchant_key, callback_url,
        min_topup, group_rates, payment_methods, topup_options, discount_config]);

    res.json({ success: true, message: '支付设置已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get site settings
app.get('/api/admin/settings/site', authMiddleware, async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM inf_site_settings WHERE id = 1');
    if (!settings) {
      return res.json({
        site_name: 'AI API Hub',
        site_desc: '大模型 API 管理平台',
        logo_url: '',
        favicon_url: '',
        footer: '© 2024 AI API Hub. All rights reserved.',
        register_enabled: true,
        email_verify: false
      });
    }
    res.json({
      site_name: settings.site_name,
      site_desc: settings.site_desc,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      footer: settings.footer,
      register_enabled: !!settings.register_enabled,
      email_verify: !!settings.email_verify
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save site settings
app.post('/api/admin/settings/site', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      site_name, site_desc, logo_url, favicon_url, footer,
      register_enabled, email_verify
    } = req.body;

    await db.run(`
      INSERT INTO inf_site_settings (id, site_name, site_desc, logo_url, favicon_url, footer,
        register_enabled, email_verify, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        site_name = excluded.site_name, site_desc = excluded.site_desc,
        logo_url = excluded.logo_url, favicon_url = excluded.favicon_url,
        footer = excluded.footer, register_enabled = excluded.register_enabled,
        email_verify = excluded.email_verify, updated_at = excluded.updated_at
    `, [site_name, site_desc, logo_url, favicon_url, footer,
        register_enabled ? 1 : 0, email_verify ? 1 : 0]);

    res.json({ success: true, message: '基础设置已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create topup order
app.post('/api/topup/create', authMiddleware, async (req, res) => {
  try {
    const { amount, payment_method } = req.body;
    const userId = req.user.userId;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get payment settings
    const settings = await db.get('SELECT * FROM inf_payment_settings WHERE id = 1');
    if (!settings || !settings.yipay_url) {
      return res.status(400).json({ error: '支付未配置' });
    }

    // Check min topup
    if (settings.min_topup && amount < settings.min_topup) {
      return res.status(400).json({ error: `最低充值金额为 ${settings.min_topup} 元` });
    }

    const orderId = uuidv4();

    // Create order
    await db.run(`
      INSERT INTO inf_topup_orders (id, user_id, amount, payment_method, status, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', datetime('now'))
    `, [orderId, userId, amount, payment_method]);

    // Generate YiPay sign
    const crypto = require('crypto');
    const params = {
      pid: settings.yipay_merchant_id,
      type: payment_method,
      out_trade_no: orderId,
      notify_url: settings.callback_url || `${req.protocol}://${req.get('host')}/api/topup/callback`,
      return_url: `${req.protocol}://${req.get('host')}/topup/success`,
      name: `充值 ${amount}元`,
      money: amount,
      param: userId
    };

    // Sort params and create sign
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + settings.yipay_merchant_key;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex');
    params.sign_type = 'MD5';

    // Build payment URL
    const queryString = new URLSearchParams(params).toString();
    const paymentUrl = `${settings.yipay_url}?${queryString}`;

    res.json({
      success: true,
      order_id: orderId,
      payment_url: paymentUrl,
      amount: amount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YiPay callback
app.post('/api/topup/callback', async (req, res) => {
  try {
    const { out_trade_no, trade_no, trade_status, money, sign, param } = req.body;

    // Verify sign
    const settings = await db.get('SELECT * FROM inf_payment_settings WHERE id = 1');
    if (!settings) {
      return res.status(400).send('fail');
    }

    const params = { ...req.body };
    delete params.sign;
    delete params.sign_type;

    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + settings.yipay_merchant_key;
    const calculatedSign = require('crypto').createHash('md5').update(signStr).digest('hex');

    if (sign !== calculatedSign) {
      return res.status(400).send('fail');
    }

    if (trade_status === 'TRADE_SUCCESS') {
      // Update order status
      await db.run(`
        UPDATE inf_topup_orders 
        SET status = 'SUCCESS', trade_no = ?, paid_at = datetime('now')
        WHERE id = ?
      `, [trade_no, out_trade_no]);

      // Update user quota (1元 = 10000 tokens)
      const order = await db.get('SELECT * FROM inf_topup_orders WHERE id = ?', [out_trade_no]);
      if (order) {
        const tokens = parseFloat(order.amount) * 10000;
        await db.run(`
          UPDATE inf_users SET quota = quota + ? WHERE id = ?
        `, [tokens, order.user_id]);
      }
    }

    res.send('success');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('fail');
  }
});

// Get full API key (for copy)
app.get('/api/user/api-keys/:id/get-key', authMiddleware, async (req, res) => {
  try {
    const key = await db.get(
      'SELECT api_key FROM user_api_keys WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    
    if (!key) {
      return res.status(404).json({ error: 'API Key not found' });
    }
    
    res.json({ api_key: key.api_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==================== Token Usage Statistics API ====================

// Get API Key usage logs for current user
app.get('/api/user/usage-logs', authMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 50, 
      apiKeyId, 
      modelId, 
      startDate, 
      endDate 
    } = req.query;
    
    let sql = `
      SELECT 
        l.id,
        l.api_key_id,
        l.api_key_masked,
        l.model_id,
        l.input_tokens,
        l.output_tokens,
        l.total_tokens,
        l.cost,
        l.note,
        l.created_at
      FROM api_key_usage_logs l
      WHERE l.user_id = ?
    `;
    const params = [req.user.userId];
    
    if (apiKeyId) {
      sql += ' AND l.api_key_id = ?';
      params.push(apiKeyId);
    }
    if (modelId) {
      sql += ' AND l.model_id = ?';
      params.push(modelId);
    }
    if (startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }
    
    // Get total count
    let countSql = sql.replace('SELECT\n        l.id,\n        l.api_key_id,\n        l.api_key_masked,\n        l.model_id,\n        l.input_tokens,\n        l.output_tokens,\n        l.total_tokens,\n        l.cost,\n        l.note,\n        l.created_at\n      FROM api_key_usage_logs l\n      WHERE l.user_id = ?', 'SELECT COUNT(*) as count FROM api_key_usage_logs l WHERE l.user_id = ?');
    
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const logs = await db.all(sql, params);
    
    // Get summary
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_count,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost
      FROM api_key_usage_logs
      WHERE user_id = ?
    `, [req.user.userId]);
    
    res.json({
      data: logs || [],
      summary: {
        total_count: summary?.total_count || 0,
        total_input: summary?.total_input || 0,
        total_output: summary?.total_output || 0,
        total_tokens: summary?.total_tokens || 0,
        total_cost: summary?.total_cost || 0
      },
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: logs?.length || 0
      }
    });
  } catch (err) {
    console.error('Get usage logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Record usage function (for proxy calls)
async function recordUsage(apiKeyId, apiKeyMasked, userId, modelId, inputTokens, outputTokens, cost, note = '') {
  try {
    await db.run(`
      INSERT INTO api_key_usage_logs 
      (api_key_id, api_key_masked, user_id, model_id, input_tokens, output_tokens, total_tokens, cost, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      apiKeyId,
      apiKeyMasked,
      userId,
      modelId,
      inputTokens,
      outputTokens,
      (inputTokens || 0) + (outputTokens || 0),
      cost,
      note
    ]);
  } catch (err) {
    console.error('Record usage error:', err);
  }
}


// ==================== Wallet Management API ====================

// Get user wallet info (balance and topup history)
app.get('/api/user/wallet', authMiddleware, async (req, res) => {
  try {
    // Get user balance
    const user = await db.get(
      'SELECT balance FROM inf_users WHERE id = ?',
      [req.user.userId]
    );
    
    // Get topup history
    const topupHistory = await db.all(
      `SELECT 
        id, 
        amount, 
        payment_method,
        status,
        trade_no,
        created_at,
        paid_at
      FROM inf_topup_orders 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50`,
      [req.user.userId]
    );
    
    // Get consumption history from usage logs
    const consumptionHistory = await db.all(
      `SELECT 
        DATE(created_at) as date,
        SUM(cost) as total_cost,
        COUNT(*) as request_count
      FROM api_key_usage_logs 
      WHERE user_id = ? 
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30`,
      [req.user.userId]
    );
    
    res.json({
      balance: user?.balance || 0,
      topupHistory: topupHistory || [],
      consumptionHistory: consumptionHistory || []
    });
  } catch (err) {
    console.error('Get wallet info error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create topup order
app.post('/api/user/wallet/topup', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentMethod = 'alipay' } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: '充值金额不能小于1元' });
    }
    
    if (amount > 100000) {
      return res.status(400).json({ error: '单次充值不能超过10万元' });
    }
    
    // Generate trade number
    const tradeNo = 'TOPUP' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Create order
    const result = await db.run(
      `INSERT INTO inf_topup_orders 
       (id, user_id, amount, amount_usd, payment_method, status, trade_no, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))`,
      [crypto.randomUUID(), req.user.userId, amount, amount, paymentMethod, tradeNo]
    );
    
    res.json({
      id: result.lastID,
      tradeNo: tradeNo,
      amount: amount,
      paymentMethod: paymentMethod,
      status: 'PENDING',
      payUrl: `${API_URL}/pay/${tradeNo}` // Mock payment URL
    });
  } catch (err) {
    console.error('Create topup order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mock callback for payment (for testing)
app.post('/api/user/wallet/topup/:tradeNo/callback', authMiddleware, async (req, res) => {
  try {
    const { tradeNo } = req.params;
    const { status } = req.body;
    
    if (status !== 'SUCCESS') {
      return res.json({ success: false, message: 'Payment not successful' });
    }
    
    // Get order
    const order = await db.get(
      'SELECT * FROM inf_topup_orders WHERE trade_no = ? AND user_id = ?',
      [tradeNo, req.user.userId]
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status === 'SUCCESS') {
      return res.json({ success: true, message: 'Already paid' });
    }
    
    // Update order status
    await db.run(
      `UPDATE inf_topup_orders 
       SET status = 'SUCCESS', paid_at = datetime('now')
       WHERE trade_no = ?`,
      [tradeNo]
    );
    
    // Update user balance
    await db.run(
      `UPDATE inf_users 
       SET balance = balance + ?
       WHERE id = ?`,
      [order.amount, req.user.userId]
    );
    
    res.json({ success: true, message: 'Payment confirmed', amount: order.amount });
  } catch (err) {
    console.error('Payment callback error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ==================== Payment Integration API ====================

// Get public payment config (for wallet page)
app.get('/api/payment/config', async (req, res) => {
  try {
    const config = await db.get('SELECT * FROM inf_payment_settings LIMIT 1');
    
    if (!config) {
      return res.json({
        enabled: false,
        message: '支付功能暂未配置'
      });
    }
    
    // Return public config (exclude sensitive info)
    res.json({
      enabled: true,
      paymentMethods: JSON.parse(config.payment_methods || '[]'),
      minTopup: config.min_topup || 1,
      topupOptions: JSON.parse(config.topup_options || '[50, 100, 200, 500, 1000]'),
      alipayQr: config.alipay_qr || null,
      wechatQr: config.wechat_qr || null
    });
  } catch (err) {
    console.error('Get payment config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update payment config with QR codes (admin only)
app.put('/api/admin/payment/config', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const { alipayQr, wechatQr, paymentMethods, topupOptions, minTopup } = req.body;
    
    await db.run(`
      UPDATE inf_payment_settings SET
        alipay_qr = ?,
        wechat_qr = ?,
        payment_methods = ?,
        topup_options = ?,
        min_topup = ?,
        updated_at = datetime('now')
      WHERE id = 1
    `, [
      alipayQr || null,
      wechatQr || null,
      JSON.stringify(paymentMethods || []),
      JSON.stringify(topupOptions || [50, 100, 200, 500, 1000]),
      minTopup || 1
    ]);
    
    res.json({ success: true, message: '支付配置已更新' });
  } catch (err) {
    console.error('Update payment config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create topup order with payment method
app.post('/api/user/wallet/topup', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentMethod = 'alipay' } = req.body;
    
    // Get payment config
    const config = await db.get('SELECT * FROM inf_payment_settings LIMIT 1');
    const minTopup = config?.min_topup || 1;
    
    if (!amount || amount < minTopup) {
      return res.status(400).json({ error: `充值金额不能小于${minTopup}元` });
    }
    
    if (amount > 100000) {
      return res.status(400).json({ error: '单次充值不能超过10万元' });
    }
    
    // Generate trade number
    const tradeNo = 'TOPUP' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Create order
    const result = await db.run(
      `INSERT INTO inf_topup_orders 
       (id, user_id, amount, amount_usd, payment_method, status, trade_no, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))`,
      [crypto.randomUUID(), req.user.userId, amount, amount, paymentMethod, tradeNo]
    );
    
    // Get QR code for payment method
    let qrCode = null;
    if (paymentMethod === 'alipay' && config?.alipay_qr) {
      qrCode = config.alipay_qr;
    } else if (paymentMethod === 'wxpay' && config?.wechat_qr) {
      qrCode = config.wechat_qr;
    }
    
    res.json({
      id: result.lastID,
      tradeNo: tradeNo,
      amount: amount,
      paymentMethod: paymentMethod,
      status: 'PENDING',
      qrCode: qrCode,
      message: '请扫描下方二维码完成支付'
    });
  } catch (err) {
    console.error('Create topup order error:', err);
    res.status(500).json({ error: err.message });
  }
});
