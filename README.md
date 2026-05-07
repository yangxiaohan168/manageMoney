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

## 效果展示

| 今日记录 | 统计 |
| --- | --- |
| ![今日记录](./static/1.png) | ![统计](./static/2.png) |
| 存款 | 人情收支 |
| ![存款](./static/3.png) | ![人情收支](./static/4.png) |

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


