# 项目进展台

面向各类项目的轻量进度管理、工作复盘与汇报展示 App。

## 使用方式

直接双击 `index.html`，即可在浏览器中使用。数据保存在当前浏览器本地，不会上传。

## Windows 桌面版

桌面版保留全部项目管理、登录和 Supabase 云端同步功能。本地缓存保存在当前 Windows 用户的应用数据目录。

开发运行：

```powershell
npm.cmd install
npm.cmd run desktop
```

构建 Windows 安装包和便携版：

```powershell
npm.cmd run build:win
```

生成文件位于 `release` 文件夹。将 `.exe` 文件上传到 GitHub Releases 后，网站上的“下载 Windows 版”按钮即可供用户下载。

### Windows 代码签名

公开发布建议使用可信 CA 签发的 Windows 代码签名证书。未签名程序通常会显示“未知发布者”，普通 OV 证书也可能需要逐渐积累 SmartScreen 信誉；EV 证书通常拥有更好的初始信誉。

正式构建前，在当前 PowerShell 会话设置证书：

```powershell
$env:WIN_CSC_LINK = "C:\secure\windows-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD = "证书密码"
npm.cmd run build:win
```

`build:win` 会在缺少签名配置时停止，避免误发布未签名安装包。仅内部测试时可以运行：

```powershell
npm.cmd run build:win:unsigned
```

不要把 `.pfx`、`.p12`、证书密码或 `.env.signing` 上传至 GitHub。

### 使用 GitHub 自动生成签名安装包

仓库已包含 `.github/workflows/release-windows.yml`。没有签名证书时，会生成未签名测试安装包；配置证书后会自动生成签名安装包。

上传全部最新文件后，在 GitHub 仓库中打开：

`Actions → Build Windows app → Run workflow`

构建完成后，在该次工作流页面底部的 **Artifacts** 中下载 `windows-app`。

需要自动发布到 Releases 时，创建并推送形如 `v1.0.0` 的版本标签。

配置代码签名时，在 GitHub 仓库中打开：

`Settings → Secrets and variables → Actions`

添加两个 Repository secret：

- `WIN_CSC_LINK`：PFX 证书的 Base64 内容或安全下载地址
- `WIN_CSC_KEY_PASSWORD`：证书密码

之后创建并推送形如 `v1.0.0` 的版本标签，GitHub Actions 会自动构建并发布签名的安装版与便携版。网站中的“下载 Windows 版”会指向最新 GitHub Release。

没有可信 CA 签发的代码签名证书时，无法真正消除 Windows 的“未知发布者”提示。请勿使用自签名证书面向公众发布。

## 功能

- 项目总览：查看投入时间、整体进度、问题数量与今日重点
- 项目列表：分类管理多个项目，编辑项目周期、状态和说明
- 每日记录：选择工作日期，沉淀完成内容、问题、下一步和专注度
- 项目进度：按项目自定义各阶段名称、说明与完成进度
- 问题中心：按优先级和状态推动问题闭环
- 效率分析：查看时间分配、阻塞来源与改进建议
- 小组协作：创建项目小组、邀请码加入、按用户名邀请、共享项目与监督汇总
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

- 网页版、手机端与 Windows 客户端均必须登录后才能使用或编辑。
- 登录成功后自动读取该账户以前保存的云端数据。
- 已登录数据会保存在用户独立本地缓存，并自动同步至 Supabase。
- 退出登录后应用立即锁定，不能继续查看或编辑项目。
- 每个 Supabase 用户只能访问自己的数据，隔离规则由数据库 RLS 策略保护。
- 个人项目与小组共享项目相互独立，可在“小组协作”页面切换。
- 小组所有者、管理者和普通成员可更新共享项目；监督查看角色只能查看。
- 小组成员共同使用一份共享工作区，工作记录会标记记录者用户名。
