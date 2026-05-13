# 一起存钱

一个基于 **uni-app（Vue 3）+ uniCloud（阿里云）** 的轻量记账应用，面向日常收支、存款记录和人情往来管理。前端主要发布为 H5，后端通过 uniCloud 云函数读写云数据库，无需自建服务器。

## 效果展示

| 今日记录 | 统计 |
| --- | --- |
| ![今日记录](./static/1.png) | ![统计](./static/2.png) |
| 存款 | 人情收支 |
| ![存款](./static/3.png) | ![人情收支](./static/4.png) |

本地预览地址示例：

```text
http://localhost:5173/h5/
```

## 功能介绍

### 账本登录

- 首次访问时设置管理密码。
- 密码使用盐值哈希后保存到 `money-settings` 集合。
- 登录后会在本机缓存访问 token，token 过期或校验失败时需要重新输入密码。

### 今日记录

- 展示指定日期的收入、支出和当日净额。
- 支持新增收入/支出记录，填写记录名、金额、日期时间和备注。
- 支持前一天、后一天、日期选择和回到今天。
- 支持分页加载、下拉刷新、左滑编辑和左滑删除。

### 统计

- 支持按日、周、月、年查看周期汇总。
- 汇总周期收入、周期支出、周期存款和周期净额。
- 周期净额按 `收入 - 支出` 计算，存款单独统计，不计入净额。
- 使用图表展示最近 10 天收入/支出走势。

### 存款

- 存款记录独立成页，便于和日常收支分开查看。
- 支持新增存款、分页加载、编辑和删除。
- 展示累计总存款。

### 人情收支

- 支持记录收礼、送礼两类人情往来。
- 支持按朋友管理人情记录，朋友可新增、编辑、删除。
- 人情首页展示收礼总额、送礼总额和净额。
- 点击朋友可进入朋友详情页，查看该朋友的全部人情明细。

### 数据与权限

- 主要数据集合：
  - `money-settings`：管理密码与 token 版本配置。
  - `money-records`：日常收入、支出、存款记录。
  - `money-friends`：朋友信息。
  - `money-human-records`：人情收支记录。
- 数据库 Schema 中默认关闭客户端直连增删改查，业务数据统一通过 `money-api` 云函数处理。
- 金额在数据库中以“分”为单位保存，展示时转换为元。



## 技术栈

- uni-app
- Vue 3
- uniCloud 阿里云服务空间
- uniCloud 云函数 `money-api`
- uniCloud 云数据库 Schema
- qiun-data-charts 图表组件

## 项目结构

```text
manageMoney
├─ pages/money/index.vue                         # 账本首页：今日记录、统计、存款、人情
├─ pages/money/friend.vue                        # 朋友人情明细页
├─ uniCloud-aliyun/cloudfunctions/money-api/     # 账本业务云函数
├─ uniCloud-aliyun/database/                     # 账本数据库 Schema
├─ uni_modules/                                  # uni-app 插件模块
├─ static/                                       # README 截图和静态资源
├─ manifest.json                                 # H5 路由 base 为 /h5/
└─ pages.json                                    # 页面路由配置
```

## 本地运行

1. 使用 HBuilderX 打开项目根目录。
2. 登录 DCloud 账号。
3. 将 `uniCloud-aliyun` 关联到你的 uniCloud 阿里云服务空间。
4. 确认数据库 Schema 与云函数已部署，或在本地调试时选择连接云端云函数。
5. 在 HBuilderX 中运行到浏览器，访问：

```text
http://localhost:5173/h5/
```

如果浏览器访问路径不是 `/h5/`，需要确认 `manifest.json` 中 H5 路由配置：

```json
{
  "h5": {
    "router": {
      "mode": "history",
      "base": "/h5/"
    }
  }
}
```

## uniCloud 部署方法

下面以 **uniCloud 阿里云服务空间 + HBuilderX + H5 前端网页托管** 为例。

### 1. 准备环境

1. 安装并打开 [HBuilderX](https://www.dcloud.io/hbuilderx.html)。
2. 注册并登录 DCloud 账号。
3. 在 uniCloud 控制台创建一个阿里云服务空间，或使用已有服务空间。
4. 用 HBuilderX 打开本项目。

### 2. 关联服务空间

在 HBuilderX 项目管理器中，右键 `uniCloud-aliyun` 目录，选择关联云服务空间，并绑定到目标阿里云服务空间。

如果项目里已经关联过其他空间，可以重新关联到你自己的服务空间。

### 3. 上传数据库 Schema

右键 `uniCloud-aliyun/database` 目录，选择上传所有 DB Schema；也可以逐个右键上传以下文件：

- `uniCloud-aliyun/database/money-settings.schema.json`
- `uniCloud-aliyun/database/money-records.schema.json`
- `uniCloud-aliyun/database/money-friends.schema.json`
- `uniCloud-aliyun/database/money-human-records.schema.json`

上传后会在云数据库中创建或更新对应集合结构。首次部署不需要手动插入密码数据，第一次打开应用时会引导设置管理密码。

### 4. 部署云函数

右键以下目录，选择上传部署或上传并运行：

```text
uniCloud-aliyun/cloudfunctions/money-api
```

`money-api` 负责登录校验、日常记录、人情记录、朋友管理和统计汇总。后续只要修改了云函数代码，都需要重新上传部署。

### 5. 本地联调

在 HBuilderX 中运行到浏览器后，确认客户端连接的是目标 uniCloud 空间。

若 H5 页面能打开但调用云函数失败，优先检查：

- `uniCloud-aliyun` 是否已关联正确服务空间。
- `money-api` 是否已上传部署成功。
- 数据库 Schema 是否已上传。
- uniCloud 控制台的跨域配置/安全域名是否包含当前访问域名，例如本地调试域名或正式站点域名。

### 6. 发布 H5 到前端网页托管

1. 确认数据库 Schema 和 `money-api` 云函数已经部署完成。
2. 在 HBuilderX 中选择 `发行 -> 网站-PC Web或手机H5`。
3. 在发行配置中选择将编译后的资源部署到 uniCloud 前端网页托管。
4. 选择目标 uniCloud 阿里云服务空间，开始构建并上传。
5. 上传完成后，在 uniCloud 控制台查看前端网页托管访问地址。
6. 如果绑定了自定义域名，按控制台提示完成域名解析、HTTPS 和安全域名配置。

发布后，打开云托管地址访问应用。第一次进入时设置管理密码，即可开始使用。

## 云托管发布示意

| 选择云托管并点击发行 | 发布完成后查看网站链接 |
| --- | --- |
| ![选择云托管并点击发行](./static/6.png) | ![发布完成后查看网站链接](./static/5.png) |



## 参考文档

- [uniCloud 发行](https://doc.dcloud.net.cn/uniCloud/publish.html)
- [云函数/云对象运行方式介绍](https://doc.dcloud.net.cn/uniCloud/rundebug.html)
- [DB Schema 概述](https://doc.dcloud.net.cn/uniCloud/schema.html)
