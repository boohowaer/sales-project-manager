const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 创建客户Excel模板
function createCustomerTemplate() {
  const data = [
    ['客户名称*', '公司名称', '邮箱', '电话', '备注'],
    ['张三', '某某科技有限公司', 'zhangsan@example.com', '+86 138 0000 0001', '重点客户，需要定期跟进'],
    ['李四', 'ABC贸易公司', 'lisi@abc.com', '139-0000-0002', ''],
    ['王五', '', 'wangwu@test.com', '13600000333', '个人客户'],
    ['赵六', 'DEF工业', '', '', '联系电话需要通过公司总机'],
    ['孙七', 'GHI集团', 'sunqi@ghi.com', '+86 21 1234 5678', '集团大客户，有多个项目需求'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '客户导入模板');

  // 设置列宽
  ws['!cols'] = [
    { wch: 20 }, // 客户名称
    { wch: 30 }, // 公司名称
    { wch: 30 }, // 邮箱
    { wch: 20 }, // 电话
    { wch: 40 }, // 备注
  ];

  const outputPath = path.join(__dirname, '../public/templates/customers_template.xlsx');
  XLSX.writeFile(wb, outputPath);
  console.log('客户模板已创建:', outputPath);
}

// 创建项目Excel模板
function createProjectTemplate() {
  const data = [
    ['项目名称*', '客户名称*', '项目描述', '项目状态', '项目金额', '成功概率', '开始日期', '预期关闭日期', '有开工函', '已签署合同', '结算段数', '归属年份'],
    ['企业官网开发', '陈明', '为客户开发响应式企业官网，包含PC端和移动端', 'active', 50000.00, 75, '2026-01-15', '2026-06-30', 'TRUE', 'TRUE', 3, 2026],
    ['ERP系统实施', '李华', 'ERP系统的部署、配置和员工培训', 'active', 120000.00, 60, '2026-02-01', '2026-12-31', 'FALSE', 'TRUE', 5, 2026],
    ['移动应用开发', '王芳', '开发iOS和Android双平台移动应用', 'won', 80000.00, 100, '2026-03-01', '2026-08-31', 'TRUE', 'TRUE', 2, 2026],
    ['数据分析平台', '赵强', '大数据分析与可视化平台开发', 'lost', '', '', '2026-01-01', '2026-03-31', 'FALSE', 'FALSE', 1, 2026],
    ['年度运维服务', '刘伟', 'IT基础设施运维和技术支持服务', 'on_hold', 30000.00, 50, '2026-01-01', '2026-12-31', 'TRUE', 'FALSE', 4, 2026],
    ['电商平台建设', '孙丽', 'B2C电商平台开发，包含支付和物流集成', 'active', 250000.00, 80, '2026-04-01', '2027-03-31', 'TRUE', 'TRUE', 6, 2026],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '项目导入模板');

  // 设置列宽
  ws['!cols'] = [
    { wch: 25 }, // 项目名称
    { wch: 20 }, // 客户名称
    { wch: 40 }, // 项目描述
    { wch: 12 }, // 项目状态
    { wch: 12 }, // 项目金额
    { wch: 10 }, // 成功概率
    { wch: 15 }, // 开始日期
    { wch: 15 }, // 预期关闭日期
    { wch: 10 }, // 有开工函
    { wch: 12 }, // 已签署合同
    { wch: 10 }, // 结算段数
    { wch: 10 }, // 归属年份
  ];

  const outputPath = path.join(__dirname, '../public/templates/projects_template.xlsx');
  XLSX.writeFile(wb, outputPath);
  console.log('项目模板已创建:', outputPath);
}

// 运行创建函数
console.log('开始创建Excel模板...');
createCustomerTemplate();
createProjectTemplate();
console.log('Excel模板创建完成！');
