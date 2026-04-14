# 启动开发服务器

如果遇到模板下载404错误，请确保开发服务器正在运行。

## 启动命令

```bash
npm run dev
```

## 访问模板文件

开发服务器启动后，模板文件可以通过以下链接访问：

- 客户导入模板: http://localhost:3000/templates/customers_template.csv
- 项目导入模板: http://localhost:3000/templates/projects_template.csv
- 模板说明文档: http://localhost:3000/templates/README.md

## 注意事项

1. **确保开发服务器正在运行**：只有在 `npm run dev` 启动后，public目录下的文件才能被访问
2. **清除浏览器缓存**：如果还是显示404，尝试刷新页面或清除缓存
3. **文件已正确放置**：模板文件已位于 `public/templates/` 目录下

## 测试文件访问

在浏览器中直接访问以下链接测试：

- http://localhost:3000/templates/customers_template.csv
- http://localhost:3000/templates/projects_template.csv

如果文件能正常下载，说明配置正确。
