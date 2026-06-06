const fs = require("fs");

const certPath = process.env.WIN_CSC_LINK;
const certPassword = process.env.WIN_CSC_KEY_PASSWORD;

if (!certPath || !certPassword) {
  console.error([
    "",
    "Windows 签名配置缺失，已停止正式安装包构建。",
    "请设置 WIN_CSC_LINK 和 WIN_CSC_KEY_PASSWORD 后重试。",
    "若只需要内部测试，可运行 npm.cmd run build:win:unsigned。",
    ""
  ].join("\n"));
  process.exit(1);
}

if (!certPath.startsWith("http") && !certPath.startsWith("data:") && !fs.existsSync(certPath)) {
  console.error(`找不到签名证书文件：${certPath}`);
  process.exit(1);
}

console.log("已检测到 Windows 代码签名配置，开始构建签名安装包。");
