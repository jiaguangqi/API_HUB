PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
-- Schema-only bootstrap: runtime data, user records and credentials are intentionally excluded.
CREATE TABLE inf_users (
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
    , balance REAL DEFAULT 0);
CREATE TABLE inf_channels (
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
CREATE TABLE inf_abilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      model TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      weight INTEGER DEFAULT 1,
      UNIQUE(channel_id, model)
    );
CREATE TABLE inf_models (
      id TEXT PRIMARY KEY,
      model_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      source_channel TEXT,
      type TEXT DEFAULT 'TEXT',
      description TEXT,
      input_price REAL DEFAULT 0,
      output_price REAL DEFAULT 0,
      enabled_status TEXT DEFAULT 'ENABLED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , tags TEXT);
CREATE TABLE inf_logs (
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
CREATE TABLE inf_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE inf_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE inf_payment_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      yipay_url TEXT,
      yipay_merchant_id TEXT,
      yipay_merchant_key TEXT,
      callback_url TEXT,
      min_topup INTEGER DEFAULT 1,
      group_rates TEXT DEFAULT '{"default": 1, "svip": 1, "vip": 1}',
      payment_methods TEXT DEFAULT '[{"color":"blue","name":"支付宝","type":"alipay"},{"color":"green","name":"微信","type":"wxpay"}]',
      topup_options TEXT DEFAULT '[10, 20, 50, 100, 200, 500]',
      discount_config TEXT DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , alipay_qr TEXT, wechat_qr TEXT);
CREATE TABLE inf_topup_orders (
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
CREATE TABLE inf_site_settings (
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
CREATE TABLE user_api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, api_key TEXT UNIQUE NOT NULL, api_key_masked TEXT NOT NULL, status TEXT DEFAULT "ENABLED", usage_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_used_at DATETIME, quota INTEGER DEFAULT 100, used_quota INTEGER DEFAULT 0, expires_at DATETIME, allowed_models TEXT DEFAULT "all");
CREATE TABLE api_key_usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER, api_key_masked TEXT, user_id INTEGER, model_id TEXT, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, cost REAL, request_type TEXT, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE user_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    bill_type TEXT NOT NULL, -- 'topup' 充值, 'consumption' 消费, 'refund' 退款
    bill_no TEXT NOT NULL, -- 账单编号 TOPUPxxxx 或 USAGExxxx
    amount REAL NOT NULL, -- 金额（充值为正，消费为负）
    balance_before REAL DEFAULT 0, -- 操作前余额
    balance_after REAL DEFAULT 0, -- 操作后余额
    description TEXT, -- 描述
    reference_id TEXT, -- 关联ID（充值订单ID或用量记录ID）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES inf_users(id)
);
CREATE INDEX idx_usage_user ON api_key_usage_logs(user_id);
CREATE INDEX idx_bills_user ON user_bills(user_id);
CREATE INDEX idx_bills_type ON user_bills(bill_type);
CREATE INDEX idx_bills_created ON user_bills(created_at);
COMMIT;
