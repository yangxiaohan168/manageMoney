# 一起存钱

一个基于 **uni-app（Vue 3）+ uniCloud（阿里云）** 的轻量记账应用，支持日常记账 + 人情收支管理。

## 功能一览

- 首次使用设置密码，后续直接输入密码登录。
- 今日记录：展示当天收入/支出，支持新增、分页加载。
- 存款记录：单独展示存款，支持新增、分页加载。
- 人情收支：独立主 Tab，展示总计与分页记录。
- 朋友管理：新增/编辑/删除朋友，点击朋友可查看其全部收支明细。
- 记录支持左滑操作：编辑、删除。
- 支持下拉刷新，快速同步最新数据。
- 统计支持：日 / 周 / 月 / 年。
- 周期净额：仅按 `收入 - 支出` 计算（不包含存款）。

## 从 0 到 1 部署指南

### 1. 准备环境

1. 安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)。
2. 注册并登录 DCloud 账号（HBuilderX 内登录）。
3. 准备一个 uniCloud 阿里云服务空间（新建或已有均可）。

### 2. 打开项目并绑定云空间

1. 用 HBuilderX 打开本项目目录。
2. 在项目中为 `uniCloud-aliyun` 绑定目标云服务空间。

### 3. 初始化数据库

在 HBuilderX 的 uniCloud 数据库管理里，上传以下 Schema：

- `uniCloud-aliyun/database/money-settings.schema.json`
- `uniCloud-aliyun/database/money-records.schema.json`
- `uniCloud-aliyun/database/money-friends.schema.json`
- `uniCloud-aliyun/database/money-human-records.schema.json`

### 4. 部署云函数

部署云函数目录：

- `uniCloud-aliyun/cloudfunctions/money-api`

说明：后续如果你修改了云函数代码，需要重新上传/部署一次。

### 5. 配置页面入口

本项目首页为：

- `pages/money/index`
- `pages/money/friend`（朋友收支详情子页面）

`pages.json` 已配置好该入口，通常不需要再改。

### 6. 启动运行

可选择以下任一方式运行：

- 运行到 H5（浏览器）
- 运行到 App（真机/模拟器）

首次进入应用时设置密码，之后即可开始记账。

## 常见部署排查

- 页面空白或接口报错：确认云函数 `money-api` 已成功部署到当前绑定空间。
- 登录失败：确认数据库里 `money-settings` 表结构已正确上传。
- 普通记录无法读写：确认 `money-records`、`money-settings` 已在同一云空间创建。
- 人情或朋友功能报错：确认 `money-friends`、`money-human-records` 已创建，并且 `money-api` 已重新部署。

## 目录说明（精简）

- 页面：`pages/money/index.vue`
- 子页面：`pages/money/friend.vue`
- 云函数：`uniCloud-aliyun/cloudfunctions/money-api/index.js`
- 数据库：`uniCloud-aliyun/database/*.schema.json`

## Git 忽略

已忽略构建目录：

- `unpackage/`
