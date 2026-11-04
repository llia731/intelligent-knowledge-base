# 在内网机器上试运行

这版只验证已经做好的闭环：上传、审核、检索、带引用的问答、权限。不要在这一步安装 OpenSearch，也不要改检索算法。问答若要走内网模型，另说。

## 机器上先看磁盘

`/` 使用率已经很高时，只保留一份代码和一份 `node_modules`。不要把模型权重复制到这台机器。

## 取代码

仓库是私有的。在服务器上用已登录的 `gh`，或带权限的 Git 地址克隆，不要把令牌写进仓库或聊天。

```bash
cd ~
gh repo clone llia731/intelligent-knowledge-base
cd intelligent-knowledge-base
```

若只能下载 GitHub 的 zip，解压后进入目录。zip 里的文件夹名可能带分支后缀。

需要 Node.js 22 或更新版本。可用：

```bash
node -v
```

不够新时，用 NodeSource 或 nvm 安装 22，再执行：

```bash
npm install
npm run dev
```

开发服务监听 `0.0.0.0:8080`。没有 `XAI_API_KEY` 时，问答会退回召回切片，检索和审核仍可用。

## 从自己的电脑打开

服务器本机可先看 `curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/`。

自己的电脑经 SSH 转发后访问本机端口，不要对办公网放开 8080：

```bash
ssh -L 8080:127.0.0.1:8080 liaoluoheng@10.150.150.152
```

然后打开 `http://127.0.0.1:8080/`。

## 交给 opencode 的范围

只做这三件事：

1. 确认 Node 22+、依赖装完、`npm run dev` 能回答 HTTP 200。
2. 缺什么系统包就装什么，不要升级 Ubuntu 大版本，不要清空磁盘上的其他目录。
3. 把访问地址和失败时的最后 30 行日志留下来。

不要接 OpenSearch，不要调用 `172.16.12.3` 上的模型，除非另行要求。
