# Docker 部署指南

## 构建 Docker 镜像

```bash
docker build -t pdf-merge-print .
```

## 运行 Docker 容器

```bash
# 运行容器（端口映射）
docker run -d -p 8080:80 --name pdf-printer pdf-merge-print

# 访问应用
打开浏览器访问: http://localhost:8080
```

## 环境变量配置

```bash
# 可以设置Nginx工作进程数
docker run -d -p 8080:80 -e NGINX_WORKER_PROCESSES=2 --name pdf-printer pdf-merge-print
```

## 持久化存储（可选）

```bash
# 如果需要挂载本地目录
docker run -d -p 8080:80 -v $(pwd):/usr/share/nginx/html --name pdf-printer pdf-merge-print
```

## 健康检查

容器包含健康检查，可以通过以下命令查看状态：

```bash
docker ps --filter "name=pdf-printer" --format "table {{.Names}}\t{{.Status}}"
```

## 日志查看

```bash
docker logs pdf-printer