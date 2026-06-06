# 项目进展台

面向各类项目的轻量进度管理、工作复盘与汇报展示 App。

## 使用方式

直接双击 `index.html`，即可在浏览器中使用。数据保存在当前浏览器本地，不会上传。

## 功能

- 项目总览：查看投入时间、整体进度、问题数量与今日重点
- 项目列表：分类管理多个项目，编辑项目周期、状态和说明
- 每日记录：选择工作日期，沉淀完成内容、问题、下一步和专注度
- 项目进度：按项目自定义各阶段名称、说明与完成进度
- 问题中心：按优先级和状态推动问题闭环
- 效率分析：查看时间分配、阻塞来源与改进建议
- 周报导出：一键生成 Markdown 格式项目进展周报

## 连接 Supabase 登录与云端同步

1. 登录 Supabase，打开项目的 **SQL Editor**。
2. 新建查询，粘贴并运行 `supabase-schema.sql` 中的全部 SQL。
3. 在 Supabase 项目中打开 **Project Settings → API**。
4. 找到 Project URL 和 Publishable key（旧项目也可使用 anon public key）。
5. 编辑 `supabase-config.js`：

```js
window.SUPABASE_CONFIG = {
  url: "https://你的项目编号.supabase.co",
  publishableKey: "你的 Publishable key"
};
```

6. 在 Supabase 的 **Authentication → URL Configuration** 中设置：
   - Site URL：你的 GitHub Pages 网址
   - Redirect URLs：添加你的 GitHub Pages 网址并在末尾加 `/**`
7. 将 `index.html`、`app.js`、`styles.css`、`supabase-config.js` 上传至 GitHub 仓库。

Publishable key 可以出现在网页前端；不要把 `service_role` key 放进网站文件。

## 数据保存逻辑

- 未登录：保存在当前浏览器的访客本地数据中。
- 已登录：保存在用户独立本地缓存，并自动同步至 Supabase。
- 每个 Supabase 用户只能访问自己的数据，隔离规则由数据库 RLS 策略保护。
