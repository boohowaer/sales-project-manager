-- 为用户设置表添加关注节点提醒天数字段
ALTER TABLE user_settings
ADD COLUMN milestone_reminder_days INTEGER DEFAULT 7;

COMMENT ON COLUMN user_settings.milestone_reminder_days IS '信息提醒面板中关注节点的提前提醒天数';
