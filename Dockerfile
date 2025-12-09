# 使用官方 Node.js 镜像
FROM node:18-alpine
# 设置工作目录
WORKDIR /app
# 复制依赖文件并安装
COPY package*.json ./
RUN npm install --production
# 复制应用源代码
COPY . .
# 暴露端口（Fly.io 会自动映射）
EXPOSE 8080
# 启动命令
CMD ["node", "index.js"]
