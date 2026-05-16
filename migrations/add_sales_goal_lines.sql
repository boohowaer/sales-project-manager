-- 为用户设置表添加保底线和冲刺线字段
ALTER TABLE user_settings
ADD COLUMN sales_goal_base DECIMAL(15,2) DEFAULT NULL;

ALTER TABLE user_settings
ADD COLUMN sales_goal_stretch DECIMAL(15,2) DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN user_settings.sales_goal IS '常规线目标金额（元）';
COMMENT ON COLUMN user_settings.sales_goal_base IS '保底线目标金额（元）';
COMMENT ON COLUMN user_settings.sales_goal_stretch IS '冲刺线目标金额（元）';
