# 一起存钱

基于 **uni-app（Vue 3）** 与 **uniCloud（阿里云版）** 的轻量记账应用：单页入口 + 自定义密码与 Token，记录收入、支出与存款，并提供统计视图。

## 功能概览

- **今日记录**：按日查看流水，支持新建收入 / 支出（存款在「存款」Tab 内新增）。
- **统计**：按日 / 周 / 月 / 年查看周期汇总（收入、支出、存款与净额等）。
- **存款**：单独展示存款类记录与总存款。
- **安全**：首次设置访问密码；后续通过云函数 `money-api` 校验 Token，数据表 Schema 中客户端直连读写为关闭，由云函数代理。

## 技术结构

| 部分 | 说明 |
|------|------|
| 前端页面 | `pages/money/index.vue`（见 `pages.json`） |
| 云函数 | `uniCloud-aliyun/cloudfunctions/money-api` |
| 数据库 Schema | `money-settings`、`money-records`（`uniCloud-aliyun/database/*.schema.json`） |
| App 升级弹窗页 | `uni_modules/uni-upgrade-center-app/pages/upgrade-popup`（仅 App 端检查更新时会跳转） |

工程已去掉原 uniCloud 演示页、演示云函数与演示数据表定义，仅保留上述业务所需内容（升级中心所需的 `opendb-app-versions` 索引/初始化数据仍保留在 `database` 中以便与官方升级插件配合）。

## 本地与部署

1. 使用 [HBuilderX](https://www.dcloud.io/hbuilderx.html) 打开本项目，绑定或创建 **uniCloud 阿里云服务空间**。
2. 在云服务空间上传或部署 **`money-api`** 云函数。
3. 上传 **`money-settings`**、**`money-records`** 的 DB Schema（及其他你仍需要的库表定义）。
4. 运行到浏览器（H5）或 App：首页即为记账页「一起存钱」。

`uniCloud-aliyun/database/default.jql` 中提供了在 HBuilderX 内用 JQL 快速查看最近记账记录的示例。

## 仓库说明

若本仓库仍保留 `main` / `alpha` / `dev` 等分支，可与团队约定分别对应 HBuilderX **正式版 / Alpha / 内部 dev** 的联调环境；具体以你们自己的流程为准。
