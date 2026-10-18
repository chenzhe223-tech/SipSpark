# 随调 SipSpark

> 随心而调，灵感自来。  
> A small sip. A quiet spark.

随调 SipSpark 是一款从手边现有饮品与食材出发的 AI 即兴调饮轻应用，沿用品牌看板的雾纸白、柚皮粉、鼠尾草绿、墨岩黑与液滴星芒标识。

## 在线页面

- **即兴调饮轻应用：** https://chenzhe223-tech.github.io/SipSpark/app.html
- 品牌理念与视觉看板： https://chenzhe223-tech.github.io/SipSpark/
- 生活灵感图库： https://chenzhe223-tech.github.io/SipSpark/moments.html

## 当前功能

- 无需注册，手机和桌面浏览器均可使用。
- 用户自由描述手边材料、场景、器具条件与风味偏好。
- 调用 Cloudflare Workers AI 文本模型生成三款中英文即兴配方，包含材料用量、制作步骤、风味描述及酒精信息。
- 服务端将识别到的材料清单作为生成白名单，统一毫升用量、校验酒精属性与估算 ABV；制作步骤根据已验证材料生成，避免引入未提供的食材或器具。若模型给英文作品名误带未提供食材，会回退到已识别材料名称。
- 一键生成品牌风格分享卡；用户还可选择生成 AI 写实饮品图片，下载带文字和配方的 PNG 分享图、复制配方或调用系统分享。
- AI 图片只在用户点击“生成 AI 写实图”后调用；不支持文件分享的浏览器会回退到下载图片和复制文字。
- 本地配方规则作为 AI 服务暂不可用时的备用路径。

## 技术结构

- `index.html`：品牌理念与视觉识别看板。
- `app.html`：即兴调饮轻应用及分享卡编辑体验。
- `moments.html`：生活场景图文。
- `worker/index.js`：Cloudflare Worker 后端，提供 `/api/mix` 和 `/api/image`。文本模型为 `@cf/meta/llama-3.2-3b-instruct`；写实配图使用 `@cf/black-forest-labs/flux-1-schnell`。
- `.github/workflows/pages.yml`：发布前检查前端与 Worker 的 JavaScript 语法、验证 AI Worker 健康状态和生成配方接口，再发布品牌页、应用页与图文图库。

后端 AI 模型通过 Worker 的 AI binding 调用，浏览器代码和公开 GitHub 仓库不包含 Cloudflare API token 或第三方模型密钥。Worker 仅允许来自 GitHub Pages 站点的浏览器 Origin，并对公开接口限制请求频率和输入长度。

## 数据与费用说明

无需用户账号。用户点击 AI 配方生成时，所填写的材料、场景和偏好会发送到 Cloudflare Worker 进行推理；点击生图时会发送被选中的配方名称、材料和风味描述。应用不应接收或发送密码、支付资料等敏感信息。当前实现不将用户输入保存到数据库。

Workers AI 提供每日免费 Neurons 配额；超过免费额度后，根据 Cloudflare 当前套餐与用量规则可能需要付费套餐并产生费用。请在部署账户的 Workers AI 仪表板检查实际用量及价格：  
https://developers.cloudflare.com/workers-ai/platform/pricing/

## 能力边界与安全提醒

- 文本配方由真实模型生成，但模型可能出错；后端校验了材料使用范围和酒精类别，制作前仍需检查配方、包装标签与实际用量。
- 酒精度为根据常见酒款度数进行的估算，不是实验室测量值；原酒度数、测量误差和冰块融化都会影响实际数值。
- AI 写实图片由图像模型生成，可能与真实饮品外观或实际配方略有差异。若图片生成服务暂不可用，仍可使用品牌风格的矢量分享卡。
- 请适量饮用，不酒后驾驶；未成年人以及孕期、服药或需保持警觉的人群应选择真正的无酒精饮品。

## 部署

向 `main` 分支提交更改后，GitHub Actions 会执行检查并发布静态页面到 `gh-pages` 分支。Cloudflare Worker 单独部署于 `sipspark-ai.chenzhe223.workers.dev`。
