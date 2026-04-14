-- 为用户设置表添加销售目标字段
ALTER TABLE user_settings
ADD COLUMN sales_goal DECIMAL(15,2) DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN user_settings.sales_goal IS '用户的销售目标金额（元）';
