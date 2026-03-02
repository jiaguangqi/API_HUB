PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
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
INSERT INTO inf_users VALUES('d2dd171f-bccc-4eba-af92-ed8f7a1ba06d','admin','系统管理员',NULL,'$2b$10$oCtxdm3WEUY4DAELIhtmaOCSGVav79Xy7Z.6AJnDvUbrte5ARjoCK','inf_admin_default',NULL,NULL,'SUCCESS','admin','ENABLED','default',0,0,NULL,'2026-02-11 07:03:53',0.0);
INSERT INTO inf_users VALUES('ba4f6618-45f5-4b12-b003-02c29e37ffa3','test1','test1','test1@qq.com','$2b$10$q6tBzOKSVWuTMezfmxdgHuNteCzcDqB/gYp9.y24oCQNu0SLpc85q','inf_f6242314-8875-4778-b37a-25d1b1a6299a',NULL,NULL,'SUCCESS','user','ENABLED','default',10000,0,NULL,'2026-02-11 08:57:16',0.0);
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
INSERT INTO inf_channels VALUES('86a4fd64-e77a-437e-989f-1774bdc5ad7d','云雾',1,'sk-5x6EJaCNn5ROlCvnPoPVQ39iXSchWHQKCmdMFc0YqCVyOIFs','sk-5x6EJaCNn5ROlCvnPoPVQ39iXSchWHQKCmdMFc0YqCVyOIFs','OPENAI_COMPATIBLE','https://yunwu.ai/v1','sk-5x6EJaCNn5ROlCvnPoPVQ39iXSchWHQKCmdMFc0YqCVyOIFs','SYNC',1,10,100,1802,0.0,0,'云雾AI API 提供国内外知名模型',NULL,'default',NULL,1770799105,1,'2026-02-11 07:05:00');
CREATE TABLE inf_abilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      model TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      weight INTEGER DEFAULT 1,
      UNIQUE(channel_id, model)
    );
INSERT INTO inf_abilities VALUES(5,'86a4fd64-e77a-437e-989f-1774bdc5ad7d','云雾AI API 提供国内外知名模型',1,0,1);
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
INSERT INTO inf_models VALUES('b3385c11-25df-467e-a699-43f7c9959da2','gemini-3-flash-preview','gemini-3-flash-preview','云雾','TEXT',NULL,0.0,0.0,'ENABLED','2026-02-11 08:32:57','文本,多模态,语音');
INSERT INTO inf_models VALUES('01301ea0-d025-41d0-8f11-2f99ef0d6fcc','claude-sonnet-4-20250514','claude-sonnet-4-20250514','云雾','TEXT',NULL,0.0,0.0,'ENABLED','2026-02-11 08:32:57','文本,文生图');
INSERT INTO inf_models VALUES('8e32d917-cc45-4be3-93a0-bb3fb4fa4a32','gpt-4o-mini-2024-07-18','gpt-4o-mini-2024-07-18','云雾','TEXT',NULL,0.0,0.0,'ENABLED','2026-02-11 08:32:57','文本,多模态,语音');
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
INSERT INTO inf_settings VALUES('smtp','{"smtp_account":"hpcadmin@163.com","smtp_password":"YAnESUx2YTvCdJnX","smtp_server":"smtp.163.com","smtp_port":"465","pop3_server":"pop.163.com","imap_server":"imap.163.com","smtp_from_name":"AI_API_HUB"}','2026-02-11 10:45:51');
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
INSERT INTO inf_topup_orders VALUES('e0864e2f-68ec-4559-9dd9-afd4c276394c','d2dd171f-bccc-4eba-af92-ed8f7a1ba06d',50.0,50.0,'alipay','PENDING','TOPUP1770901834099HA3X6S','2026-02-12 13:10:34',NULL);
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
INSERT INTO inf_site_settings VALUES(1,'OGAI API Hub','大模型 API 管理平台','','','© 2024 AI API Hub. All rights reserved.',1,0,'2026-02-11 12:22:43');
CREATE TABLE user_api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, api_key TEXT UNIQUE NOT NULL, api_key_masked TEXT NOT NULL, status TEXT DEFAULT "ENABLED", usage_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_used_at DATETIME, quota INTEGER DEFAULT 100, used_quota INTEGER DEFAULT 0, expires_at DATETIME, allowed_models TEXT DEFAULT "all");
INSERT INTO user_api_keys VALUES('139f0ac2-3184-4673-ab2f-00f092fb6207','d2dd171f-bccc-4eba-af92-ed8f7a1ba06d','test1','sk-8f5e061c4f2c0124a17ebb3d88ba67afcad4bf1079a0f599','sk-8f5e061******f599','ENABLED',0,'2026-02-12 06:36:43',NULL,100,0,'2027-02-12T06:36:43.335Z','all');
CREATE TABLE api_key_usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, api_key_id INTEGER, api_key_masked TEXT, user_id INTEGER, model_id TEXT, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, cost REAL, request_type TEXT, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO api_key_usage_logs VALUES(1,1,'sk-8f5e061******f599',1,'gpt-4o-mini-2024-07-18',1500,800,2300,0.050000000000000002775,NULL,'正常调用','2026-02-12 08:35:21');
INSERT INTO api_key_usage_logs VALUES(2,1,'sk-8f5e061******f599',1,'claude-sonnet-4-20250514',2500,1200,3700,0.080000000000000001665,NULL,'代码生成','2026-02-12 08:35:21');
INSERT INTO api_key_usage_logs VALUES(3,1,'sk-8f5e061******f599',1,'gemini-3-flash-preview',2000,500,2500,0.029999999999999998889,NULL,'数据分析','2026-02-12 08:35:21');
INSERT INTO api_key_usage_logs VALUES(4,1,'sk-8f5e061******f599',1,'gpt-4o-mini-2024-07-18',500,300,800,0.020000000000000000416,NULL,'简单查询','2026-02-12 08:35:21');
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
INSERT INTO user_bills VALUES(1,'1','consumption','USAGE1',-0.050000000000000002775,0.0,0.0,'API调用 gpt-4o-mini-2024-07-18','1','2026-02-12 08:35:21');
INSERT INTO user_bills VALUES(2,'1','consumption','USAGE2',-0.080000000000000001665,0.0,0.0,'API调用 claude-sonnet-4-20250514','2','2026-02-12 08:35:21');
INSERT INTO user_bills VALUES(3,'1','consumption','USAGE3',-0.029999999999999998889,0.0,0.0,'API调用 gemini-3-flash-preview','3','2026-02-12 08:35:21');
INSERT INTO user_bills VALUES(4,'1','consumption','USAGE4',-0.020000000000000000416,0.0,0.0,'API调用 gpt-4o-mini-2024-07-18','4','2026-02-12 08:35:21');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('inf_abilities',5);
INSERT INTO sqlite_sequence VALUES('api_key_usage_logs',4);
INSERT INTO sqlite_sequence VALUES('user_bills',4);
CREATE INDEX idx_usage_user ON api_key_usage_logs(user_id);
CREATE INDEX idx_bills_user ON user_bills(user_id);
CREATE INDEX idx_bills_type ON user_bills(bill_type);
CREATE INDEX idx_bills_created ON user_bills(created_at);
COMMIT;
