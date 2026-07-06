# 日本麻将快速算分

一个基于 Flask 和 `mahjong` Python 库的日本麻将（立直麻将）快速算分工具。项目提供中文 Web 界面，可输入手牌、副露、场况、宝牌和役种相关选项，并返回番数、符数、役种、点数和符数明细。

## 功能特性

- 通过牌图点击录入手牌、和牌牌、副露、宝牌指示牌和里宝牌指示牌
- 支持荣和/自摸、庄家、场风、自风、本场数等场况设置
- 支持立直、双立直、一发、海底、河底、岭上、抢杠、天和、地和、人和等状态选项
- 支持吃、碰、明杠、暗杠和加杠
- 支持食断、红宝牌、宝牌指示牌、里宝牌指示牌和手动宝牌数量
- 展示番数、符数、役种、点数以及符数明细
- 支持“对局”模式：创建房间、4 人选位开局、记录立直供托、结算后自动扣点并推进本场/场风/庄家

## 环境要求

- Python 3.10 或更高版本
- pip

## 安装依赖

建议先创建并启用虚拟环境：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

安装项目依赖：

```powershell
pip install -r requirements.txt
```

## 启动项目

```bash
python app.py
```

服务默认监听 `0.0.0.0:5000`。启动后在浏览器访问：

```text
http://127.0.0.1:5000/
```

## Docker 镜像

构建镜像：

```bash
docker build -t thirteen-orphans:fc .
```

本地运行：

```bash
docker run --rm -p 9000:9000 -e PORT=9000 thirteen-orphans:fc
```

启动后访问：

```text
http://127.0.0.1:9000/
```

镜像默认使用 1 个 gunicorn worker。房间状态保存在当前 Python 进程内，不要把 `GUNICORN_WORKERS`
调大；如果需要多进程或多实例部署，需要先把房间状态迁到 Redis、数据库等共享存储。

## 部署到阿里云函数计算 FC

先推送镜像到阿里云容器镜像服务 ACR。下面命令里的地域、命名空间、仓库名按你的账号实际替换：

```bash
export REGION=cn-hangzhou
export NAMESPACE=your-namespace
export REPO=thirteen-orphans
export VERSION=$(date +%Y%m%d%H%M%S)
export IMAGE=registry.${REGION}.aliyuncs.com/${NAMESPACE}/${REPO}:${VERSION}

docker login --username=your-aliyun-account registry.${REGION}.aliyuncs.com
docker tag thirteen-orphans:fc "$IMAGE"
docker push "$IMAGE"
```

在函数计算 FC 控制台创建函数时选择“容器镜像 / 自定义容器”，镜像地址填 `$IMAGE`。
容器监听端口填 `9000`；如果控制台里额外配置了环境变量 `PORT`，也保持为 `9000`。

为了适配当前实现，建议先这样配置：

- 最小实例数：`0`，不玩的时候不常驻，按量计费。
- 最大实例数：`1`，避免同一房间被分到多个实例导致内存状态不一致。
- 单实例并发：`10` 左右，4 人同时操作够用。
- 触发器：HTTP 触发器，路径使用默认即可。

注意：FC 缩容、冷启动或实例重建后，内存里的房间会清空；容器内 `records/` 写出的 CSV 也不适合作为长期存储。
如果要做到“按量启动但对局不丢”，下一步应把房间状态保存到 Redis/Tair、数据库或 OSS/NAS。

## 使用说明

1. 在底部牌图区域点击牌，录入当前手牌。
2. 点击手牌中的牌可删除；计算前需要选择和牌牌。
3. 切换到“副露”后，选择 3 张牌会自动识别吃/碰；选择 4 张相同牌时可选择杠类型。
4. 在“场况与宝牌”中设置和牌方式、场风、自风、本场数、役种状态和宝牌。
5. 点击“计算”查看番数、符数、役种、点数和符数明细。

## 对局模式

点击顶部“对局”进入房间模式：

1. 输入玩家名并创建房间；其他人打开同一页面后可以在房间列表中加入，加入前必须填写玩家名。
2. 进入房间后选择东、南、西、北位置，4 个位置坐满后点击“开始对局”。测试时可以点击“加入测试玩家”自动补入测试玩家。
3. 开局后页面显示四个位置的点数、庄家、场风、本场和供托。
4. 有人立直时点击对应位置的“立直”，系统会扣 1000 点并增加 1 根供托。
5. 一局结束后点击赢家位置的“录入和牌”，按原算分方式录入手牌并点击“结算”，再选择“自摸”或放铳者。
6. 页面会先显示每家需要支付的点数；点击“确定扣分”后更新点数，并自动推进本场、场风和庄家。
7. 对局页会显示当前房间的胡牌记录；如果刚录入的胡牌有误，可以点击“撤销本次胡牌”恢复到该次胡牌前的点数、供托、立直和场况。

胡牌记录会写入 `records/房间名-yymmddhhmmss.csv`。房间实时状态仍保存在当前 Flask 进程内，服务重启后会清空。`scripts/install-service.sh`
默认使用 1 个 gunicorn worker；如果要改成多进程部署，需要先把房间状态迁到 Redis、数据库等共享存储。

## 项目结构

```text
.
├── app.py              # Flask 应用入口和算分 API
├── requirements.txt    # Python 依赖
├── static/
│   ├── index.html      # Web 页面结构
│   ├── app.js          # 前端交互逻辑
│   └── styles.css      # 页面样式
└── img/                # 麻将牌图资源
```

## API 简述

前端通过 `POST /api/calculate` 提交手牌数据，后端会校验牌数、副露、宝牌和场况参数，并调用 `mahjong.hand_calculating.HandCalculator` 计算结果。

成功响应示例字段：

```json
{
  "ok": true,
  "han": 3,
  "fu": 40,
  "cost": {},
  "yaku": [],
  "fuDetails": [],
  "error": null
}
```

错误响应会返回 `ok: false` 和可读的中文错误信息。

## 部署为 Linux 系统服务

项目提供了 `systemd` 安装脚本。脚本会创建或复用项目目录下的
`.venv`，安装依赖，注册服务并立即启动：

```bash
chmod +x scripts/install-service.sh scripts/uninstall-service.sh
sudo ./scripts/install-service.sh
```

安装完成后，服务会随系统开机自动启动，默认监听 `0.0.0.0:5000`。

常用管理命令：

```bash
sudo systemctl status thirteen-orphans
sudo systemctl restart thirteen-orphans
sudo journalctl -u thirteen-orphans -f
```

可以通过环境变量修改安装参数：

```bash
sudo env LISTEN_ADDRESS=127.0.0.1:8000 WORKERS=4 ./scripts/install-service.sh
```

卸载服务：

```bash
sudo ./scripts/uninstall-service.sh
```
