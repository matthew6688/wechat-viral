-- AI Customer Service Configuration Table
-- Stores settings for the AI agent customer service integration with n8n

CREATE TABLE IF NOT EXISTS ai_customer_service_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  n8n_webhook_url TEXT,
  timeout_ms INTEGER NOT NULL DEFAULT 4500,
  transfer_keywords TEXT[] DEFAULT ARRAY['转人工', '人工客服', '找客服']::TEXT[],
  fallback_message TEXT DEFAULT '抱歉，系统繁忙，请稍后再试或回复"转人工"联系客服。',
  transfer_message TEXT DEFAULT '正在为您转接人工客服，请稍候...',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment
COMMENT ON TABLE ai_customer_service_config IS 'AI customer service configuration for n8n webhook integration';
COMMENT ON COLUMN ai_customer_service_config.enabled IS 'Whether AI customer service is enabled';
COMMENT ON COLUMN ai_customer_service_config.n8n_webhook_url IS 'The n8n webhook URL to forward messages to';
COMMENT ON COLUMN ai_customer_service_config.timeout_ms IS 'Timeout for n8n webhook calls (default 4500ms to stay under WeChat 5s limit)';
COMMENT ON COLUMN ai_customer_service_config.transfer_keywords IS 'Keywords that trigger transfer to human service';
COMMENT ON COLUMN ai_customer_service_config.fallback_message IS 'Message sent when AI fails to respond';
COMMENT ON COLUMN ai_customer_service_config.transfer_message IS 'Message sent before transferring to human service';

-- Insert default config row (singleton pattern)
INSERT INTO ai_customer_service_config (id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (id) DO NOTHING;
