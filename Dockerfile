# 基于 Nginx 的静态站点镜像
FROM nginx:alpine

# 维护者信息
LABEL maintainer="pdf-merge-print@example.com"

# 拷贝所有静态文件到nginx目录
COPY . /usr/share/nginx/html/

# 设置正确的文件权限
RUN chmod -R 755 /usr/share/nginx/html

# 暴露80端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]