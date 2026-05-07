# 一起存钱

一个基于 **uni-app（Vue 3）+ uniCloud（阿里云）** 的极简记账应用，支持收入、支出、存款管理。

## 当前功能

- 密码仅首次设置一次，后续只需登录校验。
- 今日记录与存款记录均支持分页（每页 10 条）与“加载更多”。
- 记录卡片支持左滑操作：**编辑**、**删除**。
- 支持下拉刷新（刷新统计与列表数据）。
- 统计支持日 / 周 / 月 / 年。
- 周期净额计算规则：`收入 - 支出`（不计入存款）。

## 项目结构

- 前端页面：`pages/money/index.vue`
- 云函数：`uniCloud-aliyun/cloudfunctions/money-api/index.js`
- 数据表 Schema：
  - `uniCloud-aliyun/database/money-settings.schema.json`
  - `uniCloud-aliyun/database/money-records.schema.json`
- App 升级弹窗页：`uni_modules/uni-upgrade-center-app/pages/upgrade-popup`

工程已移除大部分模板/demo 页面、demo 云函数与 demo 数据库文件，仅保留当前业务所需内容。

## 云函数 action（money-api）

- `getAuthState`：查询是否已设置密码
- `setupPassword`：首次设置密码
- `login`：密码登录
- `verifyToken`：校验 token
- `createRecord`：新增记录
- `updateRecord`：编辑记录
- `deleteRecord`：删除记录
- `listRecords`：分页查询记录（支持 `page/pageSize/types/startAt/endAt`）
- `getSummary`：汇总统计（全量汇总，不做 1000 条限制）

## 本地运行与部署

1. 用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 打开项目并绑定 uniCloud 阿里云空间。
2. 上传数据库 Schema：`money-settings`、`money-records`。
3. 部署云函数：`money-api`（每次修改后记得重新上传）。
4. 运行到 H5 或 App，入口页面为 `pages/money/index`。

## Git 忽略

已在 `.gitignore` 中忽略：

- `unpackage/`
